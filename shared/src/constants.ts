/**
 * Core product constants. Every amount in this system is virtual.
 * The currency code is INR_VIRTUAL — never "INR" — so the backend can never
 * confuse the simulation balance with real money.
 */
export const CURRENCY = 'INR_VIRTUAL' as const;
export type Currency = typeof CURRENCY;

export const VIRTUAL_NOTICE = 'VIRTUAL ₹ ONLY — NO CASH VALUE';
export const VIRTUAL_NOTICE_SHORT = 'Virtual ₹ only. No cash value.';

/** New accounts receive this as a recorded BONUS transaction. */
export const STARTING_BALANCE = 25_000;

/** Every bet must be a whole multiple of this, which keeps all payouts integral. */
export const BET_STEP = 10;

export const OUTCOMES = ['LOSS', 'SMALL_WIN', 'WIN', 'BIG_WIN'] as const;
export type Outcome = (typeof OUTCOMES)[number];

export const OUTCOME_LABEL: Record<Outcome, string> = {
  LOSS: 'Loss',
  SMALL_WIN: 'Small win',
  WIN: 'Win',
  BIG_WIN: 'Big win',
};

export const TRANSACTION_TYPES = ['BET', 'WIN', 'DAILY_REWARD', 'BONUS', 'ADMIN_ADJUSTMENT'] as const;
export type TransactionType = (typeof TRANSACTION_TYPES)[number];

export const TRANSACTION_FILTERS = {
  all: null,
  wins: ['WIN'],
  bets: ['BET'],
  rewards: ['DAILY_REWARD'],
  bonuses: ['BONUS', 'ADMIN_ADJUSTMENT'],
} as const satisfies Record<string, readonly TransactionType[] | null>;
export type TransactionFilter = keyof typeof TRANSACTION_FILTERS;

export const USER_ROLES = ['player', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['active', 'suspended'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Daily reward amounts by streak day (day 7+ repeats the last value). */
export const DAILY_REWARD_LADDER = [500, 750, 1000, 1250, 1500, 1750, 2500] as const;
export const DAILY_REWARD_TIMEZONE = 'Asia/Kolkata';

export const BET_CHIPS = [100, 250, 500, 1000, 2500, 5000] as const;

export const AVATARS = ['🦚', '🐯', '🐘', '🪷', '🌙', '⭐', '🎲', '👑'] as const;

/** Sessions: how long a login lasts. */
export const SESSION_TTL_DAYS = 14;

/** Default "take a break?" reminder interval, in minutes. */
export const DEFAULT_BREAK_REMINDER_MINUTES = 30;
