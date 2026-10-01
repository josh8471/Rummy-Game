import {
  POKER_HAND_LABEL,
  POKER_PAYTABLE,
  rankIndex,
  suitIndex,
  type Outcome,
  type PokerActionRequest,
  type PokerHand,
  type PokerState,
} from '@casino/shared';
import { badRequest } from '../lib/errors';
import { shuffledDeck, toCards } from './deck';
import { byReturn, payoutFor, sampleByTier, type InteractiveEngine } from './engine';

export interface PokerInternal {
  /** Cards remaining in the deck (server-only). */
  deck: number[];
  cards: number[];
  held: boolean[];
  phase: 'HOLD' | 'DONE';
  /** Probability-engine target (server-only). */
  target: Outcome;
  bet: number;
}

const JACK = 9;
const TEN = 8;
const ACE = 12;

export function evaluatePoker(cards: readonly number[]): PokerHand {
  const ranks = cards.map(rankIndex);
  const flush = cards.every((c) => suitIndex(c) === suitIndex(cards[0]!));
  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const groups = [...counts.entries()].sort((x, y) => y[1] - x[1] || y[0] - x[0]);
  const unique = [...counts.keys()].sort((x, y) => x - y);
  const wheel = unique.join(',') === '0,1,2,3,12';
  const straight = unique.length === 5 && (unique[4]! - unique[0]! === 4 || wheel);

  if (straight && flush) return unique[0] === TEN && unique[4] === ACE ? 'ROYAL_FLUSH' : 'STRAIGHT_FLUSH';
  if (groups[0]![1] === 4) return 'FOUR_OF_A_KIND';
  if (groups[0]![1] === 3 && groups[1]![1] === 2) return 'FULL_HOUSE';
  if (flush) return 'FLUSH';
  if (straight) return 'STRAIGHT';
  if (groups[0]![1] === 3) return 'THREE_OF_A_KIND';
  if (groups[0]![1] === 2 && groups[1]![1] === 2) return 'TWO_PAIR';
  if (groups[0]![1] === 2 && groups[0]![0] >= JACK) return 'JACKS_OR_BETTER';
  return 'NOTHING';
}

export const pokerEngine: InteractiveEngine<PokerInternal, PokerActionRequest, PokerState> = {
  kind: 'interactive',

  start(betAmount, target, rng) {
    const deck = shuffledDeck(rng);
    const cards = deck.splice(0, 5);
    return {
      state: { deck, cards, held: [false, false, false, false, false], phase: 'HOLD', target, bet: betAmount },
      additionalStake: 0,
      settlement: null,
    };
  },

  act(state, action, rng) {
    if (state.phase !== 'HOLD') throw badRequest('ROUND_FINISHED', 'This hand is already finished.');
    const replace = action.holds.flatMap((held, i) => (held ? [] : [i]));

    // The replacement cards are a legal draw from the remaining deck, chosen to
    // land in the target tier when the held cards allow it.
    const { pick, outcome } = sampleByTier(
      () => {
        const used = new Set<number>();
        const final = state.cards.slice();
        for (const slot of replace) {
          let i: number;
          do i = rng.int(state.deck.length);
          while (used.has(i));
          used.add(i);
          final[slot] = state.deck[i]!;
        }
        const hand = evaluatePoker(final);
        return { final, used, hand, payout: payoutFor(state.bet, POKER_PAYTABLE[hand]) };
      },
      byReturn(state.bet),
      state.target,
      replace.length === 0 ? 1 : 20_000,
    );

    const deck = state.deck.filter((_, i) => !pick.used.has(i));
    return {
      state: { ...state, deck, cards: pick.final, held: action.holds.slice(), phase: 'DONE' },
      additionalStake: 0,
      settlement: { payout: pick.payout, outcome, summary: POKER_HAND_LABEL[pick.hand] },
    };
  },

  view(state) {
    const hand = evaluatePoker(state.cards);
    return {
      cards: toCards(state.cards),
      held: state.held.slice(),
      phase: state.phase,
      hand,
      handLabel: POKER_HAND_LABEL[hand],
      multiplier: POKER_PAYTABLE[hand],
    };
  },
};
