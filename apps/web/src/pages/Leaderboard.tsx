import type { LeaderboardEntry } from '@casino/shared';
import { Crown } from 'lucide-react';
import { ErrorState } from '../components/States';
import { PageHeader, Panel, Skeleton } from '../components/ui';
import { cn, formatINR } from '../lib/format';
import { useLeaderboard } from '../lib/queries';

const MEDAL = ['🥇', '🥈', '🥉'];

function Row({ entry }: { entry: LeaderboardEntry }) {
  return (
    <li
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5',
        entry.isYou ? 'border border-gold-400/40 bg-gold-400/10' : 'odd:bg-white/[0.02]',
      )}
    >
      <span className="tabular w-8 text-center font-display font-semibold text-muted">{entry.rank <= 3 ? MEDAL[entry.rank - 1] : entry.rank}</span>
      <span className="flex size-10 items-center justify-center rounded-full bg-white/[0.06] text-xl" aria-hidden>
        {entry.avatar}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">
          {entry.username} {entry.isYou && <span className="text-sm font-normal text-gold-300">(you)</span>}
        </span>
        <span className="text-sm text-muted">Level {entry.level}</span>
      </span>
      <span className="tabular font-display font-semibold">{formatINR(entry.virtualBalance)}</span>
    </li>
  );
}

export default function LeaderboardPage() {
  const board = useLeaderboard();
  const you = board.data?.you;
  const youInList = board.data?.entries.some((e) => e.isYou);
  return (
    <>
      <PageHeader title="Leaderboard" subtitle="Top virtual balances. Just for bragging rights — virtual ₹ has no cash value." />
      <Panel className="mx-auto max-w-3xl p-3 md:p-5">
        {board.error ? (
          <ErrorState message="Couldn’t load the leaderboard." onRetry={() => void board.refetch()} />
        ) : !board.data ? (
          <Skeleton className="h-96" />
        ) : (
          <>
            <div className="mb-3 flex items-center gap-2 px-2 text-sm text-muted">
              <Crown className="size-4 text-gold-300" aria-hidden /> Ranked by virtual balance
            </div>
            <ol className="space-y-1">
              {board.data.entries.map((e) => (
                <Row key={e.username} entry={e} />
              ))}
            </ol>
            {you && !youInList && (
              <ol className="mt-3 border-t border-white/[0.07] pt-3">
                <Row entry={you} />
              </ol>
            )}
          </>
        )}
      </Panel>
    </>
  );
}
