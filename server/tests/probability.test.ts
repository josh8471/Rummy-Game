import {
  buildRanges,
  classifyReturn,
  fallbackOrder,
  isValidChances,
  OUTCOMES,
  outcomeForValue,
  PRESET_PROFILES,
  PROBABILITY_TOTAL_ERROR,
  profileUpsertSchema,
  setProbabilitySchema,
  totalChance,
  type Chances,
  type Outcome,
} from '@casino/shared';
import { describe, expect, it } from 'vitest';
import { cryptoRng, drawRandomValue } from '../src/lib/rng';

const chances = (winChance: number, smallWinChance: number, bigWinChance: number, lossChance: number): Chances => ({
  winChance,
  smallWinChance,
  bigWinChance,
  lossChance,
});

describe('probability profiles (PRD §15, §43)', () => {
  it('every preset profile totals exactly 100%', () => {
    for (const profile of PRESET_PROFILES) {
      expect(totalChance(profile), profile.name).toBe(100);
      expect(isValidChances(profile)).toBe(true);
    }
  });

  it('accepts 20 + 15 + 5 + 60 = 100', () => {
    expect(isValidChances(chances(20, 15, 5, 60))).toBe(true);
    const parsed = setProbabilitySchema.safeParse({ winChance: 20, smallWinChance: 15, bigWinChance: 5, lossChance: 60, reason: 'test' });
    expect(parsed.success).toBe(true);
  });

  it('rejects 45 + 25 + 5 + 30 = 105', () => {
    expect(isValidChances(chances(45, 25, 5, 30))).toBe(false);
    const parsed = setProbabilitySchema.safeParse({ winChance: 45, smallWinChance: 25, bigWinChance: 5, lossChance: 30, reason: 'test' });
    expect(parsed.success).toBe(false);
    expect(parsed.error!.issues[0]!.message).toBe(PROBABILITY_TOTAL_ERROR);

    const profile = profileUpsertSchema.safeParse({ name: 'Bad', winChance: 45, smallWinChance: 25, bigWinChance: 5, lossChance: 30, reason: 'test' });
    expect(profile.success).toBe(false);
  });

  it('rejects negative, fractional and >100 values', () => {
    expect(isValidChances(chances(110, 0, 0, -10))).toBe(false);
    expect(isValidChances(chances(45.5, 24.5, 5, 25))).toBe(false);
  });

  it('computes outcome ranges dynamically (PRD §16)', () => {
    expect(buildRanges(chances(45, 25, 5, 25))).toEqual([
      { outcome: 'LOSS', from: 0, to: 25 },
      { outcome: 'WIN', from: 25, to: 70 },
      { outcome: 'SMALL_WIN', from: 70, to: 95 },
      { outcome: 'BIG_WIN', from: 95, to: 100 },
    ]);
  });

  it('maps random values to outcomes at the range boundaries', () => {
    const normal = chances(45, 25, 5, 25);
    expect(outcomeForValue(normal, 0)).toBe('LOSS');
    expect(outcomeForValue(normal, 24.99)).toBe('LOSS');
    expect(outcomeForValue(normal, 25)).toBe('WIN');
    expect(outcomeForValue(normal, 37.82)).toBe('WIN');
    expect(outcomeForValue(normal, 70)).toBe('SMALL_WIN');
    expect(outcomeForValue(normal, 95)).toBe('BIG_WIN');
    expect(outcomeForValue(normal, 99.99)).toBe('BIG_WIN');
    // High has a zero-width loss range.
    expect(outcomeForValue(chances(60, 30, 10, 0), 0)).toBe('WIN');
    expect(() => outcomeForValue(chances(45, 25, 5, 30), 10)).toThrow(PROBABILITY_TOTAL_ERROR);
    expect(() => outcomeForValue(normal, 100)).toThrow();
  });

  it('realised distribution matches the configured profile (100k draws)', () => {
    const profile = chances(35, 20, 5, 40);
    const counts = Object.fromEntries(OUTCOMES.map((o) => [o, 0])) as Record<Outcome, number>;
    const N = 100_000;
    for (let i = 0; i < N; i++) counts[outcomeForValue(profile, drawRandomValue(cryptoRng))]++;
    expect(counts.WIN / N).toBeCloseTo(0.35, 1);
    expect(counts.SMALL_WIN / N).toBeCloseTo(0.2, 1);
    expect(counts.BIG_WIN / N).toBeCloseTo(0.05, 1);
    expect(counts.LOSS / N).toBeCloseTo(0.4, 1);
  });

  it('random values stay within 0.00–99.99', () => {
    for (let i = 0; i < 10_000; i++) {
      const v = drawRandomValue(cryptoRng);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(100);
      expect(Math.abs(Math.round(v * 100) - v * 100)).toBeLessThan(1e-9);
    }
  });
});

describe('return classification and fallbacks', () => {
  it('classifies by return relative to stake', () => {
    expect(classifyReturn(0, 100)).toBe('LOSS');
    expect(classifyReturn(90, 100)).toBe('LOSS');
    expect(classifyReturn(100, 100)).toBe('SMALL_WIN');
    expect(classifyReturn(150, 100)).toBe('SMALL_WIN');
    expect(classifyReturn(200, 100)).toBe('WIN');
    expect(classifyReturn(490, 100)).toBe('WIN');
    expect(classifyReturn(500, 100)).toBe('BIG_WIN');
    expect(classifyReturn(3600, 100)).toBe('BIG_WIN');
  });

  it('never upgrades a non-big target to BIG_WIN before trying a loss', () => {
    for (const target of ['LOSS', 'SMALL_WIN', 'WIN'] as const) {
      const order = fallbackOrder(target);
      expect(order[0]).toBe(target);
      expect(order.indexOf('BIG_WIN')).toBe(3);
      expect(new Set(order).size).toBe(4);
    }
    expect(fallbackOrder('BIG_WIN')).toEqual(['BIG_WIN', 'WIN', 'SMALL_WIN', 'LOSS']);
  });
});
