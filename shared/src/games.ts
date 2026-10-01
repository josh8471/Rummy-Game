export const GAME_IDS = ['slots', 'roulette', 'blackjack', 'teen-patti', 'andar-bahar', 'dice', 'poker'] as const;
export type GameId = (typeof GAME_IDS)[number];

/** instant = one request settles the round; interactive = the player makes decisions mid-round. */
export type GameKind = 'instant' | 'interactive';

export type GameAccent = 'gold' | 'ruby' | 'emerald' | 'violet' | 'sky' | 'amber' | 'rose';

export interface GameMeta {
  id: GameId;
  name: string;
  tagline: string;
  kind: GameKind;
  glyph: string;
  accent: GameAccent;
  defaultMinBet: number;
  defaultMaxBet: number;
  howToPlay: string[];
}

export const GAMES: Record<GameId, GameMeta> = {
  slots: {
    id: 'slots',
    name: 'Slots',
    tagline: 'Three reels, one payline, up to 25×',
    kind: 'instant',
    glyph: '🍒',
    accent: 'gold',
    defaultMinBet: 100,
    defaultMaxBet: 25_000,
    howToPlay: [
      'Choose your virtual bet and spin.',
      'Only the middle row (the payline) pays.',
      'Three of a kind pays 2× to 25×. Two matching symbols from the left pay 1.5×.',
    ],
  },
  roulette: {
    id: 'roulette',
    name: 'Roulette',
    tagline: 'European single-zero wheel',
    kind: 'instant',
    glyph: '🎡',
    accent: 'ruby',
    defaultMinBet: 100,
    defaultMaxBet: 25_000,
    howToPlay: [
      'Pick a chip, then tap the board to place virtual bets. You can place several.',
      'Red, Black, Odd and Even pay 1:1. Dozens and Columns pay 2:1. A single number pays 35:1.',
      'Zero (green) loses every outside bet.',
    ],
  },
  blackjack: {
    id: 'blackjack',
    name: 'Blackjack',
    tagline: 'Beat the dealer to 21',
    kind: 'interactive',
    glyph: '🂡',
    accent: 'emerald',
    defaultMinBet: 100,
    defaultMaxBet: 25_000,
    howToPlay: [
      'Get closer to 21 than the dealer without going over.',
      'Blackjack (Ace + 10-value card) pays 3:2. Other wins pay 1:1. Ties return your stake.',
      'Double on any first two cards. Split a pair once. Dealer stands on 17.',
      'The dealer takes a second card after you finish (European no-hole-card rule).',
    ],
  },
  'teen-patti': {
    id: 'teen-patti',
    name: 'Teen Patti',
    tagline: 'Three-card showdown vs the dealer',
    kind: 'instant',
    glyph: '🃏',
    accent: 'violet',
    defaultMinBet: 100,
    defaultMaxBet: 25_000,
    howToPlay: [
      'You and the dealer each get three cards. The stronger hand wins.',
      'Hand ranks, high to low: Trail, Pure Sequence, Sequence, Color, Pair, High Card.',
      'Your win pays more the stronger your hand is — up to 11× with a Trail.',
    ],
  },
  'andar-bahar': {
    id: 'andar-bahar',
    name: 'Andar Bahar',
    tagline: 'Which side matches the joker?',
    kind: 'instant',
    glyph: '🂮',
    accent: 'amber',
    defaultMinBet: 100,
    defaultMaxBet: 25_000,
    howToPlay: [
      'A joker card is placed face up.',
      'Cards are dealt alternately to Andar (inside) and Bahar (outside), starting with Andar.',
      'The first side to receive a card matching the joker’s rank wins. Andar pays 0.9:1, Bahar pays 1:1.',
    ],
  },
  dice: {
    id: 'dice',
    name: 'Dice',
    tagline: '7 Up 7 Down with two dice',
    kind: 'instant',
    glyph: '🎲',
    accent: 'sky',
    defaultMinBet: 100,
    defaultMaxBet: 25_000,
    howToPlay: [
      'Two dice are rolled. Bet on the total.',
      '7 Down (2–6) and 7 Up (8–12) pay 1:1. Lucky 7 pays 4:1.',
      'You can back more than one option in the same roll.',
    ],
  },
  poker: {
    id: 'poker',
    name: 'Poker',
    tagline: 'Jacks or Better video poker',
    kind: 'interactive',
    glyph: '♠️',
    accent: 'rose',
    defaultMinBet: 100,
    defaultMaxBet: 25_000,
    howToPlay: [
      'You are dealt five cards. Tap the cards you want to hold.',
      'Draw replaces the rest. Your final hand is paid from the paytable.',
      'A pair of Jacks or better returns your stake. A Royal Flush pays 250×.',
    ],
  },
};

export function isGameId(value: string): value is GameId {
  return (GAME_IDS as readonly string[]).includes(value);
}

/* ─────────────── Slots ─────────────── */

export const SLOT_SYMBOLS = ['CHERRY', 'LEMON', 'GRAPES', 'BELL', 'BAR', 'SEVEN'] as const;
export type SlotSymbol = (typeof SLOT_SYMBOLS)[number];

export const SLOT_SYMBOL_INFO: Record<SlotSymbol, { label: string; glyph: string }> = {
  CHERRY: { label: 'Cherry', glyph: '🍒' },
  LEMON: { label: 'Lemon', glyph: '🍋' },
  GRAPES: { label: 'Grapes', glyph: '🍇' },
  BELL: { label: 'Bell', glyph: '🔔' },
  BAR: { label: 'Bar', glyph: 'BAR' },
  SEVEN: { label: 'Seven', glyph: '7' },
};

/** Return multiplier (stake included) for three of a kind on the payline. */
export const SLOT_THREE_OF_A_KIND: Record<SlotSymbol, number> = {
  SEVEN: 25,
  BAR: 10,
  BELL: 5,
  GRAPES: 4,
  LEMON: 3,
  CHERRY: 2,
};

/** Return multiplier when reels 1 and 2 match on the payline but reel 3 does not. */
export const SLOT_LEFT_PAIR_RETURN = 1.5;

/* ─────────────── Roulette ─────────────── */

/** European wheel pocket order, clockwise from zero. */
export const ROULETTE_WHEEL = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7,
  28, 12, 35, 3, 26,
] as const;

export const ROULETTE_RED_NUMBERS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36] as const;

export type RouletteColor = 'RED' | 'BLACK' | 'GREEN';

export function rouletteColor(n: number): RouletteColor {
  if (n === 0) return 'GREEN';
  return (ROULETTE_RED_NUMBERS as readonly number[]).includes(n) ? 'RED' : 'BLACK';
}

export const ROULETTE_BET_TYPES = ['RED', 'BLACK', 'ODD', 'EVEN', 'DOZEN', 'COLUMN', 'NUMBER'] as const;
export type RouletteBetType = (typeof ROULETTE_BET_TYPES)[number];

/** Return multiplier (stake included) for a winning bet of each type. */
export const ROULETTE_RETURN: Record<RouletteBetType, number> = {
  RED: 2,
  BLACK: 2,
  ODD: 2,
  EVEN: 2,
  DOZEN: 3,
  COLUMN: 3,
  NUMBER: 36,
};

export interface RouletteBetSpot {
  type: RouletteBetType;
  /** NUMBER: 0–36. DOZEN / COLUMN: 1–3. Others: omitted. */
  value?: number;
}

export function rouletteBetWins(bet: RouletteBetSpot, n: number): boolean {
  switch (bet.type) {
    case 'RED':
      return rouletteColor(n) === 'RED';
    case 'BLACK':
      return rouletteColor(n) === 'BLACK';
    case 'ODD':
      return n !== 0 && n % 2 === 1;
    case 'EVEN':
      return n !== 0 && n % 2 === 0;
    case 'NUMBER':
      return n === bet.value;
    case 'DOZEN':
      return n !== 0 && Math.ceil(n / 12) === bet.value;
    case 'COLUMN':
      // Column 1 = 1,4,7…34; column 2 = 2,5,8…35; column 3 = 3,6,9…36
      return n !== 0 && ((n - 1) % 3) + 1 === bet.value;
  }
}

export function rouletteBetLabel(bet: RouletteBetSpot): string {
  switch (bet.type) {
    case 'RED':
      return 'Red';
    case 'BLACK':
      return 'Black';
    case 'ODD':
      return 'Odd';
    case 'EVEN':
      return 'Even';
    case 'NUMBER':
      return `Number ${bet.value}`;
    case 'DOZEN':
      return ['1st 12', '2nd 12', '3rd 12'][(bet.value ?? 1) - 1]!;
    case 'COLUMN':
      return `Column ${bet.value}`;
  }
}

/* ─────────────── Dice: 7 Up 7 Down ─────────────── */

export const DICE_BET_TYPES = ['DOWN', 'SEVEN', 'UP'] as const;
export type DiceBetType = (typeof DICE_BET_TYPES)[number];

export const DICE_RETURN: Record<DiceBetType, number> = { DOWN: 2, SEVEN: 5, UP: 2 };

export const DICE_BET_LABEL: Record<DiceBetType, string> = {
  DOWN: '7 Down (2–6)',
  SEVEN: 'Lucky 7',
  UP: '7 Up (8–12)',
};

export function diceBetWins(type: DiceBetType, total: number): boolean {
  if (type === 'DOWN') return total < 7;
  if (type === 'UP') return total > 7;
  return total === 7;
}

/* ─────────────── Andar Bahar ─────────────── */

export const ANDAR_BAHAR_SIDES = ['ANDAR', 'BAHAR'] as const;
export type AndarBaharSide = (typeof ANDAR_BAHAR_SIDES)[number];

/** Andar receives the first card, so it pays 0.9:1; Bahar pays 1:1. */
export const ANDAR_BAHAR_RETURN: Record<AndarBaharSide, number> = { ANDAR: 1.9, BAHAR: 2 };

/* ─────────────── Teen Patti ─────────────── */

/** Weakest to strongest. */
export const TEEN_PATTI_HANDS = ['HIGH_CARD', 'PAIR', 'COLOR', 'SEQUENCE', 'PURE_SEQUENCE', 'TRAIL'] as const;
export type TeenPattiHand = (typeof TEEN_PATTI_HANDS)[number];

export const TEEN_PATTI_HAND_LABEL: Record<TeenPattiHand, string> = {
  HIGH_CARD: 'High Card',
  PAIR: 'Pair',
  COLOR: 'Color',
  SEQUENCE: 'Sequence',
  PURE_SEQUENCE: 'Pure Sequence',
  TRAIL: 'Trail',
};

/** Return multiplier when the player wins, by the player's winning hand. */
export const TEEN_PATTI_WIN_RETURN: Record<TeenPattiHand, number> = {
  HIGH_CARD: 1.5,
  PAIR: 2,
  COLOR: 2.5,
  SEQUENCE: 3,
  PURE_SEQUENCE: 6,
  TRAIL: 11,
};

export const TEEN_PATTI_TIE_RETURN = 1;

/* ─────────────── Poker: Jacks or Better ─────────────── */

export const POKER_HANDS = [
  'NOTHING',
  'JACKS_OR_BETTER',
  'TWO_PAIR',
  'THREE_OF_A_KIND',
  'STRAIGHT',
  'FLUSH',
  'FULL_HOUSE',
  'FOUR_OF_A_KIND',
  'STRAIGHT_FLUSH',
  'ROYAL_FLUSH',
] as const;
export type PokerHand = (typeof POKER_HANDS)[number];

export const POKER_HAND_LABEL: Record<PokerHand, string> = {
  NOTHING: 'No win',
  JACKS_OR_BETTER: 'Jacks or Better',
  TWO_PAIR: 'Two Pair',
  THREE_OF_A_KIND: 'Three of a Kind',
  STRAIGHT: 'Straight',
  FLUSH: 'Flush',
  FULL_HOUSE: 'Full House',
  FOUR_OF_A_KIND: 'Four of a Kind',
  STRAIGHT_FLUSH: 'Straight Flush',
  ROYAL_FLUSH: 'Royal Flush',
};

/** Return multiplier (stake included). */
export const POKER_PAYTABLE: Record<PokerHand, number> = {
  NOTHING: 0,
  JACKS_OR_BETTER: 1,
  TWO_PAIR: 2,
  THREE_OF_A_KIND: 3,
  STRAIGHT: 4,
  FLUSH: 6,
  FULL_HOUSE: 9,
  FOUR_OF_A_KIND: 25,
  STRAIGHT_FLUSH: 50,
  ROYAL_FLUSH: 250,
};

/* ─────────────── Blackjack ─────────────── */

export const BLACKJACK_ACTIONS = ['HIT', 'STAND', 'DOUBLE', 'SPLIT'] as const;
export type BlackjackAction = (typeof BLACKJACK_ACTIONS)[number];

export const BLACKJACK_NATURAL_RETURN = 2.5;
export const BLACKJACK_WIN_RETURN = 2;
