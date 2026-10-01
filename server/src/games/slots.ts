import {
  classifyReturn,
  SLOT_LEFT_PAIR_RETURN,
  SLOT_SYMBOL_INFO,
  SLOT_SYMBOLS,
  SLOT_THREE_OF_A_KIND,
  type SlotsDetail,
  type SlotSymbol,
} from '@casino/shared';
import { pick, pickWeighted, type Rng } from '../lib/rng';
import { payoutFor, type InstantEngine } from './engine';

type SlotsBet = { betAmount: number };

/** Which three-of-a-kind combinations belong to each winning tier, with relative weights. */
const THREE_OF_A_KIND_BY_TIER = {
  BIG_WIN: [
    ['SEVEN', 1],
    ['BAR', 3],
    ['BELL', 6],
  ],
  WIN: [
    ['GRAPES', 2],
    ['LEMON', 3],
    ['CHERRY', 4],
  ],
} as const satisfies Record<string, readonly (readonly [SlotSymbol, number])[]>;

export function evaluatePayline(line: readonly SlotSymbol[]): SlotsDetail['win'] {
  const [a, b, c] = line;
  if (a === b && b === c) return { kind: 'THREE', symbol: a!, multiplier: SLOT_THREE_OF_A_KIND[a!] };
  if (a === b) return { kind: 'PAIR', symbol: a!, multiplier: SLOT_LEFT_PAIR_RETURN };
  return null;
}

function otherSymbol(exclude: SlotSymbol, rng: Rng): SlotSymbol {
  return pick(
    SLOT_SYMBOLS.filter((s) => s !== exclude),
    rng,
  );
}

function paylineFor(target: keyof typeof THREE_OF_A_KIND_BY_TIER | 'SMALL_WIN' | 'LOSS', rng: Rng): SlotSymbol[] {
  switch (target) {
    case 'BIG_WIN':
    case 'WIN': {
      const symbol = pickWeighted(THREE_OF_A_KIND_BY_TIER[target], rng);
      return [symbol, symbol, symbol];
    }
    case 'SMALL_WIN': {
      const symbol = pick(SLOT_SYMBOLS, rng);
      return [symbol, symbol, otherSymbol(symbol, rng)];
    }
    case 'LOSS': {
      const first = pick(SLOT_SYMBOLS, rng);
      return [first, otherSymbol(first, rng), pick(SLOT_SYMBOLS, rng)];
    }
  }
}

/** Decorative rows above and below the payline; avoid accidental three-of-a-kinds there. */
function fillerRow(rng: Rng): SlotSymbol[] {
  for (;;) {
    const row = [pick(SLOT_SYMBOLS, rng), pick(SLOT_SYMBOLS, rng), pick(SLOT_SYMBOLS, rng)];
    if (!(row[0] === row[1] && row[1] === row[2])) return row;
  }
}

export const slotsEngine: InstantEngine<SlotsBet, SlotsDetail> = {
  kind: 'instant',
  stake: (bet) => bet.betAmount,
  resolve(bet, target, rng) {
    const payline = paylineFor(target, rng);
    const top = fillerRow(rng);
    const bottom = fillerRow(rng);
    const grid = [0, 1, 2].map((reel) => [top[reel]!, payline[reel]!, bottom[reel]!]);
    const win = evaluatePayline(payline);
    const payout = win ? payoutFor(bet.betAmount, win.multiplier) : 0;
    return {
      payout,
      outcome: classifyReturn(payout, bet.betAmount),
      detail: { grid, payline, win },
      summary: payline.map((s) => SLOT_SYMBOL_INFO[s].glyph).join(' '),
    };
  },
};
