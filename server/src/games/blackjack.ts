import {
  BLACKJACK_NATURAL_RETURN,
  BLACKJACK_WIN_RETURN,
  classifyReturn,
  rankIndex,
  type BlackjackAction,
  type BlackjackActionRequest,
  type BlackjackHandResult,
  type BlackjackHandStatus,
  type BlackjackState,
  type Outcome,
} from '@casino/shared';
import { badRequest } from '../lib/errors';
import type { Rng } from '../lib/rng';
import { toCards } from './deck';
import { payoutFor, sampleByTier, type InteractiveEngine, type InteractiveStep } from './engine';

/*
 * Rules: 6-deck shoe, dealer stands on all 17s, blackjack pays 3:2, double on
 * any first two cards (including after a split), one split per round, split
 * aces receive one card each. European no-hole-card: the dealer's second card
 * is drawn only after the player finishes.
 *
 * Simulation: the player's own cards are drawn naturally, so decisions like
 * hitting and busting are real. The probability target shapes the initial deal
 * (a natural for BIG_WIN, no natural otherwise) and the dealer's draw.
 */

const DECKS = 6;
const ACE = 12;

interface Hand {
  cards: number[];
  bet: number;
  doubled: boolean;
  fromSplit: boolean;
  splitAces: boolean;
  status: BlackjackHandStatus;
  result: BlackjackHandResult | null;
  payout: number | null;
}

export interface BlackjackInternal {
  /** Undealt cards (server-only). */
  shoe: number[];
  /** Probability-engine target (server-only). */
  target: Outcome;
  dealer: number[];
  hands: Hand[];
  active: number | null;
  phase: 'PLAYER' | 'DONE';
}

export function cardValue(card: number): number {
  const r = rankIndex(card);
  if (r === ACE) return 11;
  return r <= 8 ? r + 2 : 10;
}

export function handTotal(cards: readonly number[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    const value = cardValue(card);
    total += value;
    if (value === 11) aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

export function isNatural(cards: readonly number[]): boolean {
  return cards.length === 2 && handTotal(cards).total === 21;
}

function draw(shoe: number[], rng: Rng): number {
  const i = rng.int(shoe.length);
  const card = shoe[i]!;
  shoe[i] = shoe[shoe.length - 1]!;
  shoe.pop();
  return card;
}

function drawMatching(shoe: number[], rng: Rng, predicate: (card: number) => boolean): number {
  const matches = shoe.flatMap((card, i) => (predicate(card) ? [i] : []));
  const i = matches[rng.int(matches.length)]!;
  const card = shoe[i]!;
  shoe[i] = shoe[shoe.length - 1]!;
  shoe.pop();
  return card;
}

function newHand(cards: number[], bet: number, fromSplit = false, splitAces = false): Hand {
  return { cards, bet, doubled: false, fromSplit, splitAces, status: 'PLAYING', result: null, payout: null };
}

export function allowedActions(state: BlackjackInternal): BlackjackAction[] {
  if (state.phase !== 'PLAYER' || state.active === null) return [];
  const hand = state.hands[state.active];
  if (!hand || hand.status !== 'PLAYING') return [];
  const actions: BlackjackAction[] = ['HIT', 'STAND'];
  if (hand.cards.length === 2) actions.push('DOUBLE');
  if (hand.cards.length === 2 && state.hands.length === 1 && rankIndex(hand.cards[0]!) === rankIndex(hand.cards[1]!)) {
    actions.push('SPLIT');
  }
  return actions;
}

export function settleHands(hands: readonly Hand[], dealer: readonly number[]) {
  const dealerTotal = handTotal(dealer).total;
  const dealerBlackjack = isNatural(dealer);
  let payout = 0;
  let naturalWin = false;
  const settled = hands.map((hand): Hand => {
    const total = handTotal(hand.cards).total;
    let result: BlackjackHandResult;
    if (hand.status === 'BUST') result = 'LOSS';
    else if (hand.status === 'BLACKJACK') result = dealerBlackjack ? 'PUSH' : 'BLACKJACK';
    else if (dealerBlackjack) result = 'LOSS';
    else if (dealerTotal > 21 || total > dealerTotal) result = 'WIN';
    else if (total === dealerTotal) result = 'PUSH';
    else result = 'LOSS';

    const handPayout =
      result === 'BLACKJACK'
        ? payoutFor(hand.bet, BLACKJACK_NATURAL_RETURN)
        : result === 'WIN'
          ? payoutFor(hand.bet, BLACKJACK_WIN_RETURN)
          : result === 'PUSH'
            ? hand.bet
            : 0;
    if (result === 'BLACKJACK') naturalWin = true;
    payout += handPayout;
    return { ...hand, result, payout: handPayout };
  });
  return { hands: settled, payout, naturalWin };
}

/** A winning natural counts as a BIG_WIN in blackjack; otherwise the standard return tiers apply. */
export function classifyBlackjack(payout: number, staked: number, naturalWin: boolean): Outcome {
  if (payout < staked) return 'LOSS';
  if (naturalWin) return 'BIG_WIN';
  return classifyReturn(payout, staked);
}

function summarize(hands: readonly Hand[], dealer: readonly number[]): string {
  const dealerTotal = handTotal(dealer).total;
  const vs = isNatural(dealer) ? 'dealer blackjack' : dealerTotal > 21 ? `dealer bust (${dealerTotal})` : `dealer ${dealerTotal}`;
  const word: Record<BlackjackHandResult, string> = { BLACKJACK: 'Blackjack', WIN: 'Win', PUSH: 'Push', LOSS: 'Loss' };
  const parts = hands.map((h) => {
    const total = handTotal(h.cards).total;
    if (h.status === 'BUST') return `Bust ${total}`;
    return `${word[h.result!]} ${total}`;
  });
  return `${parts.join(' / ')} vs ${vs}`;
}

function finish(state: BlackjackInternal, rng: Rng): InteractiveStep<BlackjackInternal> {
  const staked = state.hands.reduce((s, h) => s + h.bet, 0);

  if (state.hands.every((h) => h.status === 'BUST')) {
    // Nothing left to decide — the dealer just turns a second card.
    state.dealer = [...state.dealer, draw(state.shoe, rng)];
  } else {
    // Try possible dealer draws from the real shoe and keep one matching the target.
    const { pick } = sampleByTier(
      () => {
        const used = new Set<number>();
        const next = () => {
          let i: number;
          do i = rng.int(state.shoe.length);
          while (used.has(i));
          used.add(i);
          return state.shoe[i]!;
        };
        const cards = [...state.dealer, next()];
        while (handTotal(cards).total < 17) cards.push(next());
        return { cards, used, ...settleHands(state.hands, cards) };
      },
      (c) => classifyBlackjack(c.payout, staked, c.naturalWin),
      state.target,
      400,
    );
    state.shoe = state.shoe.filter((_, i) => !pick.used.has(i));
    state.dealer = pick.cards;
  }

  const { hands, payout, naturalWin } = settleHands(state.hands, state.dealer);
  state.hands = hands;
  state.phase = 'DONE';
  state.active = null;
  return {
    state,
    additionalStake: 0,
    settlement: {
      payout,
      outcome: classifyBlackjack(payout, staked, naturalWin),
      summary: summarize(hands, state.dealer),
    },
  };
}

function advance(state: BlackjackInternal, rng: Rng, additionalStake: number): InteractiveStep<BlackjackInternal> {
  const next = state.hands.findIndex((h) => h.status === 'PLAYING');
  if (next !== -1) {
    state.active = next;
    return { state, additionalStake, settlement: null };
  }
  return { ...finish(state, rng), additionalStake };
}

export const blackjackEngine: InteractiveEngine<BlackjackInternal, BlackjackActionRequest, BlackjackState> = {
  kind: 'interactive',

  start(betAmount, target, rng) {
    const shoe = Array.from({ length: 52 * DECKS }, (_, i) => i % 52);
    let player: number[];
    let up: number;

    if (target === 'BIG_WIN') {
      const ace = drawMatching(shoe, rng, (c) => rankIndex(c) === ACE);
      const ten = drawMatching(shoe, rng, (c) => cardValue(c) === 10);
      player = rng.int(2) === 0 ? [ace, ten] : [ten, ace];
      up = draw(shoe, rng);
    } else {
      // Naturals are reserved for the BIG_WIN tier; redeal the rare accidental one.
      for (let attempt = 0; ; attempt++) {
        player = [draw(shoe, rng), draw(shoe, rng)];
        up = draw(shoe, rng);
        if (!isNatural(player) || attempt >= 20) break;
        shoe.push(...player, up);
      }
    }

    const state: BlackjackInternal = {
      shoe,
      target,
      dealer: [up],
      hands: [newHand(player, betAmount)],
      active: 0,
      phase: 'PLAYER',
    };
    if (isNatural(player)) {
      state.hands[0]!.status = 'BLACKJACK';
      return finish(state, rng);
    }
    return { state, additionalStake: 0, settlement: null };
  },

  act(input, { action }, rng) {
    if (input.phase !== 'PLAYER' || input.active === null) {
      throw badRequest('ROUND_FINISHED', 'This round is already finished.');
    }
    if (!allowedActions(input).includes(action)) {
      throw badRequest('ACTION_NOT_ALLOWED', `${action} is not allowed right now.`);
    }
    const state = structuredClone(input);
    const hand = state.hands[state.active!]!;
    let additionalStake = 0;

    switch (action) {
      case 'HIT': {
        hand.cards.push(draw(state.shoe, rng));
        const { total } = handTotal(hand.cards);
        if (total > 21) hand.status = 'BUST';
        else if (total === 21) hand.status = 'STOOD';
        break;
      }
      case 'STAND':
        hand.status = 'STOOD';
        break;
      case 'DOUBLE': {
        additionalStake = hand.bet;
        hand.bet *= 2;
        hand.doubled = true;
        hand.cards.push(draw(state.shoe, rng));
        hand.status = handTotal(hand.cards).total > 21 ? 'BUST' : 'STOOD';
        break;
      }
      case 'SPLIT': {
        additionalStake = hand.bet;
        const splitAces = rankIndex(hand.cards[0]!) === ACE;
        state.hands = hand.cards.map((card) => {
          const h = newHand([card, draw(state.shoe, rng)], hand.bet, true, splitAces);
          if (splitAces || handTotal(h.cards).total === 21) h.status = 'STOOD';
          return h;
        });
        state.active = 0;
        break;
      }
    }
    return advance(state, rng, additionalStake);
  },

  view(state) {
    const dealer = handTotal(state.dealer);
    return {
      dealer: { cards: toCards(state.dealer), total: dealer.total, hasHiddenCard: state.phase === 'PLAYER' },
      hands: state.hands.map((h) => {
        const { total, soft } = handTotal(h.cards);
        return {
          cards: toCards(h.cards),
          total,
          soft,
          bet: h.bet,
          doubled: h.doubled,
          fromSplit: h.fromSplit,
          status: h.status,
          result: h.result,
          payout: h.payout,
        };
      }),
      activeHand: state.phase === 'PLAYER' ? state.active : null,
      allowedActions: allowedActions(state),
    };
  },
};
