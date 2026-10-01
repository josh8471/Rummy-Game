import { randomInt } from 'node:crypto';

/** Source of randomness for game engines. Production uses the OS CSPRNG; tests use a seed. */
export interface Rng {
  /** Uniform integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
}

export const cryptoRng: Rng = {
  int: (maxExclusive) => randomInt(maxExclusive),
};

/** Deterministic mulberry32 generator — for tests only. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    int(maxExclusive) {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      const float = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      return Math.floor(float * maxExclusive);
    },
  };
}

/** The PRD's "random value": 0.00–99.99 with two decimals. */
export function drawRandomValue(rng: Rng): number {
  return rng.int(10_000) / 100;
}

export function pick<T>(items: readonly T[], rng: Rng): T {
  if (items.length === 0) throw new Error('pick() from empty list');
  return items[rng.int(items.length)]!;
}

export function pickWeighted<T>(items: readonly (readonly [T, number])[], rng: Rng): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let roll = rng.int(total);
  for (const [item, weight] of items) {
    if (roll < weight) return item;
    roll -= weight;
  }
  return items[items.length - 1]![0];
}

/** Fisher–Yates shuffle; returns a new array. */
export function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
