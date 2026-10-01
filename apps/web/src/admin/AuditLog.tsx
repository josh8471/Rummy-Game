import type { AuditLogItem } from '@casino/shared';
import { Lock, ScrollText } from 'lucide-react';
import { EmptyState, ErrorState } from '../components/States';
import { Button, PageHeader, Panel, Skeleton } from '../components/ui';
import { dateTimeLabel, formatINR } from '../lib/format';
import { useAuditLogs } from './data';

const ACTION_LABEL: Record<string, string> = {
  PROBABILITY_PROFILE_CHANGED: 'Probability changed',
  PLAYER_STATUS_CHANGED: 'Status changed',
  BALANCE_ADJUSTED: 'Balance adjusted',
  PROFILE_CREATED: 'Profile created',
  PROFILE_UPDATED: 'Profile updated',
  GAME_CONFIG_CHANGED: 'Game config changed',
};

type Snapshot = Record<string, unknown> | null;

function chances(v: Snapshot): string {
  if (!v) return '';
  return `W${v.winChance} S${v.smallWinChance} B${v.bigWinChance} L${v.lossChance}`;
}

/** Human-readable "previous → new" for each audited action. */
function describe(entry: AuditLogItem): { previous: string; next: string } {
  const o = entry.oldValue as Snapshot;
  const n = entry.newValue as Snapshot;
  switch (entry.action) {
    case 'PROBABILITY_PROFILE_CHANGED':
      return { previous: o ? `${o.profileName} (${chances(o)})` : '—', next: n ? `${n.profileName} (${chances(n)})` : '—' };
    case 'PROFILE_CREATED':
    case 'PROFILE_UPDATED':
      return { previous: o ? `${o.profileName} (${chances(o)})` : '—', next: n ? `${n.profileName} (${chances(n)})` : '—' };
    case 'BALANCE_ADJUSTED':
      return {
        previous: o ? formatINR(Number(o.virtualBalance)) : '—',
        next: n ? `${formatINR(Number(n.virtualBalance))} (${formatINR(Number(n.amount), { sign: true })})` : '—',
      };
    case 'PLAYER_STATUS_CHANGED':
      return { previous: String(o?.status ?? '—'), next: String(n?.status ?? '—') };
    case 'GAME_CONFIG_CHANGED': {
      const fmt = (v: Snapshot) => (v ? `${v.gameId}: ${v.enabled ? 'enabled' : 'paused'}, ${formatINR(Number(v.minBet))}–${formatINR(Number(v.maxBet))}` : '—');
      return { previous: fmt(o), next: fmt(n) };
    }
    default:
      return { previous: o ? JSON.stringify(o) : '—', next: n ? JSON.stringify(n) : '—' };
  }
}

export function AuditLogPage() {
  const logs = useAuditLogs();
  const items = logs.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <>
      <PageHeader title="Audit log" subtitle="Every admin change, with who, when and why." />
      <p className="mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-muted">
        <Lock className="size-4 shrink-0 text-gold-300" aria-hidden />
        Audit records are append-only. They can’t be edited or deleted by anyone — the database itself rejects changes.
      </p>
      {logs.error ? (
        <ErrorState message="Couldn’t load the audit log." onRetry={() => void logs.refetch()} />
      ) : logs.isLoading ? (
        <Skeleton className="h-80" />
      ) : items.length === 0 ? (
        <EmptyState icon={<ScrollText className="size-7" aria-hidden />} title="No admin changes yet" />
      ) : (
        <>
          <Panel className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Admin audit log</caption>
              <thead>
                <tr className="border-b border-white/[0.07] text-left text-xs uppercase tracking-wider text-subtle">
                  <th scope="col" className="px-4 py-3 font-semibold">Changed</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Admin</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Action</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Player</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Previous</th>
                  <th scope="col" className="px-3 py-3 font-semibold">New</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => {
                  const d = describe(e);
                  return (
                    <tr key={e.id} className="border-b border-white/[0.05] align-top last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{dateTimeLabel(e.createdAt)}</td>
                      <td className="px-3 py-3 font-medium">{e.adminUsername}</td>
                      <td className="px-3 py-3">{ACTION_LABEL[e.action] ?? e.action}</td>
                      <td className="px-3 py-3">{e.targetUsername ?? '—'}</td>
                      <td className="px-3 py-3 text-muted">{d.previous}</td>
                      <td className="px-3 py-3">{d.next}</td>
                      <td className="px-4 py-3 text-muted">{e.reason}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
          <ul className="space-y-3 lg:hidden">
            {items.map((e) => {
              const d = describe(e);
              return (
                <li key={e.id}>
                  <Panel className="p-4">
                    <p className="font-semibold">{ACTION_LABEL[e.action] ?? e.action}</p>
                    <dl className="mt-2 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 text-sm">
                      <dt className="text-muted">Admin</dt>
                      <dd>{e.adminUsername}</dd>
                      <dt className="text-muted">Player</dt>
                      <dd>{e.targetUsername ?? '—'}</dd>
                      <dt className="text-muted">Previous</dt>
                      <dd className="break-words">{d.previous}</dd>
                      <dt className="text-muted">New</dt>
                      <dd className="break-words">{d.next}</dd>
                      <dt className="text-muted">Changed</dt>
                      <dd>{dateTimeLabel(e.createdAt)}</dd>
                      <dt className="text-muted">Reason</dt>
                      <dd className="break-words">{e.reason}</dd>
                    </dl>
                  </Panel>
                </li>
              );
            })}
          </ul>
          {logs.hasNextPage && (
            <Button variant="secondary" block className="mt-4" loading={logs.isFetchingNextPage} onClick={() => void logs.fetchNextPage()}>
              Load more
            </Button>
          )}
        </>
      )}
    </>
  );
}
