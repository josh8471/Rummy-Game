import {
  GAMES,
  istDateString,
  levelFromXp,
  OUTCOMES,
  type AdminGameConfig,
  type AdminOverview,
  type AdminPlayerDetail,
  type AdminPlayerRow,
  type AdminRoundItem,
  type AuditLogItem,
  type BalanceAdjustmentRequest,
  type Chances,
  type GameId,
  type GameUpdateRequest,
  type Outcome,
  type OutcomeMixRow,
  type PlayerStatusRequest,
  type ProfileItem,
  type ProfileUpsertRequest,
  type SecurityEventItem,
  type SetProbabilityRequest,
} from '@casino/shared';
import { and, asc, desc, eq, gte, ilike, lt, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { DB, Queryable } from '../db/client';
import {
  adminAuditLogs,
  gameRounds,
  games,
  probabilityProfiles,
  securityEvents,
  sessions,
  userProbabilityProfiles,
  users,
  wallets,
  walletTransactions,
} from '../db/schema';
import { conflict, forbidden, notFound, pgErrorCode, PG_UNIQUE_VIOLATION } from '../lib/errors';
import { chancesOf, chancesToColumns, getAssignedProfile, getDefaultProfile } from './probability';
import { toHistoryItem } from './rounds';
import { writeAudit } from './security';
import { lockWallet, postTransaction, toTransactionItem } from './wallet';

const DAY_MS = 24 * 60 * 60 * 1000;
/** IST calendar day of a timestamp, without relying on the database's time-zone data. */
const istDay = (column: SQL | typeof gameRounds.createdAt) =>
  sql<string>`to_char((${column} at time zone 'UTC') + interval '330 minutes', 'YYYY-MM-DD')`;

function istMidnight(now: Date): Date {
  return new Date(`${istDateString(now)}T00:00:00+05:30`);
}

function outcomeMix(rows: { kind: 'target' | 'actual'; outcome: Outcome | null; count: number }[]): OutcomeMixRow[] {
  const total = (kind: 'target' | 'actual') => rows.filter((r) => r.kind === kind).reduce((s, r) => s + r.count, 0);
  const pct = (kind: 'target' | 'actual', outcome: Outcome) => {
    const t = total(kind);
    const n = rows.find((r) => r.kind === kind && r.outcome === outcome)?.count ?? 0;
    return t === 0 ? 0 : Math.round((n / t) * 1000) / 10;
  };
  return OUTCOMES.map((outcome) => ({ outcome, target: pct('target', outcome), actual: pct('actual', outcome) }));
}

async function outcomeMixFor(db: Queryable, where: SQL | undefined): Promise<OutcomeMixRow[]> {
  const settled = and(eq(gameRounds.status, 'SETTLED'), where);
  const [targets, actuals] = await Promise.all([
    db
      .select({ outcome: gameRounds.targetOutcome, count: sql`count(*)`.mapWith(Number) })
      .from(gameRounds)
      .where(settled)
      .groupBy(gameRounds.targetOutcome),
    db
      .select({ outcome: gameRounds.outcome, count: sql`count(*)`.mapWith(Number) })
      .from(gameRounds)
      .where(settled)
      .groupBy(gameRounds.outcome),
  ]);
  return outcomeMix([
    ...targets.map((r) => ({ kind: 'target' as const, ...r })),
    ...actuals.map((r) => ({ kind: 'actual' as const, ...r })),
  ]);
}

/* ─────────────── Overview ─────────────── */

export async function getOverview(db: Queryable, now = new Date()): Promise<AdminOverview> {
  const since14 = new Date(istMidnight(now).getTime() - 13 * DAY_MS);
  const [[players], [active], [circulation], [played], [today], perDay, byGame, mix, events] = await Promise.all([
    db.select({ n: sql`count(*)`.mapWith(Number) }).from(users).where(eq(users.role, 'player')),
    db
      .select({ n: sql`count(distinct ${gameRounds.userId})`.mapWith(Number) })
      .from(gameRounds)
      .where(gte(gameRounds.createdAt, new Date(now.getTime() - DAY_MS))),
    db.select({ n: sql`coalesce(sum(${wallets.virtualBalance}), 0)`.mapWith(Number) }).from(wallets),
    db.select({ n: sql`count(*)`.mapWith(Number) }).from(gameRounds),
    db
      .select({ n: sql`count(*)`.mapWith(Number) })
      .from(gameRounds)
      .where(gte(gameRounds.createdAt, istMidnight(now))),
    db
      .select({ date: istDay(gameRounds.createdAt), rounds: sql`count(*)`.mapWith(Number) })
      .from(gameRounds)
      .where(gte(gameRounds.createdAt, since14))
      .groupBy(istDay(gameRounds.createdAt)),
    db
      .select({
        gameId: gameRounds.gameId,
        rounds: sql`count(*)`.mapWith(Number),
        wagered: sql`coalesce(sum(${gameRounds.betAmount}), 0)`.mapWith(Number),
        paid: sql`coalesce(sum(${gameRounds.payout}), 0)`.mapWith(Number),
      })
      .from(gameRounds)
      .where(eq(gameRounds.status, 'SETTLED'))
      .groupBy(gameRounds.gameId),
    outcomeMixFor(db, gte(gameRounds.createdAt, new Date(now.getTime() - 30 * DAY_MS))),
    listSecurityEvents(db, 8),
  ]);

  const counts = new Map(perDay.map((r) => [r.date, r.rounds]));
  const roundsPerDay = Array.from({ length: 14 }, (_, i) => {
    const date = istDateString(new Date(since14.getTime() + i * DAY_MS + DAY_MS / 2));
    return { date, rounds: counts.get(date) ?? 0 };
  });

  return {
    metrics: {
      totalPlayers: players!.n,
      activePlayers: active!.n,
      virtualCirculation: circulation!.n,
      gamesPlayed: played!.n,
      roundsToday: today!.n,
    },
    roundsPerDay,
    outcomeMix: mix,
    byGame: (Object.keys(GAMES) as GameId[]).map((gameId) => {
      const row = byGame.find((r) => r.gameId === gameId);
      return { gameId, rounds: row?.rounds ?? 0, wagered: row?.wagered ?? 0, paid: row?.paid ?? 0 };
    }),
    recentSecurityEvents: events,
  };
}

export async function listSecurityEvents(db: Queryable, limit = 50): Promise<SecurityEventItem[]> {
  const rows = await db
    .select({
      id: securityEvents.id,
      type: securityEvents.type,
      username: users.username,
      ip: securityEvents.ip,
      detail: securityEvents.detail,
      createdAt: securityEvents.createdAt,
    })
    .from(securityEvents)
    .leftJoin(users, eq(users.id, securityEvents.userId))
    .orderBy(desc(securityEvents.id))
    .limit(limit);
  return rows.map((r) => ({ ...r, id: String(r.id), createdAt: r.createdAt.toISOString() }));
}

/* ─────────────── Players ─────────────── */

async function playerRows(db: Queryable, where: SQL | undefined, options: { limit: number; offset: number }) {
  const defaultProfile = await getDefaultProfile(db);
  const roundStats = db
    .select({
      userId: gameRounds.userId,
      games: sql<number>`count(*)`.as('games'),
      lastActiveAt: sql<Date>`max(${gameRounds.createdAt})`.as('last_active_at'),
    })
    .from(gameRounds)
    .groupBy(gameRounds.userId)
    .as('round_stats');

  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      email: users.email,
      avatar: users.avatar,
      role: users.role,
      status: users.status,
      xp: users.xp,
      createdAt: users.createdAt,
      virtualBalance: wallets.virtualBalance,
      profileId: probabilityProfiles.id,
      profileName: probabilityProfiles.name,
      games: roundStats.games,
      lastActiveAt: roundStats.lastActiveAt,
    })
    .from(users)
    .innerJoin(wallets, eq(wallets.userId, users.id))
    .leftJoin(userProbabilityProfiles, eq(userProbabilityProfiles.userId, users.id))
    .leftJoin(probabilityProfiles, eq(probabilityProfiles.id, userProbabilityProfiles.profileId))
    .leftJoin(roundStats, eq(roundStats.userId, users.id))
    .where(where)
    .orderBy(asc(users.username))
    .limit(options.limit)
    .offset(options.offset);

  return rows.map(
    (r): AdminPlayerRow => ({
      id: r.id,
      username: r.username,
      email: r.email,
      avatar: r.avatar,
      role: r.role,
      status: r.status,
      virtualBalance: r.virtualBalance,
      level: levelFromXp(r.xp),
      xp: r.xp,
      profileId: r.profileId ?? defaultProfile.id,
      profileName: r.profileName ?? defaultProfile.name,
      games: Number(r.games ?? 0),
      lastActiveAt: r.lastActiveAt ? new Date(r.lastActiveAt).toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    }),
  );
}

export async function listPlayers(db: Queryable, options: { search?: string; cursor?: string; limit: number }) {
  const offset = Number(options.cursor ?? 0);
  const term = options.search?.trim();
  const where = term ? or(ilike(users.username, `%${escapeLike(term)}%`), ilike(users.email, `%${escapeLike(term)}%`)) : undefined;
  const rows = await playerRows(db, where, { limit: options.limit + 1, offset });
  const [count] = await db.select({ n: sql`count(*)`.mapWith(Number) }).from(users).where(where);
  return {
    items: rows.slice(0, options.limit),
    nextCursor: rows.length > options.limit ? String(offset + options.limit) : null,
    total: count!.n,
  };
}

function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (m) => `\\${m}`);
}

async function requirePlayer(db: Queryable, playerId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(playerId)) throw notFound('Player not found.');
  const [row] = await playerRows(db, eq(users.id, playerId), { limit: 1, offset: 0 });
  if (!row) throw notFound('Player not found.');
  return row;
}

export async function getPlayerDetail(db: Queryable, playerId: string): Promise<AdminPlayerDetail> {
  const player = await requirePlayer(db, playerId);
  const [profile, mix, rounds, txns] = await Promise.all([
    getAssignedProfile(db, playerId),
    outcomeMixFor(db, eq(gameRounds.userId, playerId)),
    db
      .select({ round: gameRounds, profileName: probabilityProfiles.name })
      .from(gameRounds)
      .innerJoin(probabilityProfiles, eq(probabilityProfiles.id, gameRounds.probabilityProfileId))
      .where(eq(gameRounds.userId, playerId))
      .orderBy(desc(gameRounds.id))
      .limit(25),
    db
      .select({
        id: walletTransactions.id,
        type: walletTransactions.type,
        amount: walletTransactions.amount,
        balanceBefore: walletTransactions.balanceBefore,
        balanceAfter: walletTransactions.balanceAfter,
        description: walletTransactions.description,
        roundId: walletTransactions.roundId,
        gameId: gameRounds.gameId,
        createdAt: walletTransactions.createdAt,
      })
      .from(walletTransactions)
      .leftJoin(gameRounds, eq(gameRounds.id, walletTransactions.roundId))
      .where(eq(walletTransactions.userId, playerId))
      .orderBy(desc(walletTransactions.id))
      .limit(25),
  ]);
  return {
    player,
    chances: profile.chances,
    outcomeMix: mix,
    recentRounds: rounds.map(
      ({ round, profileName }): AdminRoundItem => ({
        ...toHistoryItem(round),
        targetOutcome: round.targetOutcome,
        randomValue: round.randomValue,
        profileName,
      }),
    ),
    transactions: txns.map(toTransactionItem),
  };
}

type ProfileSnapshot = { profileId: number; profileName: string } & Chances;

function snapshot(row: typeof probabilityProfiles.$inferSelect): ProfileSnapshot {
  return { profileId: row.id, profileName: row.name, ...chancesOf(row) };
}

/** Assigns a profile to a player (or creates a custom one from raw chances). Audited. */
export async function setPlayerProbability(db: DB, adminId: string, playerId: string, body: SetProbabilityRequest) {
  const player = await requirePlayer(db, playerId);
  return db.transaction(async (tx) => {
    const current = await getAssignedProfile(tx, playerId);
    const [currentRow] = await tx.select().from(probabilityProfiles).where(eq(probabilityProfiles.id, current.id));

    let target: typeof probabilityProfiles.$inferSelect | undefined;
    if (body.profileId !== undefined) {
      [target] = await tx.select().from(probabilityProfiles).where(eq(probabilityProfiles.id, body.profileId));
      if (!target) throw notFound('Probability profile not found.');
    } else {
      const chances: Chances = {
        winChance: body.winChance!,
        smallWinChance: body.smallWinChance!,
        bigWinChance: body.bigWinChance!,
        lossChance: body.lossChance!,
      };
      const cols = chancesToColumns(chances);
      // Reuse any profile with identical values; otherwise create a custom one for this player.
      [target] = await tx
        .select()
        .from(probabilityProfiles)
        .where(
          and(
            eq(probabilityProfiles.winProbability, cols.winProbability),
            eq(probabilityProfiles.smallWinProbability, cols.smallWinProbability),
            eq(probabilityProfiles.bigWinProbability, cols.bigWinProbability),
            eq(probabilityProfiles.lossProbability, cols.lossProbability),
          ),
        )
        .orderBy(desc(probabilityProfiles.isSystem), asc(probabilityProfiles.id))
        .limit(1);
      if (!target) {
        const base = `Custom · ${player.username}`;
        const taken = await tx
          .select({ name: probabilityProfiles.name })
          .from(probabilityProfiles)
          .where(ilike(probabilityProfiles.name, `${escapeLike(base)}%`));
        const names = new Set(taken.map((t) => t.name));
        let name = base;
        for (let n = 2; names.has(name); n++) name = `${base} (${n})`;
        [target] = await tx
          .insert(probabilityProfiles)
          .values({ name, description: `Custom profile for ${player.username}`, ...cols, createdBy: adminId })
          .returning();
      }
    }

    await tx
      .insert(userProbabilityProfiles)
      .values({ userId: playerId, profileId: target!.id, updatedBy: adminId })
      .onConflictDoUpdate({
        target: userProbabilityProfiles.userId,
        set: { profileId: target!.id, updatedBy: adminId, updatedAt: new Date() },
      });

    await writeAudit(tx, {
      adminId,
      action: 'PROBABILITY_PROFILE_CHANGED',
      targetUserId: playerId,
      oldValue: currentRow ? snapshot(currentRow) : null,
      newValue: snapshot(target!),
      reason: body.reason,
    });
    return { profileId: target!.id, profileName: target!.name, chances: chancesOf(target!) };
  });
}

export async function setPlayerStatus(db: DB, adminId: string, playerId: string, body: PlayerStatusRequest) {
  const player = await requirePlayer(db, playerId);
  if (player.id === adminId) throw forbidden('You cannot change your own status.');
  return db.transaction(async (tx) => {
    await tx.update(users).set({ status: body.status, updatedAt: new Date() }).where(eq(users.id, playerId));
    if (body.status === 'suspended') await tx.delete(sessions).where(eq(sessions.userId, playerId));
    await writeAudit(tx, {
      adminId,
      action: 'PLAYER_STATUS_CHANGED',
      targetUserId: playerId,
      oldValue: { status: player.status },
      newValue: { status: body.status },
      reason: body.reason,
    });
    return { status: body.status };
  });
}

export async function adjustPlayerBalance(db: DB, adminId: string, playerId: string, body: BalanceAdjustmentRequest) {
  await requirePlayer(db, playerId);
  return db.transaction(async (tx) => {
    const wallet = await lockWallet(tx, playerId);
    const before = wallet.balance;
    await postTransaction(tx, wallet, {
      type: 'ADMIN_ADJUSTMENT',
      amount: body.amount,
      description: `Admin adjustment: ${body.reason}`.slice(0, 200),
    });
    await writeAudit(tx, {
      adminId,
      action: 'BALANCE_ADJUSTED',
      targetUserId: playerId,
      oldValue: { virtualBalance: before },
      newValue: { virtualBalance: wallet.balance, amount: body.amount },
      reason: body.reason,
    });
    return { virtualBalance: wallet.balance };
  });
}

/* ─────────────── Profiles ─────────────── */

export async function listProfiles(db: Queryable): Promise<ProfileItem[]> {
  const counts = db
    .select({ profileId: userProbabilityProfiles.profileId, n: sql<number>`count(*)`.as('n') })
    .from(userProbabilityProfiles)
    .groupBy(userProbabilityProfiles.profileId)
    .as('counts');
  const rows = await db
    .select({ profile: probabilityProfiles, n: counts.n })
    .from(probabilityProfiles)
    .leftJoin(counts, eq(counts.profileId, probabilityProfiles.id))
    .orderBy(desc(probabilityProfiles.isSystem), asc(probabilityProfiles.id));
  return rows.map(({ profile, n }) => ({
    id: profile.id,
    name: profile.name,
    description: profile.description,
    isSystem: profile.isSystem,
    ...chancesOf(profile),
    assignedPlayers: Number(n ?? 0),
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  }));
}

export async function createProfile(db: DB, adminId: string, body: ProfileUpsertRequest) {
  try {
    return await db.transaction(async (tx) => {
      const [row] = await tx
        .insert(probabilityProfiles)
        .values({ name: body.name, description: body.description, ...chancesToColumns(body), createdBy: adminId })
        .returning();
      await writeAudit(tx, { adminId, action: 'PROFILE_CREATED', newValue: snapshot(row!), reason: body.reason });
      return snapshot(row!);
    });
  } catch (error) {
    if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) throw conflict('PROFILE_NAME_TAKEN', 'A profile with this name already exists.');
    throw error;
  }
}

export async function updateProfile(db: DB, adminId: string, profileId: number, body: ProfileUpsertRequest) {
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(probabilityProfiles).where(eq(probabilityProfiles.id, profileId)).for('update');
      if (!existing) throw notFound('Probability profile not found.');
      if (existing.isSystem) throw forbidden('Preset profiles cannot be edited. Create a custom profile instead.');
      const [row] = await tx
        .update(probabilityProfiles)
        .set({ name: body.name, description: body.description, ...chancesToColumns(body), updatedAt: new Date() })
        .where(eq(probabilityProfiles.id, profileId))
        .returning();
      await writeAudit(tx, { adminId, action: 'PROFILE_UPDATED', oldValue: snapshot(existing), newValue: snapshot(row!), reason: body.reason });
      return snapshot(row!);
    });
  } catch (error) {
    if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) throw conflict('PROFILE_NAME_TAKEN', 'A profile with this name already exists.');
    throw error;
  }
}

/* ─────────────── Games ─────────────── */

export async function listAdminGames(db: Queryable): Promise<AdminGameConfig[]> {
  const counts = await db
    .select({ gameId: gameRounds.gameId, n: sql`count(*)`.mapWith(Number) })
    .from(gameRounds)
    .groupBy(gameRounds.gameId);
  const rows = await db.select().from(games).orderBy(asc(games.sortOrder));
  return rows.map((g) => ({
    id: g.id as GameId,
    name: g.name,
    kind: g.type,
    enabled: g.enabled,
    minBet: g.minBet,
    maxBet: g.maxBet,
    rounds: counts.find((c) => c.gameId === g.id)?.n ?? 0,
  }));
}

export async function updateGame(db: DB, adminId: string, gameId: string, body: GameUpdateRequest) {
  return db.transaction(async (tx) => {
    const [existing] = await tx.select().from(games).where(eq(games.id, gameId)).for('update');
    if (!existing) throw notFound('Game not found.');
    const [row] = await tx
      .update(games)
      .set({ enabled: body.enabled, minBet: body.minBet, maxBet: body.maxBet, updatedAt: new Date() })
      .where(eq(games.id, gameId))
      .returning();
    const pick = (g: typeof existing) => ({ gameId: g.id, enabled: g.enabled, minBet: g.minBet, maxBet: g.maxBet });
    await writeAudit(tx, { adminId, action: 'GAME_CONFIG_CHANGED', oldValue: pick(existing), newValue: pick(row!), reason: body.reason });
    return pick(row!);
  });
}

/* ─────────────── Audit ─────────────── */

export async function listAuditLogs(db: Queryable, options: { cursor?: string; limit: number }) {
  const admin = alias(users, 'admin_user');
  const target = alias(users, 'target_user');
  const rows = await db
    .select({
      id: adminAuditLogs.id,
      adminUsername: admin.username,
      action: adminAuditLogs.action,
      targetUsername: target.username,
      oldValue: adminAuditLogs.oldValue,
      newValue: adminAuditLogs.newValue,
      reason: adminAuditLogs.reason,
      createdAt: adminAuditLogs.createdAt,
    })
    .from(adminAuditLogs)
    .innerJoin(admin, eq(admin.id, adminAuditLogs.adminId))
    .leftJoin(target, eq(target.id, adminAuditLogs.targetUserId))
    .where(options.cursor ? lt(adminAuditLogs.id, Number(options.cursor)) : undefined)
    .orderBy(desc(adminAuditLogs.id))
    .limit(options.limit + 1);
  const page = rows.slice(0, options.limit);
  return {
    items: page.map((r): AuditLogItem => ({ ...r, id: String(r.id), createdAt: r.createdAt.toISOString() })),
    nextCursor: rows.length > options.limit ? String(page[page.length - 1]!.id) : null,
  };
}

