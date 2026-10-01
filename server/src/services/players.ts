import {
  levelFromXp,
  OUTCOMES,
  xpForLevel,
  type GameId,
  type LeaderboardEntry,
  type LeaderboardResponse,
  type Outcome,
  type ProfileResponse,
  type SessionUser,
} from '@casino/shared';
import { and, desc, eq, gte, sql } from 'drizzle-orm';
import type { Queryable } from '../db/client';
import { gameRounds, users, wallets } from '../db/schema';
import type { AuthInfo, AuthUser } from '../context';
import { getAssignedProfile } from './probability';

export function toSessionUser(user: AuthUser): SessionUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    status: user.status,
    xp: user.xp,
    level: levelFromXp(user.xp),
    createdAt: user.createdAt.toISOString(),
  };
}

export async function getProfile(db: Queryable, auth: AuthInfo, sessionStart = auth.sessionCreatedAt): Promise<ProfileResponse> {
  const userId = auth.user.id;
  const settled = and(eq(gameRounds.userId, userId), eq(gameRounds.status, 'SETTLED'));

  const [[totals], outcomeRows, [favorite], [session], [fresh], profile] = await Promise.all([
    db
      .select({
        rounds: sql`count(*)`.mapWith(Number),
        totalBet: sql`coalesce(sum(${gameRounds.betAmount}), 0)`.mapWith(Number),
        totalPayout: sql`coalesce(sum(${gameRounds.payout}), 0)`.mapWith(Number),
        biggestWin: sql`coalesce(max(${gameRounds.payout} - ${gameRounds.betAmount}) filter (where ${gameRounds.payout} > ${gameRounds.betAmount}), 0)`.mapWith(Number),
      })
      .from(gameRounds)
      .where(settled),
    db
      .select({ outcome: gameRounds.outcome, count: sql`count(*)`.mapWith(Number) })
      .from(gameRounds)
      .where(settled)
      .groupBy(gameRounds.outcome),
    db
      .select({ gameId: gameRounds.gameId, count: sql`count(*)`.mapWith(Number) })
      .from(gameRounds)
      .where(settled)
      .groupBy(gameRounds.gameId)
      .orderBy(desc(sql`count(*)`))
      .limit(1),
    db
      .select({
        rounds: sql`count(*)`.mapWith(Number),
        won: sql`coalesce(sum(greatest(${gameRounds.payout} - ${gameRounds.betAmount}, 0)), 0)`.mapWith(Number),
        lost: sql`coalesce(sum(greatest(${gameRounds.betAmount} - ${gameRounds.payout}, 0)), 0)`.mapWith(Number),
      })
      .from(gameRounds)
      .where(and(settled, gte(gameRounds.createdAt, sessionStart))),
    db.select({ xp: users.xp }).from(users).where(eq(users.id, userId)),
    getAssignedProfile(db, userId),
  ]);

  const outcomes = Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Record<Outcome, number>;
  for (const row of outcomeRows) if (row.outcome) outcomes[row.outcome] = row.count;

  const user = { ...auth.user, xp: fresh?.xp ?? auth.user.xp };
  const level = levelFromXp(user.xp);
  return {
    user: toSessionUser(user),
    levelProgress: { currentLevelXp: xpForLevel(level), nextLevelXp: xpForLevel(level + 1) },
    stats: {
      rounds: totals!.rounds,
      totalBet: totals!.totalBet,
      totalPayout: totals!.totalPayout,
      biggestWin: totals!.biggestWin,
      favoriteGame: (favorite?.gameId as GameId | undefined) ?? null,
      outcomes,
    },
    simulation: { profileName: profile.name, chances: profile.chances },
    session: {
      startedAt: sessionStart.toISOString(),
      rounds: session!.rounds,
      virtualWon: session!.won,
      virtualLost: session!.lost,
    },
  };
}

export async function getLeaderboard(db: Queryable, userId: string): Promise<LeaderboardResponse> {
  const eligible = and(eq(users.role, 'player'), eq(users.status, 'active'));
  const rows = await db
    .select({ id: users.id, username: users.username, avatar: users.avatar, xp: users.xp, balance: wallets.virtualBalance })
    .from(users)
    .innerJoin(wallets, eq(wallets.userId, users.id))
    .where(eligible)
    .orderBy(desc(wallets.virtualBalance), users.username)
    .limit(20);

  const toEntry = (r: (typeof rows)[number], rank: number): LeaderboardEntry => ({
    rank,
    username: r.username,
    avatar: r.avatar,
    level: levelFromXp(r.xp),
    virtualBalance: r.balance,
    isYou: r.id === userId,
  });
  const entries = rows.map((r, i) => toEntry(r, i + 1));

  let you = entries.find((e) => e.isYou) ?? null;
  if (!you) {
    const [me] = await db
      .select({ id: users.id, username: users.username, avatar: users.avatar, xp: users.xp, balance: wallets.virtualBalance, role: users.role })
      .from(users)
      .innerJoin(wallets, eq(wallets.userId, users.id))
      .where(eq(users.id, userId));
    if (me && me.role === 'player') {
      const [ahead] = await db
        .select({ n: sql`count(*)`.mapWith(Number) })
        .from(users)
        .innerJoin(wallets, eq(wallets.userId, users.id))
        .where(and(eligible, sql`${wallets.virtualBalance} > ${me.balance}`));
      you = toEntry(me, ahead!.n + 1);
    }
  }
  return { entries, you };
}
