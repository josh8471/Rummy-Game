import {
  ROULETTE_RETURN,
  rouletteBetWins,
  rouletteColor,
  type RouletteBet,
  type RouletteDetail,
} from '@casino/shared';
import { byReturn, pickByTier, type InstantEngine } from './engine';

type RouletteRequest = { betAmount: number; bets: RouletteBet[] };

function spotPayout(bet: RouletteBet, n: number): number {
  return rouletteBetWins(bet, n) ? bet.amount * ROULETTE_RETURN[bet.type] : 0;
}

export const rouletteEngine: InstantEngine<RouletteRequest, RouletteDetail> = {
  kind: 'instant',
  stake: (req) => req.bets.reduce((s, b) => s + b.amount, 0),
  resolve(req, target, rng) {
    const stake = this.stake(req);
    // Every pocket is a legal result; group them by what this bet layout would pay.
    const pockets = Array.from({ length: 37 }, (_, n) => ({
      n,
      payout: req.bets.reduce((s, b) => s + spotPayout(b, n), 0),
    }));
    const { pick, outcome } = pickByTier(pockets, byReturn(stake), target, rng);
    const color = rouletteColor(pick.n);
    return {
      payout: pick.payout,
      outcome,
      detail: {
        number: pick.n,
        color,
        bets: req.bets.map((b) => {
          const payout = spotPayout(b, pick.n);
          return { ...b, won: payout > 0, payout };
        }),
      },
      summary: `${pick.n} ${color === 'GREEN' ? 'Green' : color === 'RED' ? 'Red' : 'Black'}`,
    };
  },
};
