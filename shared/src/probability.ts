import type { Outcome } from './constants';

/**
 * Probability profile values, in whole percent. They must always total 100.
 * The names match the admin API contract (PUT /api/admin/players/:id/probability).
 */
export interface Chances {
  winChance: number;
  smallWinChance: number;
  bigWinChance: number;
  lossChance: number;
}

export interface PresetProfile extends Chances {
  name: string;
  description: string;
}

export const PRESET_PROFILES: readonly PresetProfile[] = [
  { name: 'Very Low', description: 'Mostly losses. Stress-tests low balances.', winChance: 20, smallWinChance: 15, bigWinChance: 5, lossChance: 60 },
  { name: 'Low', description: 'Below-average returns.', winChance: 35, smallWinChance: 20, bigWinChance: 5, lossChance: 40 },
  { name: 'Normal', description: 'Default simulation profile.', winChance: 45, smallWinChance: 25, bigWinChance: 5, lossChance: 25 },
  { name: 'High', description: 'Never loses. Tests payout paths.', winChance: 60, smallWinChance: 30, bigWinChance: 10, lossChance: 0 },
];

export const DEFAULT_PROFILE_NAME = 'Normal';

export const PROBABILITY_TOTAL_ERROR = 'Probability must equal 100%.';

/** Order in which outcome ranges are laid out on the 0–100 number line (PRD §16). */
export const RANGE_ORDER: readonly Outcome[] = ['LOSS', 'WIN', 'SMALL_WIN', 'BIG_WIN'];

export function chanceFor(chances: Chances, outcome: Outcome): number {
  switch (outcome) {
    case 'LOSS':
      return chances.lossChance;
    case 'SMALL_WIN':
      return chances.smallWinChance;
    case 'WIN':
      return chances.winChance;
    case 'BIG_WIN':
      return chances.bigWinChance;
  }
}

export function totalChance(chances: Chances): number {
  return chances.winChance + chances.smallWinChance + chances.bigWinChance + chances.lossChance;
}

export function isValidChances(chances: Chances): boolean {
  const values = [chances.winChance, chances.smallWinChance, chances.bigWinChance, chances.lossChance];
  return values.every((v) => Number.isInteger(v) && v >= 0 && v <= 100) && totalChance(chances) === 100;
}

export interface OutcomeRange {
  outcome: Outcome;
  /** inclusive */
  from: number;
  /** exclusive */
  to: number;
}

/** Calculates the outcome ranges dynamically from the configured probabilities. */
export function buildRanges(chances: Chances): OutcomeRange[] {
  let cursor = 0;
  return RANGE_ORDER.map((outcome) => {
    const from = cursor;
    cursor += chanceFor(chances, outcome);
    return { outcome, from, to: cursor };
  });
}

/** Maps a random value in [0, 100) to an outcome using the configured ranges. */
export function outcomeForValue(chances: Chances, value: number): Outcome {
  if (!isValidChances(chances)) throw new Error(PROBABILITY_TOTAL_ERROR);
  if (!(value >= 0 && value < 100)) throw new RangeError(`Random value out of range: ${value}`);
  const range = buildRanges(chances).find((r) => value >= r.from && value < r.to);
  // Unreachable for valid chances: ranges tile [0, 100) exactly.
  if (!range) throw new Error('No outcome range matched');
  return range.outcome;
}

/**
 * Classifies a settled result by how much came back relative to the stake.
 * Games use this so the recorded outcome always matches the real payout.
 *   LOSS       payout < stake
 *   SMALL_WIN  1× – <2×   (stake back, or a small profit)
 *   WIN        2× – <5×
 *   BIG_WIN    5× and above
 */
export function classifyReturn(payout: number, staked: number): Outcome {
  if (staked <= 0) throw new RangeError('Stake must be positive');
  if (payout < staked) return 'LOSS';
  const ratio = payout / staked;
  if (ratio < 2) return 'SMALL_WIN';
  if (ratio < 5) return 'WIN';
  return 'BIG_WIN';
}

/**
 * When a game cannot produce the target outcome for a given bet (e.g. a single
 * Red bet in roulette has no "small win"), it uses the closest acceptable one:
 *  - a winning target first tries the other ordinary wins, then a loss;
 *  - a BIG_WIN is only ever paid when BIG_WIN itself was drawn, so a 36× number
 *    hit can't sneak in through a "win" target;
 *  - a LOSS target that is impossible (every result pays) takes the smallest win.
 */
export function fallbackOrder(target: Outcome): Outcome[] {
  switch (target) {
    case 'LOSS':
      return ['LOSS', 'SMALL_WIN', 'WIN', 'BIG_WIN'];
    case 'SMALL_WIN':
      return ['SMALL_WIN', 'WIN', 'LOSS', 'BIG_WIN'];
    case 'WIN':
      return ['WIN', 'SMALL_WIN', 'LOSS', 'BIG_WIN'];
    case 'BIG_WIN':
      return ['BIG_WIN', 'WIN', 'SMALL_WIN', 'LOSS'];
  }
}
