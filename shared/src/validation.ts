import { z } from 'zod';
import { AVATARS, BET_STEP, TRANSACTION_FILTERS, USER_STATUSES } from './constants';
import { ANDAR_BAHAR_SIDES, BLACKJACK_ACTIONS, DICE_BET_TYPES, type GameId } from './games';
import { PROBABILITY_TOTAL_ERROR, totalChance } from './probability';

/*
 * Request schemas are strict: unknown keys are rejected. A client that tries to
 * send `balance`, `payout`, `outcome` or `probability` gets a 400, and those
 * values are never read from the client anyway.
 */

const MAX_AMOUNT = 10_000_000;

export const betAmountSchema = z
  .number('Bet must be a number')
  .int('Bet must be a whole number of rupees')
  .min(BET_STEP, `Minimum bet is ₹${BET_STEP}`)
  .max(MAX_AMOUNT)
  .multipleOf(BET_STEP, `Bet must be a multiple of ₹${BET_STEP}`);

/* ─────────────── Auth ─────────────── */

export const registerSchema = z.strictObject({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Use letters, numbers and underscores only'),
  email: z.email('Enter a valid email address').max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  avatar: z.enum(AVATARS).optional(),
});
export type RegisterRequest = z.infer<typeof registerSchema>;

export const loginSchema = z.strictObject({
  username: z.string().trim().min(1, 'Enter your username or email').max(254),
  password: z.string().min(1, 'Enter your password').max(128),
});
export type LoginRequest = z.infer<typeof loginSchema>;

/* ─────────────── Game play ─────────────── */

const sumMatches = (v: { betAmount: number; bets: { amount: number }[] }) =>
  v.bets.reduce((s, b) => s + b.amount, 0) === v.betAmount;
const SUM_MESSAGE = { message: 'betAmount must equal the total of your bets', path: ['betAmount'] };

export const rouletteBetSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.enum(['RED', 'BLACK', 'ODD', 'EVEN']), amount: betAmountSchema }),
  z.strictObject({ type: z.literal('NUMBER'), value: z.number().int().min(0).max(36), amount: betAmountSchema }),
  z.strictObject({ type: z.enum(['DOZEN', 'COLUMN']), value: z.number().int().min(1).max(3), amount: betAmountSchema }),
]);
export type RouletteBet = z.infer<typeof rouletteBetSchema>;

export const diceBetSchema = z.strictObject({ type: z.enum(DICE_BET_TYPES), amount: betAmountSchema });
export type DiceBet = z.infer<typeof diceBetSchema>;

export const playSchemas = {
  slots: z.strictObject({ betAmount: betAmountSchema }),
  roulette: z
    .strictObject({ betAmount: betAmountSchema, bets: z.array(rouletteBetSchema).min(1, 'Place at least one bet').max(60) })
    .refine(sumMatches, SUM_MESSAGE),
  blackjack: z.strictObject({ betAmount: betAmountSchema }),
  'teen-patti': z.strictObject({ betAmount: betAmountSchema }),
  'andar-bahar': z.strictObject({ betAmount: betAmountSchema, side: z.enum(ANDAR_BAHAR_SIDES) }),
  dice: z
    .strictObject({ betAmount: betAmountSchema, bets: z.array(diceBetSchema).min(1, 'Place at least one bet').max(3) })
    .refine(sumMatches, SUM_MESSAGE)
    .refine((v) => new Set(v.bets.map((b) => b.type)).size === v.bets.length, {
      message: 'Each option can only be backed once per roll',
      path: ['bets'],
    }),
  poker: z.strictObject({ betAmount: betAmountSchema }),
} satisfies Record<GameId, z.ZodType>;

export type PlayRequest<G extends GameId = GameId> = z.infer<(typeof playSchemas)[G]>;

export const seqSchema = z.number().int().min(0);

export const blackjackActionSchema = z.strictObject({ action: z.enum(BLACKJACK_ACTIONS), seq: seqSchema });
export type BlackjackActionRequest = z.infer<typeof blackjackActionSchema>;

export const pokerActionSchema = z.strictObject({
  action: z.literal('DRAW'),
  holds: z.array(z.boolean()).length(5),
  seq: seqSchema,
});
export type PokerActionRequest = z.infer<typeof pokerActionSchema>;

/* ─────────────── Queries ─────────────── */

export const cursorQuerySchema = z.object({
  cursor: z.string().regex(/^\d+$/).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const transactionQuerySchema = cursorQuerySchema.extend({
  filter: z.enum(Object.keys(TRANSACTION_FILTERS) as [keyof typeof TRANSACTION_FILTERS]).default('all'),
});

/* ─────────────── Admin ─────────────── */

const percent = z.number('Enter a number').int('Use whole percentages').min(0, 'Minimum is 0%').max(100, 'Maximum is 100%');
export const reasonSchema = z.string().trim().min(3, 'Please give a reason (at least 3 characters)').max(500);

/** Either assign an existing profile, or send four chances that total exactly 100. */
export const setProbabilitySchema = z
  .strictObject({
    profileId: z.number().int().positive().optional(),
    winChance: percent.optional(),
    smallWinChance: percent.optional(),
    bigWinChance: percent.optional(),
    lossChance: percent.optional(),
    reason: reasonSchema,
  })
  .superRefine((v, ctx) => {
    const chances = [v.winChance, v.smallWinChance, v.bigWinChance, v.lossChance];
    const given = chances.filter((c) => c !== undefined).length;
    if (v.profileId !== undefined) {
      if (given > 0) ctx.addIssue({ code: 'custom', message: 'Send either profileId or chances, not both' });
      return;
    }
    if (given !== 4) {
      ctx.addIssue({ code: 'custom', message: 'Send profileId, or all four chances' });
      return;
    }
    const total = chances.reduce<number>((s, c) => s + (c ?? 0), 0);
    if (total !== 100) ctx.addIssue({ code: 'custom', message: PROBABILITY_TOTAL_ERROR, path: ['total'] });
  });
export type SetProbabilityRequest = z.infer<typeof setProbabilitySchema>;

export const profileUpsertSchema = z
  .strictObject({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(40),
    description: z.string().trim().max(200).default(''),
    winChance: percent,
    smallWinChance: percent,
    bigWinChance: percent,
    lossChance: percent,
    reason: reasonSchema,
  })
  .refine((v) => totalChance(v) === 100, { message: PROBABILITY_TOTAL_ERROR, path: ['total'] });
export type ProfileUpsertRequest = z.infer<typeof profileUpsertSchema>;

export const gameUpdateSchema = z
  .strictObject({ enabled: z.boolean(), minBet: betAmountSchema, maxBet: betAmountSchema, reason: reasonSchema })
  .refine((v) => v.minBet <= v.maxBet, { message: 'Minimum bet cannot exceed maximum bet', path: ['minBet'] });
export type GameUpdateRequest = z.infer<typeof gameUpdateSchema>;

export const playerStatusSchema = z.strictObject({ status: z.enum(USER_STATUSES), reason: reasonSchema });
export type PlayerStatusRequest = z.infer<typeof playerStatusSchema>;

export const balanceAdjustmentSchema = z.strictObject({
  amount: z
    .number('Enter an amount')
    .int('Use whole rupees')
    .min(-MAX_AMOUNT)
    .max(MAX_AMOUNT)
    .refine((n) => n !== 0, 'Amount cannot be zero'),
  reason: reasonSchema,
});
export type BalanceAdjustmentRequest = z.infer<typeof balanceAdjustmentSchema>;
