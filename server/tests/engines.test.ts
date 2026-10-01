import {
  ANDAR_BAHAR_RETURN,
  cardFromIndex,
  classifyReturn,
  DICE_RETURN,
  diceBetWins,
  OUTCOMES,
  POKER_PAYTABLE,
  RANKS,
  ROULETTE_RETURN,
  rouletteBetWins,
  rouletteColor,
  SUITS,
  TEEN_PATTI_TIE_RETURN,
  TEEN_PATTI_WIN_RETURN,
  type AndarBaharDetail,
  type Card,
  type DiceDetail,
  type Outcome,
  type RouletteBet,
  type RouletteDetail,
  type SlotsDetail,
  type TeenPattiDetail,
} from '@casino/shared';
import { describe, expect, it } from 'vitest';
import { andarBaharEngine } from '../src/games/andarBahar';
import {
  blackjackEngine,
  classifyBlackjack,
  handTotal,
  isNatural,
  settleHands,
  type BlackjackInternal,
} from '../src/games/blackjack';
import { diceEngine } from '../src/games/dice';
import { evaluatePoker, pokerEngine } from '../src/games/poker';
import { rouletteEngine } from '../src/games/roulette';
import { evaluatePayline, slotsEngine } from '../src/games/slots';
import { compareTeenPatti, evaluateTeenPatti, teenPattiEngine } from '../src/games/teenPatti';
import { seededRng } from '../src/lib/rng';

/** Build a card index from "AS", "10H", "QD" … */
function c(code: string): number {
  const rank = code.slice(0, -1) as Card['rank'];
  const suit = code.slice(-1) as Card['suit'];
  return SUITS.indexOf(suit) * 13 + RANKS.indexOf(rank);
}
const cards = (codes: string) => codes.split(' ').map(c);
const cardKey = (card: Card) => `${card.rank}${card.suit}`;

describe('slots', () => {
  it('always lands exactly on the target tier and pays the paytable', () => {
    const rng = seededRng(1);
    for (const target of OUTCOMES) {
      for (let i = 0; i < 300; i++) {
        const bet = { betAmount: 10 * (1 + rng.int(100)) };
        const r = slotsEngine.resolve(bet, target, rng);
        const d = r.detail as SlotsDetail;
        expect(r.outcome).toBe(target);
        expect(d.payline).toEqual(d.grid.map((reel) => reel[1]));
        const win = evaluatePayline(d.payline);
        expect(r.payout).toBe(win ? Math.round(bet.betAmount * win.multiplier) : 0);
        expect(r.outcome).toBe(classifyReturn(r.payout, bet.betAmount));
        expect(Number.isInteger(r.payout)).toBe(true);
      }
    }
  });
});

describe('roulette', () => {
  const recompute = (bets: RouletteBet[], n: number) =>
    bets.reduce((s, b) => s + (rouletteBetWins(b, n) ? b.amount * ROULETTE_RETURN[b.type] : 0), 0);

  it('pays by the real table rules for the chosen pocket', () => {
    const rng = seededRng(2);
    const layouts: RouletteBet[][] = [
      [{ type: 'RED', amount: 500 }],
      [{ type: 'NUMBER', value: 17, amount: 100 }],
      [{ type: 'RED', amount: 500 }, { type: 'NUMBER', value: 17, amount: 100 }],
      [{ type: 'DOZEN', value: 2, amount: 200 }, { type: 'COLUMN', value: 3, amount: 200 }, { type: 'EVEN', amount: 100 }],
    ];
    for (const bets of layouts) {
      const stake = bets.reduce((s, b) => s + b.amount, 0);
      for (const target of OUTCOMES) {
        for (let i = 0; i < 100; i++) {
          const r = rouletteEngine.resolve({ betAmount: stake, bets }, target, rng);
          const d = r.detail as RouletteDetail;
          expect(d.number).toBeGreaterThanOrEqual(0);
          expect(d.number).toBeLessThanOrEqual(36);
          expect(d.color).toBe(rouletteColor(d.number));
          expect(r.payout).toBe(recompute(bets, d.number));
          expect(r.outcome).toBe(classifyReturn(r.payout, stake));
          if (target !== 'BIG_WIN') expect(r.outcome).not.toBe('BIG_WIN');
        }
      }
    }
  });

  it('uses the closest sensible outcome when a tier is impossible', () => {
    const rng = seededRng(3);
    const red = { betAmount: 500, bets: [{ type: 'RED', amount: 500 }] as RouletteBet[] };
    expect(rouletteEngine.resolve(red, 'SMALL_WIN', rng).outcome).toBe('WIN');
    expect(rouletteEngine.resolve(red, 'BIG_WIN', rng).outcome).toBe('WIN');
    expect(rouletteEngine.resolve(red, 'LOSS', rng).outcome).toBe('LOSS');

    // A single number can only miss or pay 36× — it only hits on a drawn BIG_WIN.
    const number = { betAmount: 100, bets: [{ type: 'NUMBER', value: 7, amount: 100 }] as RouletteBet[] };
    expect(rouletteEngine.resolve(number, 'WIN', rng).outcome).toBe('LOSS');
    expect(rouletteEngine.resolve(number, 'SMALL_WIN', rng).outcome).toBe('LOSS');
    const hit = rouletteEngine.resolve(number, 'BIG_WIN', rng);
    expect(hit.outcome).toBe('BIG_WIN');
    expect((hit.detail as RouletteDetail).number).toBe(7);
    expect(hit.payout).toBe(3600);
  });

  it('zero loses every outside bet', () => {
    for (const type of ['RED', 'BLACK', 'ODD', 'EVEN'] as const) expect(rouletteBetWins({ type }, 0)).toBe(false);
    expect(rouletteBetWins({ type: 'DOZEN', value: 1 }, 0)).toBe(false);
    expect(rouletteBetWins({ type: 'COLUMN', value: 3 }, 0)).toBe(false);
    expect(rouletteBetWins({ type: 'NUMBER', value: 0 }, 0)).toBe(true);
    expect(rouletteBetWins({ type: 'COLUMN', value: 1 }, 34)).toBe(true);
    expect(rouletteBetWins({ type: 'DOZEN', value: 3 }, 25)).toBe(true);
  });
});

describe('dice (7 Up 7 Down)', () => {
  it('pays by the rules for the rolled total', () => {
    const rng = seededRng(4);
    const layouts = [
      [{ type: 'DOWN', amount: 500 }],
      [{ type: 'SEVEN', amount: 200 }],
      [{ type: 'UP', amount: 300 }, { type: 'SEVEN', amount: 100 }],
    ] as const;
    for (const bets of layouts) {
      const stake = bets.reduce((s, b) => s + b.amount, 0);
      for (const target of OUTCOMES) {
        for (let i = 0; i < 100; i++) {
          const r = diceEngine.resolve({ betAmount: stake, bets: [...bets] }, target, rng);
          const d = r.detail as DiceDetail;
          expect(d.dice[0]).toBeGreaterThanOrEqual(1);
          expect(d.dice[1]).toBeLessThanOrEqual(6);
          expect(d.total).toBe(d.dice[0] + d.dice[1]);
          const expected = bets.reduce((s, b) => s + (diceBetWins(b.type, d.total) ? b.amount * DICE_RETURN[b.type] : 0), 0);
          expect(r.payout).toBe(expected);
          expect(r.outcome).toBe(classifyReturn(r.payout, stake));
        }
      }
    }
    expect(diceEngine.resolve({ betAmount: 200, bets: [{ type: 'SEVEN', amount: 200 }] }, 'BIG_WIN', rng).payout).toBe(1000);
  });
});

describe('andar bahar', () => {
  it('deals a legal game and pays the correct side', () => {
    const rng = seededRng(5);
    for (const side of ['ANDAR', 'BAHAR'] as const) {
      for (const target of OUTCOMES) {
        for (let i = 0; i < 100; i++) {
          const r = andarBaharEngine.resolve({ betAmount: 500, side }, target, rng);
          const d = r.detail as AndarBaharDetail;
          const all = [d.joker, ...d.andar, ...d.bahar].map(cardKey);
          expect(new Set(all).size).toBe(all.length);
          // Andar is dealt first, so it has the same number of cards as Bahar or one more.
          expect(d.andar.length - d.bahar.length).toBeGreaterThanOrEqual(0);
          expect(d.andar.length - d.bahar.length).toBeLessThanOrEqual(1);
          const winnerPile = d.winner === 'ANDAR' ? d.andar : d.bahar;
          expect(winnerPile[winnerPile.length - 1]!.rank).toBe(d.joker.rank);
          const loserPile = d.winner === 'ANDAR' ? d.bahar : d.andar;
          expect(loserPile.every((card) => card.rank !== d.joker.rank)).toBe(true);
          expect(winnerPile.slice(0, -1).every((card) => card.rank !== d.joker.rank)).toBe(true);
          expect(r.payout).toBe(d.winner === side ? Math.round(500 * ANDAR_BAHAR_RETURN[side]) : 0);
        }
      }
    }
  });

  it('Andar wins are small wins (0.9:1), Bahar wins are wins (1:1)', () => {
    const rng = seededRng(6);
    expect(andarBaharEngine.resolve({ betAmount: 100, side: 'ANDAR' }, 'WIN', rng)).toMatchObject({ outcome: 'SMALL_WIN', payout: 190 });
    expect(andarBaharEngine.resolve({ betAmount: 100, side: 'BAHAR' }, 'SMALL_WIN', rng)).toMatchObject({ outcome: 'WIN', payout: 200 });
    expect(andarBaharEngine.resolve({ betAmount: 100, side: 'BAHAR' }, 'LOSS', rng)).toMatchObject({ outcome: 'LOSS', payout: 0 });
  });
});

describe('teen patti', () => {
  it('ranks hands correctly', () => {
    const e = (codes: string) => evaluateTeenPatti(cards(codes));
    expect(e('AS AH AD').hand).toBe('TRAIL');
    expect(e('AS KS QS').hand).toBe('PURE_SEQUENCE');
    expect(e('AS 2H 3D').hand).toBe('SEQUENCE');
    expect(e('4C 7C JC').hand).toBe('COLOR');
    expect(e('9S 9H 2D').hand).toBe('PAIR');
    expect(e('AS 9H 2D').hand).toBe('HIGH_CARD');
    expect(compareTeenPatti(e('2S 2H 2D'), e('AS KS QS'))).toBeGreaterThan(0); // any trail beats pure sequence
    expect(compareTeenPatti(e('AS KH QD'), e('AS 2H 3D'))).toBeGreaterThan(0); // A-K-Q is the top sequence
    expect(compareTeenPatti(e('AS 2H 3D'), e('KS QH JD'))).toBeGreaterThan(0); // A-2-3 is second
    expect(compareTeenPatti(e('9S 9H 2D'), e('9C 9D AH'))).toBeLessThan(0); // kicker decides
    expect(compareTeenPatti(e('AS 9H 2D'), e('AC 9D 2H'))).toBe(0);
  });

  it('pays by the winning hand and can reach every tier', () => {
    const rng = seededRng(7);
    for (const target of OUTCOMES) {
      for (let i = 0; i < 60; i++) {
        const r = teenPattiEngine.resolve({ betAmount: 1000 }, target, rng);
        const d = r.detail as TeenPattiDetail;
        const all = [...d.player.cards, ...d.dealer.cards].map(cardKey);
        expect(new Set(all).size).toBe(6);
        const expected =
          d.winner === 'PLAYER' ? TEEN_PATTI_WIN_RETURN[d.player.hand] : d.winner === 'TIE' ? TEEN_PATTI_TIE_RETURN : 0;
        expect(r.payout).toBe(Math.round(1000 * expected));
        expect(r.outcome).toBe(target);
      }
    }
  });
});

describe('video poker (Jacks or Better)', () => {
  it('evaluates hands', () => {
    const e = (codes: string) => evaluatePoker(cards(codes));
    expect(e('10S JS QS KS AS')).toBe('ROYAL_FLUSH');
    expect(e('5H 6H 7H 8H 9H')).toBe('STRAIGHT_FLUSH');
    expect(e('9C 9D 9H 9S 2C')).toBe('FOUR_OF_A_KIND');
    expect(e('3C 3D 3H 7S 7C')).toBe('FULL_HOUSE');
    expect(e('2D 7D 9D JD KD')).toBe('FLUSH');
    expect(e('AS 2D 3H 4C 5S')).toBe('STRAIGHT');
    expect(e('10S JD QH KC AS')).toBe('STRAIGHT');
    expect(e('8S 8D 8H KC 2S')).toBe('THREE_OF_A_KIND');
    expect(e('8S 8D KH KC 2S')).toBe('TWO_PAIR');
    expect(e('JS JD 4H 7C 2S')).toBe('JACKS_OR_BETTER');
    expect(e('10S 10D 4H 7C 2S')).toBe('NOTHING');
    expect(e('QS KD 3H 7C 2S')).toBe('NOTHING');
  });

  it('keeps held cards, draws legal replacements and pays the paytable', () => {
    const rng = seededRng(8);
    for (const target of OUTCOMES) {
      for (let i = 0; i < 40; i++) {
        const start = pokerEngine.start(500, target, rng);
        const holds = [0, 1, 2, 3, 4].map(() => rng.int(2) === 0);
        const step = pokerEngine.act(start.state, { action: 'DRAW', holds, seq: 0 }, rng);
        const final = step.state.cards;
        holds.forEach((held, idx) => {
          if (held) expect(final[idx]).toBe(start.state.cards[idx]);
        });
        expect(new Set(final).size).toBe(5);
        const replaced = final.filter((_, idx) => !holds[idx]);
        for (const card of replaced) expect(start.state.cards.includes(card)).toBe(false);
        expect(step.state.deck.length + 5 + replaced.length).toBe(52);
        const hand = evaluatePoker(final);
        expect(step.settlement!.payout).toBe(Math.round(500 * POKER_PAYTABLE[hand]));
        expect(step.settlement!.outcome).toBe(classifyReturn(step.settlement!.payout, 500));
      }
    }
  });

  it('rejects a second draw', () => {
    const rng = seededRng(9);
    const start = pokerEngine.start(100, 'WIN', rng);
    const done = pokerEngine.act(start.state, { action: 'DRAW', holds: [true, true, true, true, true], seq: 0 }, rng);
    expect(() => pokerEngine.act(done.state, { action: 'DRAW', holds: [false, false, false, false, false], seq: 1 }, rng)).toThrow(/finished/);
  });
});

describe('blackjack', () => {
  it('totals hands with soft aces', () => {
    expect(handTotal(cards('AS 6H'))).toEqual({ total: 17, soft: true });
    expect(handTotal(cards('AS 6H 10D'))).toEqual({ total: 17, soft: false });
    expect(handTotal(cards('AS AH 9D'))).toEqual({ total: 21, soft: true });
    expect(handTotal(cards('KS QH 5D')).total).toBe(25);
    expect(isNatural(cards('AS KD'))).toBe(true);
    expect(isNatural(cards('7S 7D 7H'))).toBe(false);
  });

  const hand = (codes: string, status: 'STOOD' | 'BUST' | 'BLACKJACK', bet = 100) => ({
    cards: cards(codes),
    bet,
    doubled: false,
    fromSplit: false,
    splitAces: false,
    status,
    result: null,
    payout: null,
  });

  it('settles hands by the rules', () => {
    expect(settleHands([hand('10S 9H', 'STOOD')], cards('10D 8C')).payout).toBe(200); // 19 beats 18
    expect(settleHands([hand('10S 8H', 'STOOD')], cards('10D 8C')).payout).toBe(100); // push
    expect(settleHands([hand('10S 7H', 'STOOD')], cards('10D 8C')).payout).toBe(0); // loses
    expect(settleHands([hand('10S 2H', 'STOOD')], cards('10D 6C 9H')).payout).toBe(200); // dealer bust
    expect(settleHands([hand('10S 5H 9D', 'BUST')], cards('10D 6C 9H')).payout).toBe(0); // player bust loses first
    const natural = settleHands([hand('AS KH', 'BLACKJACK')], cards('9D 8C'));
    expect(natural.payout).toBe(250);
    expect(natural.naturalWin).toBe(true);
    expect(settleHands([hand('AS KH', 'BLACKJACK')], cards('AD KC')).payout).toBe(100); // both naturals push
    expect(settleHands([hand('10S 10H', 'STOOD')], cards('AD KC')).payout).toBe(0); // dealer natural
    expect(classifyBlackjack(250, 100, true)).toBe('BIG_WIN');
    expect(classifyBlackjack(100, 100, false)).toBe('SMALL_WIN');
  });

  function playOut(target: Outcome, rng: ReturnType<typeof seededRng>, policy: (state: BlackjackInternal) => 'HIT' | 'STAND' | 'DOUBLE' | 'SPLIT') {
    let step = blackjackEngine.start(100, target, rng);
    let staked = 100;
    let seq = 0;
    while (!step.settlement) {
      const allowed = blackjackEngine.view(step.state).allowedActions;
      const wanted = policy(step.state);
      const action = allowed.includes(wanted) ? wanted : 'STAND';
      step = blackjackEngine.act(step.state, { action, seq: seq++ }, rng);
      staked += step.additionalStake;
    }
    return { step, staked };
  }

  it('plays full rounds legally and pays consistently', () => {
    const rng = seededRng(10);
    const policies = [
      () => 'STAND' as const,
      (s: BlackjackInternal) => (handTotal(s.hands[s.active!]!.cards).total < 17 ? ('HIT' as const) : ('STAND' as const)),
      () => 'DOUBLE' as const,
      (s: BlackjackInternal) => (s.hands.length === 1 ? ('SPLIT' as const) : ('HIT' as const)),
    ];
    for (const target of OUTCOMES) {
      for (const policy of policies) {
        for (let i = 0; i < 40; i++) {
          const { step, staked } = playOut(target, rng, policy);
          const s = step.state;
          const dealt = s.dealer.length + s.hands.reduce((n, h) => n + h.cards.length, 0);
          expect(s.shoe.length + dealt).toBe(312);
          expect(s.hands.reduce((sum, h) => sum + h.bet, 0)).toBe(staked);
          const dealerTotal = handTotal(s.dealer).total;
          if (s.hands.some((h) => h.status !== 'BUST')) expect(dealerTotal).toBeGreaterThanOrEqual(17);
          const expected = settleHands(s.hands, s.dealer);
          expect(step.settlement!.payout).toBe(expected.payout);
          expect(step.settlement!.outcome).toBe(classifyBlackjack(expected.payout, staked, expected.naturalWin));
          expect(blackjackEngine.view(s).dealer.hasHiddenCard).toBe(false);
        }
      }
    }
  });

  it('deals a natural for BIG_WIN targets and avoids one otherwise', () => {
    const rng = seededRng(11);
    for (let i = 0; i < 50; i++) {
      const big = blackjackEngine.start(100, 'BIG_WIN', rng);
      expect(isNatural(big.state.hands[0]!.cards)).toBe(true);
      expect(big.settlement).not.toBeNull();
      expect(big.settlement!.outcome).toBe('BIG_WIN');
      const normal = blackjackEngine.start(100, 'WIN', rng);
      expect(isNatural(normal.state.hands[0]!.cards)).toBe(false);
    }
  });

  it('never reveals the deck or target in the player view', () => {
    const rng = seededRng(12);
    const view = blackjackEngine.view(blackjackEngine.start(100, 'LOSS', rng).state) as unknown as Record<string, unknown>;
    expect(view).not.toHaveProperty('shoe');
    expect(view).not.toHaveProperty('target');
    expect(JSON.stringify(view)).not.toContain('LOSS');
  });

  it('rejects illegal actions', () => {
    const rng = seededRng(13);
    let step = blackjackEngine.start(100, 'WIN', rng);
    while (blackjackEngine.view(step.state).allowedActions.includes('SPLIT')) step = blackjackEngine.start(100, 'WIN', rng);
    expect(() => blackjackEngine.act(step.state, { action: 'SPLIT', seq: 0 }, rng)).toThrow(/not allowed/);
    const stood = blackjackEngine.act(step.state, { action: 'STAND', seq: 0 }, rng);
    expect(() => blackjackEngine.act(stood.state, { action: 'HIT', seq: 1 }, rng)).toThrow(/finished/);
  });
});

it('card helpers round-trip', () => {
  expect(cardFromIndex(c('10H'))).toEqual({ rank: '10', suit: 'H' });
  expect(cardFromIndex(c('AS'))).toEqual({ rank: 'A', suit: 'S' });
});
