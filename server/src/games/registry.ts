import { blackjackActionSchema, pokerActionSchema, type GameId } from '@casino/shared';
import type { z } from 'zod';
import { andarBaharEngine } from './andarBahar';
import { blackjackEngine } from './blackjack';
import { diceEngine } from './dice';
import type { InstantEngine, InteractiveEngine } from './engine';
import { pokerEngine } from './poker';
import { rouletteEngine } from './roulette';
import { slotsEngine } from './slots';
import { teenPattiEngine } from './teenPatti';

type AnyInstant = InstantEngine<any, any>;
type AnyInteractive = InteractiveEngine<any, any, any>;

export type EngineEntry =
  | { kind: 'instant'; engine: AnyInstant }
  | { kind: 'interactive'; engine: AnyInteractive; actionSchema: z.ZodType };

export const ENGINES: Record<GameId, EngineEntry> = {
  slots: { kind: 'instant', engine: slotsEngine },
  roulette: { kind: 'instant', engine: rouletteEngine },
  dice: { kind: 'instant', engine: diceEngine },
  'andar-bahar': { kind: 'instant', engine: andarBaharEngine },
  'teen-patti': { kind: 'instant', engine: teenPattiEngine },
  blackjack: { kind: 'interactive', engine: blackjackEngine, actionSchema: blackjackActionSchema },
  poker: { kind: 'interactive', engine: pokerEngine, actionSchema: pokerActionSchema },
};
