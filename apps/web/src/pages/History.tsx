import { GAME_IDS, GAMES, type GameId } from '@casino/shared';
import { History } from 'lucide-react';
import { useState } from 'react';
import { FilterChips } from '../components/FilterChips';
import { HistoryList } from '../components/HistoryList';
import { EmptyState, ErrorState } from '../components/States';
import { Button, PageHeader, Panel, Skeleton } from '../components/ui';
import { useHistory } from '../lib/queries';

type GameFilter = GameId | 'all';
const OPTIONS: { value: GameFilter; label: string }[] = [
  { value: 'all', label: 'All games' },
  ...GAME_IDS.map((id) => ({ value: id, label: GAMES[id].name })),
];

export default function HistoryPage() {
  const [game, setGame] = useState<GameFilter>('all');
  const history = useHistory(game === 'all' ? undefined : game);
  const items = history.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <PageHeader title="Game History" subtitle="Every round you’ve played, with its server-decided result." />
      <Panel className="p-4 md:p-5">
        <FilterChips options={OPTIONS} value={game} onChange={setGame} label="Filter by game" />
        <div className="mt-4">
          {history.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : history.error ? (
            <ErrorState message="Couldn’t load your history." onRetry={() => void history.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={<History className="size-7" aria-hidden />}
              title="No games played yet."
              message="Your game history will appear here."
              action={{ label: 'Explore games', to: '/games' }}
            />
          ) : (
            <>
              <HistoryList items={items} />
              {history.hasNextPage && (
                <Button variant="secondary" block className="mt-4" loading={history.isFetchingNextPage} onClick={() => void history.fetchNextPage()}>
                  Load more
                </Button>
              )}
            </>
          )}
        </div>
      </Panel>
    </>
  );
}
