import {
  CURRENCY,
  GAMES,
  outcomeForValue,
  xpForStake,
  type GameConfig,
  type GameId,
  type GameResult,
  type HistoryItem,
  type Outcome,
  type RoundView,
} from '@casino/shared';
import { and, asc, desc, eq, lt, sql } from 'drizzle-orm';
import type { DB, Queryable, Tx } from '../db/client';
import { gameRounds, games, users, walletTransactions } from '../db/schema';
import { AppError, badRequest, conflict, insufficientBalance, notFound, pgErrorCode, PG_UNIQUE_VIOLATION } from '../lib/errors';
import { drawRandomValue, type Rng } from '../lib/rng';
import type { Settlement } from '../games/engine';
import { ENGINES } from '../games/registry';
import { getAssignedProfile } from './probability';
import { getBalance, lockWallet, postTransaction, type LockedWallet } from './wallet';

/*
 * Server-authoritative round flow (PRD §17):
 *   validate bet → lock wallet → load profile → draw random value → game engine
 *   → ledger (BET, then WIN) → persist round → return result.
 * All of it runs in one database transaction, so a failure anywhere leaves the
 * virtual balance untouched.
 */

type RoundRow = typeof gameRounds.$inferSelect;

export async function listGameConfigs(db: Queryable): Promise<GameConfig[]> {
  const rows = await db.select().from(games).orderBy(asc(games.sortOrder));
  return rows.map((g) => ({
    id: g.id as GameId,
    name: g.name,
    kind: g.type,
    enabled: g.enabled,
    minBet: g.minBet,
    maxBet: g.maxBet,
  }));
}

async function getGameConfig(tx: Tx, gameId: GameId) {
  const [game] = await tx.select().from(games).where(eq(games.id, gameId));
  if (!game) throw notFound('Game not found.');
  return game;
}

function winDescription(gameName: string, payout: number, stake: number): string {
  if (payout > stake) return `${gameName} Win`;
  if (payout === stake) return `${gameName} Push`;
  return `${gameName} Return`;
}

async function addXp(tx: Tx, userId: string, amount: number) {
  await tx
    .update(users)
    .set({ xp: sql`${users.xp} + ${amount}` })
    .where(eq(users.id, userId));
}

/** Ledger bounds for a round: balance before its first debit and after its last entry. */
async function roundBalances(db: Queryable, roundId: number) {
  const rows = await db
    .select({ before: walletTransactions.balanceBefore, after: walletTransactions.balanceAfter })
    .from(walletTransactions)
    .where(eq(walletTransactions.roundId, roundId))
    .orderBy(asc(walletTransactions.id));
  return { balanceBefore: rows[0]?.before ?? 0, balanceAfter: rows[rows.length - 1]?.after ?? 0 };
}

function toGameResult(round: RoundRow, balances: { balanceBefore: number; balanceAfter: number }, virtualBalance: number): GameResult {
  return {
    roundId: String(round.id),
    gameId: round.gameId as GameId,
    betAmount: round.betAmount,
    outcome: round.outcome!,
    result: round.outcome!,
    payout: round.payout ?? 0,
    balanceBefore: balances.balanceBefore,
    balanceAfter: balances.balanceAfter,
    virtualBalance,
    currency: CURRENCY,
    createdAt: round.createdAt.toISOString(),
    detail: round.detail,
  };
}

function toRoundView(round: RoundRow, virtualBalance: number): RoundView {
  return {
    roundId: String(round.id),
    gameId: round.gameId as GameId,
    status: round.status,
    seq: round.seq,
    betAmount: round.betAmount,
    state: round.detail,
    outcome: round.outcome,
    payout: round.payout,
    virtualBalance,
    currency: CURRENCY,
    createdAt: round.createdAt.toISOString(),
    settledAt: round.settledAt?.toISOString() ?? null,
  };
}

async function settle(tx: Tx, wallet: LockedWallet, round: RoundRow, settlement: Settlement, at: Date): Promise<RoundRow> {
  const gameName = GAMES[round.gameId as GameId].name;
  if (settlement.payout > 0) {
    await postTransaction(tx, wallet, {
      type: 'WIN',
      amount: settlement.payout,
      roundId: round.id,
      description: winDescription(gameName, settlement.payout, round.betAmount),
      at,
    });
  }
  await addXp(tx, round.userId, xpForStake(round.betAmount));
  const [settled] = await tx
    .update(gameRounds)
    .set({
      status: 'SETTLED',
      outcome: settlement.outcome,
      payout: settlement.payout,
      summary: settlement.summary,
      settledAt: at,
    })
    .where(eq(gameRounds.id, round.id))
    .returning();
  return settled!;
}

export interface PlayInput {
  userId: string;
  gameId: GameId;
  /** Already validated against playSchemas[gameId]. */
  bet: { betAmount: number } & Record<string, unknown>;
  idempotencyKey: string;
  rng: Rng;
  now?: Date;
}

export type PlayResponse = { kind: 'instant'; result: GameResult } | { kind: 'interactive'; round: RoundView };

export async function playRound(db: DB, input: PlayInput): Promise<PlayResponse> {
  try {
    return await db.transaction((tx) => playInTransaction(tx, input));
  } catch (error) {
    // Two requests with the same key raced past the lookup; return the one that won.
    if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) {
      const replay = await db.transaction((tx) => replayIfExists(tx, input));
      if (replay) return replay;
      throw conflict('ROUND_IN_PROGRESS', 'Finish your current round first.');
    }
    throw error;
  }
}

async function replayIfExists(tx: Tx, input: PlayInput): Promise<PlayResponse | null> {
  const wallet = await lockWallet(tx, input.userId);
  const [existing] = await tx
    .select()
    .from(gameRounds)
    .where(and(eq(gameRounds.userId, input.userId), eq(gameRounds.idempotencyKey, input.idempotencyKey)));
  if (!existing) return null;
  if (existing.gameId !== input.gameId) {
    throw conflict('IDEMPOTENCY_KEY_REUSED', 'This request key was already used for a different game.');
  }
  if (ENGINES[input.gameId].kind === 'instant') {
    return { kind: 'instant', result: toGameResult(existing, await roundBalances(tx, existing.id), wallet.balance) };
  }
  return { kind: 'interactive', round: toRoundView(existing, wallet.balance) };
}

async function playInTransaction(tx: Tx, input: PlayInput): Promise<PlayResponse> {
  const { userId, gameId, bet, idempotencyKey, rng } = input;
  const now = input.now ?? new Date();

  // Lock first: a duplicate request waits here, then finds the stored round below.
  const wallet = await lockWallet(tx, userId);
  const replay = await replayIfExists(tx, input);
  if (replay) return replay;

  const entry = ENGINES[gameId];
  const game = await getGameConfig(tx, gameId);
  if (!game.enabled) throw new AppError(403, 'GAME_DISABLED', `${game.name} is currently unavailable.`);

  const stake = entry.kind === 'instant' ? entry.engine.stake(bet) : bet.betAmount;
  if (stake < game.minBet || stake > game.maxBet) {
    throw badRequest('BET_OUT_OF_RANGE', `${game.name} bets must be between ₹${game.minBet} and ₹${game.maxBet}.`);
  }
  if (wallet.balance < stake) throw insufficientBalance();

  if (entry.kind === 'interactive') {
    const [active] = await tx
      .select({ id: gameRounds.id })
      .from(gameRounds)
      .where(and(eq(gameRounds.userId, userId), eq(gameRounds.gameId, gameId), eq(gameRounds.status, 'IN_PROGRESS')));
    if (active) throw conflict('ROUND_IN_PROGRESS', 'Finish your current hand first.', { roundId: String(active.id) });
  }

  const profile = await getAssignedProfile(tx, userId);
  const randomValue = drawRandomValue(rng);
  const target: Outcome = outcomeForValue(profile.chances, randomValue);
  const balanceBefore = wallet.balance;

  const base = {
    userId,
    gameId,
    betAmount: stake,
    randomValue,
    targetOutcome: target,
    probabilityProfileId: profile.id,
    probabilitySnapshot: profile.chances,
    idempotencyKey,
    createdAt: now,
  };

  if (entry.kind === 'instant') {
    const resolution = entry.engine.resolve(bet, target, rng);
    const [round] = await tx
      .insert(gameRounds)
      .values({
        ...base,
        status: 'SETTLED',
        outcome: resolution.outcome,
        payout: resolution.payout,
        detail: resolution.detail,
        summary: resolution.summary,
        settledAt: now,
      })
      .returning();
    await postTransaction(tx, wallet, { type: 'BET', amount: -stake, roundId: round!.id, description: `${game.name} Bet`, at: now });
    if (resolution.payout > 0) {
      await postTransaction(tx, wallet, {
        type: 'WIN',
        amount: resolution.payout,
        roundId: round!.id,
        description: winDescription(game.name, resolution.payout, stake),
        at: now,
      });
    }
    await addXp(tx, userId, xpForStake(stake));
    return {
      kind: 'instant',
      result: toGameResult(round!, { balanceBefore, balanceAfter: wallet.balance }, wallet.balance),
    };
  }

  const step = entry.engine.start(stake, target, rng);
  let [round] = await tx
    .insert(gameRounds)
    .values({ ...base, status: 'IN_PROGRESS', state: step.state, detail: entry.engine.view(step.state) })
    .returning();
  await postTransaction(tx, wallet, { type: 'BET', amount: -stake, roundId: round!.id, description: `${game.name} Bet`, at: now });
  if (step.settlement) round = await settle(tx, wallet, round!, step.settlement, now);
  return { kind: 'interactive', round: toRoundView(round!, wallet.balance) };
}

export interface ActionInput {
  userId: string;
  gameId: GameId;
  roundId: number;
  /** Already validated against the game's action schema. */
  action: { seq: number; action: string } & Record<string, unknown>;
  rng: Rng;
}

export async function actOnRound(db: DB, input: ActionInput): Promise<RoundView> {
  const entry = ENGINES[input.gameId];
  if (entry.kind !== 'interactive') throw badRequest('NOT_INTERACTIVE', 'This game has no in-round actions.');

  return db.transaction(async (tx) => {
    const wallet = await lockWallet(tx, input.userId);
    const [round] = await tx
      .select()
      .from(gameRounds)
      .where(and(eq(gameRounds.id, input.roundId), eq(gameRounds.userId, input.userId), eq(gameRounds.gameId, input.gameId)))
      .for('update');
    if (!round) throw notFound('Round not found.');
    if (round.status !== 'IN_PROGRESS') {
      throw conflict('ROUND_FINISHED', 'This round is already finished.', { round: toRoundView(round, wallet.balance) });
    }
    if (input.action.seq !== round.seq) {
      // Double-click or a stale tab: tell the client the real state instead of acting twice.
      throw conflict('STALE_ACTION', 'That action was already processed.', { round: toRoundView(round, wallet.balance) });
    }

    const now = new Date();
    const step = entry.engine.act(round.state, input.action, input.rng);
    const gameName = GAMES[input.gameId].name;

    if (step.additionalStake > 0) {
      if (wallet.balance < step.additionalStake) throw insufficientBalance();
      await postTransaction(tx, wallet, {
        type: 'BET',
        amount: -step.additionalStake,
        roundId: round.id,
        description: `${gameName} ${input.action.action === 'SPLIT' ? 'Split' : 'Double'}`,
        at: now,
      });
    }

    let [updated] = await tx
      .update(gameRounds)
      .set({
        state: step.state,
        detail: entry.engine.view(step.state),
        seq: round.seq + 1,
        betAmount: round.betAmount + step.additionalStake,
      })
      .where(eq(gameRounds.id, round.id))
      .returning();
    if (step.settlement) updated = await settle(tx, wallet, updated!, step.settlement, now);
    return toRoundView(updated!, wallet.balance);
  });
}

export async function getActiveRound(db: DB, userId: string, gameId: GameId): Promise<RoundView | null> {
  const [round] = await db
    .select()
    .from(gameRounds)
    .where(and(eq(gameRounds.userId, userId), eq(gameRounds.gameId, gameId), eq(gameRounds.status, 'IN_PROGRESS')));
  if (!round) return null;
  return toRoundView(round, await getBalance(db, userId));
}

export function toHistoryItem(round: Pick<RoundRow, 'id' | 'gameId' | 'betAmount' | 'payout' | 'outcome' | 'status' | 'summary' | 'createdAt'>): HistoryItem {
  const gameId = round.gameId as GameId;
  return {
    roundId: String(round.id),
    gameId,
    gameName: GAMES[gameId].name,
    betAmount: round.betAmount,
    payout: round.payout,
    outcome: round.outcome,
    status: round.status,
    summary: round.status === 'IN_PROGRESS' ? 'In progress' : round.summary,
    createdAt: round.createdAt.toISOString(),
  };
}

export async function listHistory(
  db: Queryable,
  userId: string,
  options: { cursor?: string; limit: number; gameId?: GameId },
): Promise<{ items: HistoryItem[]; nextCursor: string | null }> {
  const rows = await db
    .select()
    .from(gameRounds)
    .where(
      and(
        eq(gameRounds.userId, userId),
        options.gameId ? eq(gameRounds.gameId, options.gameId) : undefined,
        options.cursor ? lt(gameRounds.id, Number(options.cursor)) : undefined,
      ),
    )
    .orderBy(desc(gameRounds.id))
    .limit(options.limit + 1);
  const page = rows.slice(0, options.limit);
  return {
    items: page.map(toHistoryItem),
    nextCursor: rows.length > options.limit ? String(page[page.length - 1]!.id) : null,
  };
}

/** One settled round with its public detail — for the history "details" sheet. */
export async function getRoundDetail(db: Queryable, userId: string, roundId: number) {
  const [round] = await db
    .select()
    .from(gameRounds)
    .where(and(eq(gameRounds.id, roundId), eq(gameRounds.userId, userId)));
  if (!round) throw notFound('Round not found.');
  const txns = await db
    .select({ type: walletTransactions.type, amount: walletTransactions.amount, description: walletTransactions.description })
    .from(walletTransactions)
    .where(eq(walletTransactions.roundId, roundId))
    .orderBy(asc(walletTransactions.id));
  return { item: toHistoryItem(round), detail: round.detail, transactions: txns };
}
