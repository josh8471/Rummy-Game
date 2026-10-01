import type { DailyClaimResponse, RewardsResponse } from '@casino/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Gift } from 'lucide-react';
import { api, errorMessage } from '../lib/api';
import { cn, formatCompactINR, formatINR } from '../lib/format';
import { keys, useCommitBalance } from '../lib/queries';
import { Button, Panel, Skeleton } from './ui';

export function DailyRewardCard({ rewards, className }: { rewards?: RewardsResponse; className?: string }) {
  const qc = useQueryClient();
  const commit = useCommitBalance();
  const claim = useMutation({
    mutationFn: () => api.post<DailyClaimResponse>('/api/rewards/daily/claim'),
    onSuccess: (res) => {
      commit(res.virtualBalance);
      void qc.invalidateQueries({ queryKey: keys.rewards });
    },
  });

  if (!rewards) return <Skeleton className={cn('h-44', className)} />;
  const { daily } = rewards;
  // Days already banked in the current streak, and which day is next (day 7 repeats).
  const doneCount = daily.claimedToday ? Math.min(daily.streak, 7) : Math.min(daily.streak, 6);
  const nextDay = daily.claimedToday ? null : Math.min(daily.nextStreakDay, 7);

  return (
    <Panel className={cn('relative overflow-hidden p-5', className)}>
      <div aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full bg-gold-400/10 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-muted">
            <Gift className="size-4 text-gold-300" aria-hidden /> Daily reward
          </p>
          <p className="mt-1 font-display text-2xl font-semibold">
            {daily.claimedToday ? (
              <>Claimed today</>
            ) : (
              <>
                {formatINR(daily.nextAmount)} <span className="text-base font-medium text-muted">virtual</span>
              </>
            )}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            {daily.claimedToday
              ? `Day ${daily.streak} streak · tomorrow: ${formatINR(daily.nextAmount)}`
              : daily.streak > 0
                ? `Day ${daily.nextStreakDay} of your streak`
                : 'Claim every day to build a streak'}
          </p>
        </div>
      </div>
      <ol className="relative mt-4 grid grid-cols-7 gap-1.5" aria-label="Seven-day reward ladder">
        {daily.ladder.map((amount, i) => {
          const day = i + 1;
          const done = day <= doneCount;
          const next = day === nextDay;
          return (
            <li
              key={day}
              className={cn(
                'flex flex-col items-center rounded-lg border px-0.5 py-1.5 text-center',
                done ? 'border-win/30 bg-win/10 text-win' : next ? 'border-gold-400/60 bg-gold-400/10 text-gold-200' : 'border-white/[0.08] text-subtle',
              )}
            >
              <span className="text-[10px] font-semibold uppercase">D{day}</span>
              {done ? <Check className="my-0.5 size-3.5" aria-label="claimed" /> : <span className="text-[11px] font-bold">{formatCompactINR(amount).replace('₹', '')}</span>}
            </li>
          );
        })}
      </ol>
      <div className="relative mt-4">
        <Button block disabled={daily.claimedToday} loading={claim.isPending} onClick={() => claim.mutate()}>
          {daily.claimedToday ? 'Come back tomorrow' : `Claim ${formatINR(daily.nextAmount)}`}
        </Button>
        {claim.error && (
          <p role="alert" className="mt-2 text-sm text-loss">
            {errorMessage(claim.error)}
          </p>
        )}
        {claim.isSuccess && (
          <p role="status" className="mt-2 text-sm text-win">
            +{formatINR(claim.data.amount)} virtual added to your wallet.
          </p>
        )}
      </div>
    </Panel>
  );
}
