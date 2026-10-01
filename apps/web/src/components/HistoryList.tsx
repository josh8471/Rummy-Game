import type { HistoryItem, TransactionType } from '@casino/shared';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';
import { cn, dateTimeLabel, formatINR } from '../lib/format';
import { Delta } from './Amount';
import { Modal } from './Modal';
import { OutcomeBadge } from './OutcomeBadge';
import { ErrorState, LoadingState } from './States';

interface RoundDetailResponse {
  item: HistoryItem;
  detail: unknown;
  transactions: { type: TransactionType; amount: number; description: string }[];
}

function net(item: HistoryItem) {
  return (item.payout ?? 0) - item.betAmount;
}

function RoundDetail({ roundId }: { roundId: string }) {
  const q = useQuery({ queryKey: ['player', 'round', roundId], queryFn: () => api.get<RoundDetailResponse>(`/api/games/rounds/${roundId}`) });
  if (q.isLoading) return <LoadingState />;
  if (q.error || !q.data) return <ErrorState message="Couldn’t load this round." onRetry={() => void q.refetch()} />;
  const { item, transactions } = q.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-white/[0.04] p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Bet</p>
          <p className="tabular mt-1 font-display text-lg font-semibold">{formatINR(item.betAmount)}</p>
        </div>
        <div className="rounded-xl bg-white/[0.04] p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Result</p>
          <div className="mt-1.5">{item.outcome ? <OutcomeBadge outcome={item.outcome} /> : '—'}</div>
        </div>
        <div className="rounded-xl bg-white/[0.04] p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-subtle">Payout</p>
          <p className="tabular mt-1 font-display text-lg font-semibold">{formatINR(item.payout ?? 0)}</p>
        </div>
      </div>
      <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-center font-medium">{item.summary}</p>
      <div>
        <p className="mb-2 text-sm font-semibold text-muted">Wallet entries</p>
        <ul className="space-y-1.5">
          {transactions.map((t, i) => (
            <li key={i} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2">
              <span>{t.description}</span>
              <Delta amount={t.amount} />
            </li>
          ))}
        </ul>
      </div>
      <p className="text-center text-xs text-subtle">
        Round #{item.roundId} · {dateTimeLabel(item.createdAt)} · Virtual ₹ only
      </p>
    </div>
  );
}

/** Desktop: table. Mobile: stacked cards (PRD §19). */
export function HistoryList({ items }: { items: HistoryItem[] }) {
  const [selected, setSelected] = useState<HistoryItem | null>(null);
  return (
    <>
      <div className="hidden md:block">
        <table className="w-full text-left">
          <caption className="sr-only">Game history</caption>
          <thead>
            <tr className="border-b border-white/[0.07] text-xs uppercase tracking-wider text-subtle">
              <th scope="col" className="py-2.5 pr-3 font-semibold">
                Game
              </th>
              <th scope="col" className="py-2.5 pr-3 font-semibold">
                Result
              </th>
              <th scope="col" className="py-2.5 pr-3 text-right font-semibold">
                Bet
              </th>
              <th scope="col" className="py-2.5 pr-3 text-right font-semibold">
                Payout
              </th>
              <th scope="col" className="py-2.5 pr-3 text-right font-semibold">
                Net
              </th>
              <th scope="col" className="py-2.5 text-right font-semibold">
                Time
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.roundId} className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.03]">
                <td className="py-3 pr-3">
                  <button type="button" onClick={() => setSelected(item)} className="text-left font-semibold hover:text-gold-200">
                    {item.gameName}
                    <span className="block text-sm font-normal text-muted">{item.summary}</span>
                  </button>
                </td>
                <td className="py-3 pr-3">{item.outcome ? <OutcomeBadge outcome={item.outcome} /> : <span className="text-sm text-muted">In progress</span>}</td>
                <td className="tabular py-3 pr-3 text-right">{formatINR(item.betAmount)}</td>
                <td className="tabular py-3 pr-3 text-right">{item.payout === null ? '—' : formatINR(item.payout)}</td>
                <td className="py-3 pr-3 text-right">{item.payout === null ? '—' : <Delta amount={net(item)} />}</td>
                <td className="py-3 text-right text-sm text-muted">{dateTimeLabel(item.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2.5 md:hidden">
        {items.map((item) => (
          <li key={item.roundId}>
            <button
              type="button"
              onClick={() => setSelected(item)}
              className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5 text-left transition-colors hover:bg-white/[0.04]"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{item.gameName}</span>
                {item.outcome ? <OutcomeBadge outcome={item.outcome} /> : <span className="text-sm text-muted">In progress</span>}
              </div>
              <p className="mt-0.5 truncate text-sm text-muted">{item.summary}</p>
              <div className="mt-2 flex items-center justify-between text-[15px]">
                <span className="tabular">
                  {formatINR(item.betAmount)} → {item.payout === null ? '…' : formatINR(item.payout)}
                </span>
                {item.payout !== null && <Delta amount={net(item)} />}
              </div>
              <p className={cn('mt-1 text-xs text-subtle')}>{dateTimeLabel(item.createdAt)}</p>
            </button>
          </li>
        ))}
      </ul>
      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected ? `${selected.gameName} round` : 'Round'} description="Virtual ₹ only · No cash value">
        {selected && <RoundDetail roundId={selected.roundId} />}
      </Modal>
    </>
  );
}
