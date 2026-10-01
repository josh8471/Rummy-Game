import type { TransactionItem, TransactionType } from '@casino/shared';
import { ArrowDownLeft, ArrowUpRight, Gift, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { cn, dateTimeLabel, dayLabel, formatINR } from '../lib/format';
import { Delta } from './Amount';
import { Modal } from './Modal';

const ICON: Record<TransactionType, typeof Gift> = {
  BET: ArrowUpRight,
  WIN: ArrowDownLeft,
  DAILY_REWARD: Gift,
  BONUS: Sparkles,
  ADMIN_ADJUSTMENT: ShieldCheck,
};

const TYPE_LABEL: Record<TransactionType, string> = {
  BET: 'Bet',
  WIN: 'Win',
  DAILY_REWARD: 'Daily reward',
  BONUS: 'Bonus',
  ADMIN_ADJUSTMENT: 'Adjustment',
};

function TransactionRow({ item, onSelect }: { item: TransactionItem; onSelect: () => void }) {
  const Icon = ICON[item.type];
  const positive = item.amount > 0;
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-white/[0.04]"
      >
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-xl',
            positive ? 'bg-win/10 text-win' : 'bg-white/[0.06] text-muted',
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{item.description}</span>
          <span className="block text-sm text-subtle">{dateTimeLabel(item.createdAt)}</span>
        </span>
        <Delta amount={item.amount} className="shrink-0 text-[15px]" />
      </button>
    </li>
  );
}

/** Transactions grouped by day, each opening a details sheet. */
export function TransactionList({ items }: { items: TransactionItem[] }) {
  const [selected, setSelected] = useState<TransactionItem | null>(null);
  const groups: { day: string; items: TransactionItem[] }[] = [];
  for (const item of items) {
    const day = dayLabel(item.createdAt);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return (
    <>
      <div className="space-y-4">
        {groups.map((group) => (
          <section key={group.day} aria-label={group.day}>
            <h3 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wider text-subtle">{group.day}</h3>
            <ul>
              {group.items.map((item) => (
                <TransactionRow key={item.id} item={item} onSelect={() => setSelected(item)} />
              ))}
            </ul>
          </section>
        ))}
      </div>
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Transaction details" description="Virtual ₹ only · No cash value">
        {selected && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[15px]">
            <dt className="text-muted">Type</dt>
            <dd className="text-right font-medium">{TYPE_LABEL[selected.type]}</dd>
            <dt className="text-muted">Description</dt>
            <dd className="text-right font-medium">{selected.description}</dd>
            <dt className="text-muted">Amount</dt>
            <dd className="text-right">
              <Delta amount={selected.amount} />
            </dd>
            <dt className="text-muted">Balance before</dt>
            <dd className="tabular text-right">{formatINR(selected.balanceBefore)}</dd>
            <dt className="text-muted">Balance after</dt>
            <dd className="tabular text-right">{formatINR(selected.balanceAfter)}</dd>
            {selected.roundId && (
              <>
                <dt className="text-muted">Round ID</dt>
                <dd className="tabular text-right">#{selected.roundId}</dd>
              </>
            )}
            <dt className="text-muted">Currency</dt>
            <dd className="text-right font-mono text-sm">{selected.currency}</dd>
            <dt className="text-muted">Time</dt>
            <dd className="text-right">{dateTimeLabel(selected.createdAt)}</dd>
          </dl>
        )}
      </Modal>
    </>
  );
}
