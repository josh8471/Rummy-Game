import {
  CURRENCY,
  DAILY_REWARD_LADDER,
  istDateString,
  type Achievement,
  type DailyClaimResponse,
  type RewardsResponse,
} from '@casino/shared';
import { and, desc, eq, sql } from 'drizzle-orm';
import type { DB, Queryable } from '../db/client';
import { dailyRewards, gameRounds } from '../db/schema';
import { conflict, pgErrorCode, PG_UNIQUE_VIOLATION } from '../lib/errors';
import { lockWallet, postTransaction } from './wallet';

const DAY_MS = 24 * 60 * 60 * 1000;

export function rewardForStreak(streak: number): number {
  return DAILY_REWARD_LADDER[Math.min(Math.max(streak, 1), DAILY_REWARD_LADDER.length) - 1]!;
}

async function lastClaim(db: Queryable, userId: string) {
  const [row] = await db
    .select({ rewardDate: dailyRewards.rewardDate, streak: dailyRewards.streak })
    .from(dailyRewards)
    .where(eq(dailyRewards.userId, userId))
    .orderBy(desc(dailyRewards.rewardDate))
    .limit(1);
  return row ?? null;
}

async function achievementsFor(db: Queryable, userId: string): Promise<Achievement[]> {
  const [stats] = await db
    .select({
      rounds: sql`count(*)`.mapWith(Number),
      games: sql`count(distinct ${gameRounds.gameId})`.mapWith(Number),
      bigWins: sql`count(*) filter (where ${gameRounds.outcome} = 'BIG_WIN')`.mapWith(Number),
      maxBet: sql`coalesce(max(${gameRounds.betAmount}), 0)`.mapWith(Number),
    })
    .from(gameRounds)
    .where(and(eq(gameRounds.userId, userId), eq(gameRounds.status, 'SETTLED')));
  const [streak] = await db
    .select({ best: sql`coalesce(max(${dailyRewards.streak}), 0)`.mapWith(Number) })
    .from(dailyRewards)
    .where(eq(dailyRewards.userId, userId));

  const s = stats!;
  const list: Omit<Achievement, 'unlocked'>[] = [
    { id: 'first-round', title: 'First Round', description: 'Play your first round', icon: '🎲', progress: s.rounds, target: 1 },
    { id: 'warming-up', title: 'Warming Up', description: 'Play 10 rounds', icon: '🔥', progress: s.rounds, target: 10 },
    { id: 'regular', title: 'Regular', description: 'Play 100 rounds', icon: '🏆', progress: s.rounds, target: 100 },
    { id: 'explorer', title: 'Explorer', description: 'Play 5 different games', icon: '🧭', progress: s.games, target: 5 },
    { id: 'big-winner', title: 'Big Winner', description: 'Land a Big Win', icon: '💎', progress: s.bigWins, target: 1 },
    { id: 'high-roller', title: 'High Roller', description: 'Stake ₹10,000 in one round', icon: '👑', progress: s.maxBet >= 10_000 ? 1 : 0, target: 1 },
    { id: 'loyal', title: 'Loyal', description: 'Claim the daily reward 7 days in a row', icon: '📅', progress: streak!.best, target: 7 },
  ];
  return list.map((a) => ({ ...a, progress: Math.min(a.progress, a.target), unlocked: a.progress >= a.target }));
}

export async function getRewards(db: Queryable, userId: string, now = new Date()): Promise<RewardsResponse> {
  const today = istDateString(now);
  const yesterday = istDateString(new Date(now.getTime() - DAY_MS));
  const last = await lastClaim(db, userId);
  const claimedToday = last?.rewardDate === today;
  const streak = claimedToday ? last!.streak : last?.rewardDate === yesterday ? last.streak : 0;
  const nextStreakDay = streak + 1;
  return {
    daily: {
      claimedToday,
      streak,
      nextAmount: rewardForStreak(nextStreakDay),
      nextStreakDay,
      ladder: [...DAILY_REWARD_LADDER],
      todayDate: today,
    },
    achievements: await achievementsFor(db, userId),
  };
}

export async function claimDailyReward(db: DB, userId: string, now = new Date()): Promise<DailyClaimResponse> {
  const today = istDateString(now);
  const yesterday = istDateString(new Date(now.getTime() - DAY_MS));
  try {
    return await db.transaction(async (tx) => {
      const wallet = await lockWallet(tx, userId);
      const last = await lastClaim(tx, userId);
      if (last?.rewardDate === today) {
        throw conflict('ALREADY_CLAIMED', 'You already claimed today’s reward. Come back after midnight IST.');
      }
      const streak = last?.rewardDate === yesterday ? last.streak + 1 : 1;
      const amount = rewardForStreak(streak);
      const txn = await postTransaction(tx, wallet, {
        type: 'DAILY_REWARD',
        amount,
        description: `Daily Reward · Day ${streak}`,
        at: now,
      });
      await tx.insert(dailyRewards).values({ userId, rewardDate: today, streak, amount, transactionId: txn.id, createdAt: now });
      return { amount, streak, virtualBalance: wallet.balance, currency: CURRENCY };
    });
  } catch (error) {
    if (pgErrorCode(error) === PG_UNIQUE_VIOLATION) {
      throw conflict('ALREADY_CLAIMED', 'You already claimed today’s reward. Come back after midnight IST.');
    }
    throw error;
  }
}
