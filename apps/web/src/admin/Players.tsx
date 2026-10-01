import type { AdminPlayerRow } from '@casino/shared';
import { Search, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { EmptyState, ErrorState } from '../components/States';
import { Button, inputClass, PageHeader, Panel, Skeleton } from '../components/ui';
import { cn, formatINR } from '../lib/format';
import { usePlayers } from './data';
import { ProbabilityModal } from './forms';

export function StatusBadge({ status }: { status: AdminPlayerRow['status'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold uppercase tracking-wide',
        status === 'active' ? 'bg-win/12 text-win' : 'bg-loss/12 text-loss',
      )}
    >
      <span className={cn('size-1.5 rounded-full', status === 'active' ? 'bg-win' : 'bg-loss')} aria-hidden />
      {status}
    </span>
  );
}

export function ProfileBadge({ name }: { name: string }) {
  return <span className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-xs font-semibold">{name}</span>;
}

export function PlayersPage() {
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [configuring, setConfiguring] = useState<AdminPlayerRow | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => setSearch(query.trim()), 300);
    return () => window.clearTimeout(t);
  }, [query]);
  const players = usePlayers(search);
  const rows = players.data?.pages.flatMap((p) => p.items) ?? [];
  const total = players.data?.pages[0]?.total;

  return (
    <>
      <PageHeader title="Players" subtitle={total !== undefined ? `${total.toLocaleString('en-IN')} accounts` : undefined} />
      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
        <label htmlFor="player-search" className="sr-only">
          Search players
        </label>
        <input
          id="player-search"
          type="search"
          placeholder="Search by username or email"
          className={cn(inputClass, 'pl-10')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {players.error ? (
        <ErrorState message="Couldn’t load players." onRetry={() => void players.refetch()} />
      ) : players.isLoading ? (
        <Skeleton className="h-80" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<Users className="size-7" aria-hidden />} title="No players found" message="Try a different search." />
      ) : (
        <>
          {/* Desktop / tablet table */}
          <Panel className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Players</caption>
                <thead>
                  <tr className="border-b border-white/[0.07] text-left text-xs uppercase tracking-wider text-subtle">
                    <th scope="col" className="px-4 py-3 font-semibold">Player</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">Balance</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">Level</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Profile</th>
                    <th scope="col" className="px-3 py-3 text-right font-semibold">Games</th>
                    <th scope="col" className="px-3 py-3 font-semibold">Status</th>
                    <th scope="col" className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id} className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-xl" aria-hidden>
                            {p.avatar}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold">
                              {p.username} {p.role === 'admin' && <span className="ml-1 text-xs font-bold uppercase text-gold-300">Admin</span>}
                            </p>
                            <p className="truncate text-xs text-subtle">{p.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="tabular px-3 py-3 text-right">{formatINR(p.virtualBalance)}</td>
                      <td className="tabular px-3 py-3 text-right">{p.level}</td>
                      <td className="px-3 py-3">
                        <ProfileBadge name={p.profileName} />
                      </td>
                      <td className="tabular px-3 py-3 text-right">{p.games.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-3">
                        <StatusBadge status={p.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <Link to={`/admin/players/${p.id}`}>
                            <Button size="sm" variant="secondary" tabIndex={-1}>
                              View
                            </Button>
                          </Link>
                          <Button size="sm" onClick={() => setConfiguring(p)}>
                            Configure
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Mobile cards (PRD §23, §46) */}
          <ul className="space-y-3 md:hidden">
            {rows.map((p) => (
              <li key={p.id}>
                <Panel className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="flex items-center gap-2 font-semibold">
                      <span aria-hidden>{p.avatar}</span> {p.username}
                    </p>
                    <StatusBadge status={p.status} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-sm">
                    <dt className="text-muted">Balance</dt>
                    <dd className="tabular text-right">{formatINR(p.virtualBalance)}</dd>
                    <dt className="text-muted">Level</dt>
                    <dd className="text-right">{p.level}</dd>
                    <dt className="text-muted">Profile</dt>
                    <dd className="text-right">{p.profileName}</dd>
                    <dt className="text-muted">Games</dt>
                    <dd className="text-right">{p.games}</dd>
                  </dl>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Link to={`/admin/players/${p.id}`}>
                      <Button variant="secondary" block tabIndex={-1}>
                        View
                      </Button>
                    </Link>
                    <Button block onClick={() => setConfiguring(p)}>
                      Configure
                    </Button>
                  </div>
                </Panel>
              </li>
            ))}
          </ul>
          {players.hasNextPage && (
            <Button variant="secondary" block className="mt-4" loading={players.isFetchingNextPage} onClick={() => void players.fetchNextPage()}>
              Load more
            </Button>
          )}
        </>
      )}
      {configuring && <ProbabilityModal player={configuring} open onClose={() => setConfiguring(null)} />}
    </>
  );
}
