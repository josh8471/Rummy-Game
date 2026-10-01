import { DICE_RETURN, diceBetWins, type DiceBet, type DiceDetail } from '@casino/shared';
import { byReturn, pickByTier, type InstantEngine } from './engine';

type DiceRequest = { betAmount: number; bets: DiceBet[] };

const ALL_ROLLS = Array.from({ length: 36 }, (_, i) => [Math.floor(i / 6) + 1, (i % 6) + 1] as [number, number]);

export const diceEngine: InstantEngine<DiceRequest, DiceDetail> = {
  kind: 'instant',
  stake: (req) => req.bets.reduce((s, b) => s + b.amount, 0),
  resolve(req, target, rng) {
    const stake = this.stake(req);
    // All 36 dice combinations are equally likely legal results.
    const rolls = ALL_ROLLS.map((dice) => {
      const total = dice[0] + dice[1];
      const payout = req.bets.reduce((s, b) => s + (diceBetWins(b.type, total) ? b.amount * DICE_RETURN[b.type] : 0), 0);
      return { dice, total, payout };
    });
    const { pick, outcome } = pickByTier(rolls, byReturn(stake), target, rng);
    return {
      payout: pick.payout,
      outcome,
      detail: {
        dice: pick.dice,
        total: pick.total,
        bets: req.bets.map((b) => {
          const won = diceBetWins(b.type, pick.total);
          return { type: b.type, amount: b.amount, won, payout: won ? b.amount * DICE_RETURN[b.type] : 0 };
        }),
      },
      summary: `${pick.dice[0]} + ${pick.dice[1]} = ${pick.total}`,
    };
  },
};
