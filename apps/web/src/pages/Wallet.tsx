import { CURRENCY, type TransactionFilter } from '@casino/shared';
import { Ban, History } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { AnimatedAmount } from '../components/Amount';
import { FilterChips } from '../components/FilterChips';
import { EmptyState, ErrorState } from '../components/States';
import { TransactionList } from '../components/TransactionList';
import { VirtualNotice } from '../components/VirtualNotice';
import { Button, PageHeader, Panel, Skeleton } from '../components/ui';
import { useTransactions, useWallet } from '../lib/queries';

const FILTERS: { value: TransactionFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'wins', label: 'Wins' },
  { value: 'bets', label: 'Bets' },
  { value: 'rewards', label: 'Rewards' },
  { value: 'bonuses', label: 'Bonuses' },
];

export default function WalletPage() {
  const wallet = useWallet();
  const [filter, setFilter] = useState<TransactionFilter>('all');
  const txns = useTransactions(filter);
  const items = txns.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <>
      <PageHeader title="Wallet" subtitle="Your virtual balance and every change to it." />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[380px_1fr] lg:items-start">
        <div className="space-y-4 lg:sticky lg:top-24">
          <Panel className="relative overflow-hidden p-6 text-center">
            <div aria-hidden className="absolute inset-x-0 -top-24 mx-auto size-64 rounded-full bg-gold-400/10 blur-3xl" />
            <p className="relative font-display text-5xl font-semibold leading-none">
              {wallet.data ? <AnimatedAmount value={wallet.data.virtualBalance} /> : <Skeleton className="mx-auto h-12 w-44" />}
            </p>
            <p className="relative mt-2 font-semibold">Virtual Balance</p>
            <p className="relative text-sm text-muted">No Cash Value</p>
            <VirtualNotice variant="banner" className="relative mt-5" />
            <p className="relative mt-3 font-mono text-xs text-subtle">currency: {CURRENCY}</p>
          </Panel>
          <Panel className="p-4">
            <p className="flex items-center gap-2 font-semibold">
              <Ban className="size-4 text-gold-300" aria-hidden /> What virtual ₹ can’t do
            </p>
            <p className="mt-1 text-sm text-muted">
              No deposits, withdrawals, cash-out, crypto conversion, transfers between players, or redemption for goods or services.
            </p>
          </Panel>
          <Link to="/history" className="block">
            <Button variant="secondary" block tabIndex={-1}>
              <History className="size-4" aria-hidden /> Game history
            </Button>
          </Link>
        </div>

        <Panel className="p-4 md:p-5">
          <h2 className="mb-3 text-lg font-semibold md:text-[22px]">Transactions</h2>
          <FilterChips options={FILTERS} value={filter} onChange={setFilter} label="Filter transactions" />
          <div className="mt-3">
            {txns.isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : txns.error ? (
              <ErrorState message="Couldn’t load transactions." onRetry={() => void txns.refetch()} />
            ) : items.length === 0 ? (
              <EmptyState title="Nothing here yet" message="Transactions matching this filter will appear here." action={{ label: 'Explore games', to: '/games' }} />
            ) : (
              <>
                <TransactionList items={items} />
                {txns.hasNextPage && (
                  <Button variant="secondary" block className="mt-3" loading={txns.isFetchingNextPage} onClick={() => void txns.fetchNextPage()}>
                    Load more
                  </Button>
                )}
              </>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
