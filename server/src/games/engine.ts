import { classifyReturn, fallbackOrder, type Outcome } from '@casino/shared';
import type { Rng } from '../lib/rng';

/*
 * How the probability engine and the game rules fit together:
 *
 * 1. The probability engine draws a *target* outcome (LOSS / SMALL_WIN / WIN /
 *    BIG_WIN) from the player's simulation profile.
 * 2. The game engine produces a result that is legal under the game's own rules
 *    and, where possible, lands in that target tier. Payouts always come from
 *    the game's paytable — never from the tier.
 * 3. If the bet makes the target impossible (e.g. a single Red bet can never be
 *    a 25× "big win"), the engine uses the closest achievable tier.
 *
 * Both the target and the actual outcome are stored on every round, so admins
 * can compare configured vs realised distributions.
 */

export interface Settlement {
  payout: number;
  outcome: Outcome;
  summary: string;
}

export interface InstantResolution<D> extends Settlement {
  detail: D;
}

export interface InstantEngine<B, D> {
  kind: 'instant';
  stake(bet: B): number;
  resolve(bet: B, target: Outcome, rng: Rng): InstantResolution<D>;
}

export interface InteractiveStep<S> {
  state: S;
  /** Extra stake this step requires (double / split), debited by the round service. */
  additionalStake: number;
  settlement: Settlement | null;
}

export interface InteractiveEngine<S, A, V> {
  kind: 'interactive';
  start(betAmount: number, target: Outcome, rng: Rng): InteractiveStep<S>;
  act(state: S, action: A, rng: Rng): InteractiveStep<S>;
  /** The player-safe view of the state (no deck, no target). */
  view(state: S): V;
}

/** Converts a return multiplier into whole virtual rupees. */
export function payoutFor(stake: number, multiplier: number): number {
  return Math.round(stake * multiplier);
}

type Classifier<T> = (candidate: T) => Outcome;

/**
 * Picks uniformly among all candidates whose outcome matches the target tier,
 * falling back to the nearest tier that has candidates.
 */
export function pickByTier<T>(candidates: readonly T[], classify: Classifier<T>, target: Outcome, rng: Rng) {
  const buckets = new Map<Outcome, T[]>();
  for (const candidate of candidates) {
    const outcome = classify(candidate);
    const bucket = buckets.get(outcome);
    if (bucket) bucket.push(candidate);
    else buckets.set(outcome, [candidate]);
  }
  for (const outcome of fallbackOrder(target)) {
    const bucket = buckets.get(outcome);
    if (bucket?.length) return { pick: bucket[rng.int(bucket.length)]!, outcome };
  }
  throw new Error('pickByTier: no candidates');
}

/**
 * For games with too many possible results to enumerate (card deals), draws
 * random legal results until one lands in the target tier. Keeps the first
 * example of every other tier as a fallback.
 */
export function sampleByTier<T>(generate: () => T, classify: Classifier<T>, target: Outcome, maxTries = 20_000) {
  const seen = new Map<Outcome, T>();
  for (let i = 0; i < maxTries; i++) {
    const candidate = generate();
    const outcome = classify(candidate);
    if (outcome === target) return { pick: candidate, outcome };
    if (!seen.has(outcome)) seen.set(outcome, candidate);
  }
  for (const outcome of fallbackOrder(target)) {
    const candidate = seen.get(outcome);
    if (candidate !== undefined) return { pick: candidate, outcome };
  }
  throw new Error('sampleByTier: generator produced nothing');
}

export const byReturn =
  (stake: number) =>
  <T extends { payout: number }>(candidate: T): Outcome =>
    classifyReturn(candidate.payout, stake);
