import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/*
 * Schema follows PRD §27, plus a few supporting tables (sessions, daily_rewards,
 * security_events). Enum lists are inlined so drizzle-kit can load this file
 * without resolving workspace packages.
 *
 * Money columns are bigint whole rupees of INR_VIRTUAL. The database itself
 * enforces the wallet invariants: balances never go negative and every ledger
 * row satisfies balance_before + amount = balance_after.
 */

const OUTCOME_VALUES = ['LOSS', 'SMALL_WIN', 'WIN', 'BIG_WIN'] as const;
const TX_TYPE_VALUES = ['BET', 'WIN', 'DAILY_REWARD', 'BONUS', 'ADMIN_ADJUSTMENT'] as const;

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();
const money = (name: string) => bigint(name, { mode: 'number' });

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    username: text('username').notNull(),
    email: text('email').notNull(),
    avatar: text('avatar').notNull().default('🦚'),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: ['player', 'admin'] }).notNull().default('player'),
    status: text('status', { enum: ['active', 'suspended'] }).notNull().default('active'),
    xp: integer('xp').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('users_username_lower_idx').on(sql`lower(${t.username})`),
    uniqueIndex('users_email_lower_idx').on(sql`lower(${t.email})`),
    check('users_role_check', sql`${t.role} in ('player', 'admin')`),
    check('users_status_check', sql`${t.status} in ('active', 'suspended')`),
    check('users_xp_check', sql`${t.xp} >= 0`),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 of the session token; the raw token only ever lives in the cookie. */
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const wallets = pgTable(
  'wallets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id),
    virtualBalance: money('virtual_balance').notNull().default(0),
    currency: text('currency').notNull().default('INR_VIRTUAL'),
    updatedAt: updatedAt(),
  },
  (t) => [
    check('wallets_balance_non_negative', sql`${t.virtualBalance} >= 0`),
    check('wallets_currency_virtual', sql`${t.currency} = 'INR_VIRTUAL'`),
  ],
);

export const probabilityProfiles = pgTable(
  'probability_profiles',
  {
    id: serial('id').primaryKey(),
    name: text('name').notNull().unique(),
    description: text('description').notNull().default(''),
    winProbability: integer('win_probability').notNull(),
    smallWinProbability: integer('small_win_probability').notNull(),
    bigWinProbability: integer('big_win_probability').notNull(),
    lossProbability: integer('loss_probability').notNull(),
    isSystem: boolean('is_system').notNull().default(false),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      'probability_profiles_total_100',
      sql`${t.winProbability} + ${t.smallWinProbability} + ${t.bigWinProbability} + ${t.lossProbability} = 100`,
    ),
    check(
      'probability_profiles_range',
      sql`${t.winProbability} between 0 and 100 and ${t.smallWinProbability} between 0 and 100 and ${t.bigWinProbability} between 0 and 100 and ${t.lossProbability} between 0 and 100`,
    ),
  ],
);

export const userProbabilityProfiles = pgTable('user_probability_profiles', {
  id: serial('id').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => users.id),
  profileId: integer('profile_id')
    .notNull()
    .references(() => probabilityProfiles.id),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: updatedAt(),
});

export const games = pgTable(
  'games',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: text('type', { enum: ['instant', 'interactive'] }).notNull(),
    enabled: boolean('enabled').notNull().default(true),
    minBet: integer('min_bet').notNull(),
    maxBet: integer('max_bet').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [check('games_bet_limits', sql`${t.minBet} > 0 and ${t.minBet} <= ${t.maxBet}`)],
);

export const gameRounds = pgTable(
  'game_rounds',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity({ startWith: 10001 }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    gameId: text('game_id')
      .notNull()
      .references(() => games.id),
    /** Total virtual stake, including doubles and splits. */
    betAmount: money('bet_amount').notNull(),
    /** 0.00–99.99, drawn server-side. */
    randomValue: doublePrecision('random_value').notNull(),
    /** Outcome selected by the probability engine. */
    targetOutcome: text('target_outcome', { enum: OUTCOME_VALUES }).notNull(),
    /** Outcome actually produced by the game (null while in progress). */
    outcome: text('outcome', { enum: OUTCOME_VALUES }),
    payout: money('payout'),
    probabilityProfileId: integer('probability_profile_id')
      .notNull()
      .references(() => probabilityProfiles.id),
    /** Copy of the chances used, so later profile edits never rewrite history. */
    probabilitySnapshot: jsonb('probability_snapshot').notNull(),
    status: text('status', { enum: ['IN_PROGRESS', 'SETTLED'] }).notNull(),
    seq: integer('seq').notNull().default(0),
    /** Server-only game state for interactive rounds (deck, target). Never sent to clients. */
    state: jsonb('state'),
    /** Public result detail, safe to show the player. */
    detail: jsonb('detail'),
    summary: text('summary').notNull().default(''),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: createdAt(),
    settledAt: timestamp('settled_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('game_rounds_idempotency_idx').on(t.userId, t.idempotencyKey),
    uniqueIndex('game_rounds_one_active_idx').on(t.userId, t.gameId).where(sql`${t.status} = 'IN_PROGRESS'`),
    index('game_rounds_user_created_idx').on(t.userId, t.id),
    index('game_rounds_created_idx').on(t.createdAt),
    check('game_rounds_bet_positive', sql`${t.betAmount} > 0`),
    check('game_rounds_payout_non_negative', sql`${t.payout} is null or ${t.payout} >= 0`),
    check('game_rounds_random_range', sql`${t.randomValue} >= 0 and ${t.randomValue} < 100`),
  ],
);

export const walletTransactions = pgTable(
  'wallet_transactions',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    roundId: bigint('round_id', { mode: 'number' }).references(() => gameRounds.id),
    type: text('type', { enum: TX_TYPE_VALUES }).notNull(),
    amount: money('amount').notNull(),
    balanceBefore: money('balance_before').notNull(),
    balanceAfter: money('balance_after').notNull(),
    currency: text('currency').notNull().default('INR_VIRTUAL'),
    description: text('description').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('wallet_transactions_user_idx').on(t.userId, t.id),
    check('wallet_transactions_math', sql`${t.balanceBefore} + ${t.amount} = ${t.balanceAfter}`),
    check('wallet_transactions_non_negative', sql`${t.balanceAfter} >= 0`),
    check('wallet_transactions_nonzero', sql`${t.amount} <> 0`),
    check('wallet_transactions_currency_virtual', sql`${t.currency} = 'INR_VIRTUAL'`),
  ],
);

export const adminAuditLogs = pgTable(
  'admin_audit_logs',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    adminId: uuid('admin_id')
      .notNull()
      .references(() => users.id),
    action: text('action').notNull(),
    targetUserId: uuid('target_user_id').references(() => users.id),
    oldValue: jsonb('old_value'),
    newValue: jsonb('new_value'),
    reason: text('reason').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('admin_audit_logs_created_idx').on(t.id)],
);

export const dailyRewards = pgTable(
  'daily_rewards',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    /** Calendar day in IST. */
    rewardDate: date('reward_date', { mode: 'string' }).notNull(),
    streak: integer('streak').notNull(),
    amount: integer('amount').notNull(),
    transactionId: bigint('transaction_id', { mode: 'number' })
      .notNull()
      .references(() => walletTransactions.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('daily_rewards_user_date_idx').on(t.userId, t.rewardDate)],
);

export const securityEvents = pgTable(
  'security_events',
  {
    id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
    userId: uuid('user_id').references(() => users.id),
    ip: text('ip'),
    type: text('type').notNull(),
    detail: text('detail').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('security_events_created_idx').on(t.id)],
);
