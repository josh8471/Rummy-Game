export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
export type Rank = (typeof RANKS)[number];

export const SUITS = ['S', 'H', 'D', 'C'] as const;
export type Suit = (typeof SUITS)[number];

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const SUIT_SYMBOL: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const SUIT_NAME: Record<Suit, string> = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' };

const RANK_NAME: Record<Rank, string> = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
  J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace',
};

export function isRedSuit(suit: Suit): boolean {
  return suit === 'H' || suit === 'D';
}

/** Screen-reader friendly name, e.g. "Queen of Hearts". */
export function cardLabel(card: Card): string {
  return `${RANK_NAME[card.rank]} of ${SUIT_NAME[card.suit]}`;
}

/** Cards are stored server-side as 0–51: rank = n % 13, suit = floor(n / 13). */
export function cardFromIndex(index: number): Card {
  if (!Number.isInteger(index) || index < 0 || index > 51) throw new RangeError(`Bad card index ${index}`);
  return { rank: RANKS[index % 13]!, suit: SUITS[Math.floor(index / 13)]! };
}

/** 0 = two … 12 = ace */
export function rankIndex(index: number): number {
  return index % 13;
}

export function suitIndex(index: number): number {
  return Math.floor(index / 13);
}
