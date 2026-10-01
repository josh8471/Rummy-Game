import type { SecurityEventItem } from '@casino/shared';
import { ShieldCheck, TriangleAlert } from 'lucide-react';
import { EmptyState, ErrorState } from '../components/States';
import { PageHeader, Panel, Skeleton } from '../components/ui';
import { dateTimeLabel } from '../lib/format';
import { useSecurityEvents } from './data';

const TYPE_LABEL: Record<string, string> = {
  TAMPER_ATTEMPT: 'Tamper attempt',
  RATE_LIMITED: 'Rate limited',
  REPEATED_LOGIN_FAILURE: 'Repeated login failures',
  CSRF_BLOCKED: 'Cross-site request blocked',
  ADMIN_ACCESS_DENIED: 'Admin access denied',
};

export function SecurityEventList({ events, compact }: { events: SecurityEventItem[]; compact?: boolean }) {
  if (events.length === 0) {
    return <EmptyState icon={<ShieldCheck className="size-7" aria-hidden />} title="All quiet" message="No suspicious activity recorded." className="py-6" />;
  }
  return (
    <ul className="divide-y divide-white/[0.06]">
      {events.map((e) => (
        <li key={e.id} className="flex gap-3 py-2.5">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-gold-300" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 text-sm">
              <span className="font-semibold">{TYPE_LABEL[e.type] ?? e.type}</span>
              {e.username && <span className="text-muted">· {e.username}</span>}
              {!compact && e.ip && <span className="font-mono text-xs text-subtle">{e.ip}</span>}
            </p>
            <p className={compact ? 'truncate text-sm text-muted' : 'text-sm text-muted'}>{e.detail}</p>
            {!compact && <p className="text-xs text-subtle">{dateTimeLabel(e.createdAt)}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SecurityPage() {
  const events = useSecurityEvents();
  return (
    <>
      <PageHeader
        title="Security events"
        subtitle="Abuse detection: rate-limit hits, tampered requests, failed sign-ins, blocked cross-site requests and denied admin access."
      />
      <Panel className="p-4 md:p-5">
        {events.error ? (
          <ErrorState message="Couldn’t load security events." onRetry={() => void events.refetch()} />
        ) : events.data ? (
          <SecurityEventList events={events.data} />
        ) : (
          <Skeleton className="h-64" />
        )}
      </Panel>
    </>
  );
}
