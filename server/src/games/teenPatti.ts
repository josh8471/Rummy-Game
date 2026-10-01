import {
  rankIndex,
  suitIndex,
  TEEN_PATTI_HAND_LABEL,
  TEEN_PATTI_HANDS,
  TEEN_PATTI_TIE_RETURN,
  TEEN_PATTI_WIN_RETURN,
  type TeenPattiDetail,
  type TeenPattiHand,
} from '@casino/shared';
import type { Rng } from '../lib/rng';
import { toCards } from './deck';
import { byReturn, payoutFor, sampleByTier, type InstantEngine } from './engine';

type TeenPattiBet = { betAmount: number };

export interface TeenPattiEval {
  hand: TeenPattiHand;
  /** Tie-break values, compared left to right. */
  score: number[];
}

/**
 * Standard Teen Patti ranking. For sequences, A-K-Q is highest and A-2-3 is
 * second highest; sequence values are doubled so A-2-3 can sit between them.
 */
export function evaluateTeenPatti(cards: readonly number[]): TeenPattiEval {
  const ranks = cards.map(rankIndex).sort((x, y) => y - x);
  const [a, b, c] = ranks as [number, number, number];
  const suits = cards.map(suitIndex);
  const color = suits[0] === suits[1] && suits[1] === suits[2];

  if (a === b && b === c) return { hand: 'TRAIL', score: [a] };

  let sequence: number | null = null;
  if (a - b === 1 && b - c === 1) sequence = a * 2;
  else if (a === 12 && b === 1 && c === 0) sequence = 23; // A-2-3

  if (sequence !== null) return { hand: color ? 'PURE_SEQUENCE' : 'SEQUENCE', score: [sequence] };
  if (color) return { hand: 'COLOR', score: ranks };
  if (a === b || b === c) return { hand: 'PAIR', score: [b, a === b ? c : a] };
  return { hand: 'HIGH_CARD', score: ranks };
}

/** Positive when x beats y, negative when y wins, 0 for an exact tie. */
export function compareTeenPatti(x: TeenPattiEval, y: TeenPattiEval): number {
  const byCategory = TEEN_PATTI_HANDS.indexOf(x.hand) - TEEN_PATTI_HANDS.indexOf(y.hand);
  if (byCategory !== 0) return byCategory;
  for (let i = 0; i < Math.max(x.score.length, y.score.length); i++) {
    const diff = (x.score[i] ?? 0) - (y.score[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Draws n distinct cards from a fresh deck (partial Fisher–Yates). */
export function dealDistinct(n: number, rng: Rng): number[] {
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 0; i < n; i++) {
    const j = i + rng.int(52 - i);
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck.slice(0, n);
}

export const teenPattiEngine: InstantEngine<TeenPattiBet, TeenPattiDetail> = {
  kind: 'instant',
  stake: (bet) => bet.betAmount,
  resolve(bet, target, rng) {
    const { pick, outcome } = sampleByTier(
      () => {
        const cards = dealDistinct(6, rng);
        const player = cards.slice(0, 3);
        const dealer = cards.slice(3);
        const playerEval = evaluateTeenPatti(player);
        const dealerEval = evaluateTeenPatti(dealer);
        const cmp = compareTeenPatti(playerEval, dealerEval);
        const winner = cmp > 0 ? 'PLAYER' : cmp < 0 ? 'DEALER' : 'TIE';
        const multiplier =
          winner === 'PLAYER' ? TEEN_PATTI_WIN_RETURN[playerEval.hand] : winner === 'TIE' ? TEEN_PATTI_TIE_RETURN : 0;
        return { player, dealer, playerEval, dealerEval, winner, multiplier, payout: payoutFor(bet.betAmount, multiplier) } as const;
      },
      byReturn(bet.betAmount),
      target,
    );
    const playerLabel = TEEN_PATTI_HAND_LABEL[pick.playerEval.hand];
    const dealerLabel = TEEN_PATTI_HAND_LABEL[pick.dealerEval.hand];
    return {
      payout: pick.payout,
      outcome,
      detail: {
        player: { cards: toCards(pick.player), hand: pick.playerEval.hand, label: playerLabel },
        dealer: { cards: toCards(pick.dealer), hand: pick.dealerEval.hand, label: dealerLabel },
        winner: pick.winner,
        multiplier: pick.multiplier,
      },
      summary:
        pick.winner === 'TIE'
          ? `Tie · ${playerLabel}`
          : `${pick.winner === 'PLAYER' ? 'You win' : 'Dealer wins'} · ${playerLabel} vs ${dealerLabel}`,
    };
  },
};
