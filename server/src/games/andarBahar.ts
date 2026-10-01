import { ANDAR_BAHAR_RETURN, cardFromIndex, rankIndex, type AndarBaharDetail, type AndarBaharSide } from '@casino/shared';
import type { Rng } from '../lib/rng';
import { shuffledDeck, toCards } from './deck';
import { byReturn, payoutFor, sampleByTier, type InstantEngine } from './engine';

type AndarBaharBet = { betAmount: number; side: AndarBaharSide };

/** Deals one legal Andar Bahar game from a fresh shuffled deck. */
export function dealAndarBahar(rng: Rng) {
  const deck = shuffledDeck(rng);
  const joker = deck[0]!;
  const andar: number[] = [];
  const bahar: number[] = [];
  let winner: AndarBaharSide = 'ANDAR';
  for (let i = 1; i < deck.length; i++) {
    const card = deck[i]!;
    const side: AndarBaharSide = (i - 1) % 2 === 0 ? 'ANDAR' : 'BAHAR';
    (side === 'ANDAR' ? andar : bahar).push(card);
    if (rankIndex(card) === rankIndex(joker)) {
      winner = side;
      break;
    }
  }
  return { joker, andar, bahar, winner };
}

export const andarBaharEngine: InstantEngine<AndarBaharBet, AndarBaharDetail> = {
  kind: 'instant',
  stake: (bet) => bet.betAmount,
  resolve(bet, target, rng) {
    const multiplier = ANDAR_BAHAR_RETURN[bet.side];
    const { pick, outcome } = sampleByTier(
      () => {
        const game = dealAndarBahar(rng);
        return { ...game, payout: game.winner === bet.side ? payoutFor(bet.betAmount, multiplier) : 0 };
      },
      byReturn(bet.betAmount),
      target,
    );
    const cardsDealt = pick.andar.length + pick.bahar.length;
    const joker = cardFromIndex(pick.joker);
    return {
      payout: pick.payout,
      outcome,
      detail: {
        joker,
        andar: toCards(pick.andar),
        bahar: toCards(pick.bahar),
        side: bet.side,
        winner: pick.winner,
        cardsDealt,
        multiplier,
      },
      summary: `${pick.winner === 'ANDAR' ? 'Andar' : 'Bahar'} wins · joker ${joker.rank} · ${cardsDealt} cards`,
    };
  },
};
