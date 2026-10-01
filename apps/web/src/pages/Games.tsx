import { GameCard } from '../components/GameCard';
import { ErrorState } from '../components/States';
import { VirtualNotice } from '../components/VirtualNotice';
import { PageHeader, Skeleton } from '../components/ui';
import { useGames } from '../lib/queries';

/** Game library: 1 column on phones, 2 on tablets, 3–4 on desktop (PRD §10, §48). */
export function GamesPage() {
  const games = useGames();
  return (
    <>
      <PageHeader title="Games" subtitle="Seven casino simulations. Every result is decided on the server." actions={<VirtualNotice />} />
      {games.error ? (
        <ErrorState message="Couldn’t load games." onRetry={() => void games.refetch()} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {games.data
            ? games.data.map((g) => <GameCard key={g.id} game={g} />)
            : Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}
        </div>
      )}
    </>
  );
}
