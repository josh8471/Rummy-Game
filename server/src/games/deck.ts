import { cardFromIndex, type Card } from '@casino/shared';
import { shuffled, type Rng } from '../lib/rng';

export const FULL_DECK: readonly number[] = Array.from({ length: 52 }, (_, i) => i);

export function shuffledDeck(rng: Rng): number[] {
  return shuffled(FULL_DECK, rng);
}

export function toCards(indices: readonly number[]): Card[] {
  return indices.map(cardFromIndex);
}
