import { isGameId, type GameConfig, type GameId } from '@casino/shared';
import { lazy, Suspense, type ComponentType } from 'react';
import { useParams } from 'react-router';
import { ErrorState, LoadingState } from '../components/States';
import { NotFoundPage } from '../pages/NotFound';
import { useGames } from '../lib/queries';
import { GameUnavailable } from './common';

export interface GameProps {
  config: GameConfig;
}

// Each game's code (and its artwork) is its own chunk, loaded on demand.
const GAME_COMPONENTS: Record<GameId, ComponentType<GameProps>> = {
  slots: lazy(() => import('./SlotsGame')),
  roulette: lazy(() => import('./RouletteGame')),
  blackjack: lazy(() => import('./BlackjackGame')),
  'teen-patti': lazy(() => import('./TeenPattiGame')),
  'andar-bahar': lazy(() => import('./AndarBaharGame')),
  dice: lazy(() => import('./DiceGame')),
  poker: lazy(() => import('./PokerGame')),
};

export default function GamePage() {
  const { gameId = '' } = useParams();
  const games = useGames();
  if (!isGameId(gameId)) return <NotFoundPage />;
  if (games.isLoading) return <LoadingState label="Setting up the table…" />;
  if (games.error) return <ErrorState message="Couldn’t load this game." onRetry={() => void games.refetch()} />;
  const config = games.data?.find((g) => g.id === gameId);
  if (!config) return <NotFoundPage />;
  if (!config.enabled) return <GameUnavailable gameId={gameId} />;
  const Game = GAME_COMPONENTS[gameId];
  return (
    <Suspense fallback={<LoadingState label="Setting up the table…" />}>
      <Game key={gameId} config={config} />
    </Suspense>
  );
}
