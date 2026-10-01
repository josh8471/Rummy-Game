import { ArrowLeft, Ban, CircleCheck, Coins, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Delta } from '../components/Amount';
import { OutcomeBadge } from '../components/OutcomeBadge';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { TransactionList } from '../components/TransactionList';
import { Button, Panel, StatTile } from '../components/ui';
import { dateTimeLabel, formatINR } from '../lib/format';
import { ChartCard, OutcomeMixChart, OutcomeMixLegend, OutcomeMixTable } from './charts';
import { usePlayer } from './data';
import { AdjustBalanceModal, ProbabilityModal, StatusModal } from './forms';
import { ProfileBadge, StatusBadge } from './Players';

export function PlayerDetailPage() {
  const { playerId = '' } = useParams();
  const detail = usePlayer(playerId);
  const [modal, setModal] = useState<'probability' | 'balance' | 'status' | null>(null);

  if (detail.isLoading) return <LoadingState />;
  if (detail.error || !detail.data) return <ErrorState message="Couldn’t load this player." onRetry={() => void detail.refetch()} />;
  const { player, chances, outcomeMix, recentRounds, transactions } = detail.data;

  return (
    <>
      <Link to="/admin/players" className="mb-3 inline-flex h-11 items-center gap-1.5 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="size-4" aria-hidden /> All players
      </Link>
      <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-14 items-center justify-center rounded-full bg-white/[0.06] text-3xl" aria-hidden>
            {player.avatar}
          </span>
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold md:text-[32px]">
              {player.username} <StatusBadge status={player.status} />
            </h1>
            <p className="text-sm text-muted">
              {player.email} · joined {dateTimeLabel(player.createdAt)}
            </p>
          </div>
        </div>
        <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto">
          <Button onClick={() => setModal('probability')}>
            <SlidersHorizontal className="size-4" aria-hidden /> Configure probability
          </Button>
          <Button variant="secondary" onClick={() => setModal('balance')}>
            <Coins className="size-4" aria-hidden /> Adjust balance
          </Button>
          <Button variant={player.status === 'active' ? 'danger' : 'success'} onClick={() => setModal('status')}>
            {player.status === 'active' ? <Ban className="size-4" aria-hidden /> : <CircleCheck className="size-4" aria-hidden />}
            {player.status === 'active' ? 'Suspend' : 'Reactivate'}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Virtual balance" value={formatINR(player.virtualBalance)} />
        <StatTile label="Level" value={player.level} hint={`${player.xp.toLocaleString('en-IN')} XP`} />
        <StatTile label="Games played" value={player.games.toLocaleString('en-IN')} hint={player.lastActiveAt ? `Last: ${dateTimeLabel(player.lastActiveAt)}` : 'No rounds yet'} />
        <StatTile
          label="Profile"
          value={<ProfileBadge name={player.profileName} />}
          hint={`W ${chances.winChance} · S ${chances.smallWinChance} · B ${chances.bigWinChance} · L ${chances.lossChance}`}
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1fr_1.5fr]">
        <ChartCard title="Outcome mix" subtitle="All settled rounds for this player" legend={<OutcomeMixLegend />} table={<OutcomeMixTable rows={outcomeMix} />}>
          <OutcomeMixChart rows={outcomeMix} />
        </ChartCard>

        <Panel className="p-4 md:p-5">
          <h2 className="mb-3 text-lg font-semibold">Recent rounds</h2>
          {recentRounds.length === 0 ? (
            <EmptyState title="No games played yet." />
          ) : (
            <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
              <table className="w-full min-w-[720px] text-sm">
                <caption className="sr-only">Recent rounds with probability engine details</caption>
                <thead>
                  <tr className="border-b border-white/[0.07] text-left text-xs uppercase tracking-wider text-subtle">
                    <th scope="col" className="py-2 pr-3 font-semibold">Round</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Game</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">Bet</th>
                    <th scope="col" className="py-2 pr-3 text-right font-semibold">Random</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Target</th>
                    <th scope="col" className="py-2 pr-3 font-semibold">Outcome</th>
                    <th scope="col" className="py-2 text-right font-semibold">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRounds.map((r) => (
                    <tr key={r.roundId} className="border-b border-white/[0.05] last:border-0">
                      <td className="py-2 pr-3">
                        <span className="tabular font-mono text-xs">#{r.roundId}</span>
                        <span className="block text-xs text-subtle">{dateTimeLabel(r.createdAt)}</span>
                      </td>
                      <td className="py-2 pr-3">
                        {r.gameName}
                        <span className="block max-w-[180px] truncate text-xs text-subtle" title={r.summary}>
                          {r.summary} · {r.profileName}
                        </span>
                      </td>
                      <td className="tabular py-2 pr-3 text-right">{formatINR(r.betAmount)}</td>
                      <td className="tabular py-2 pr-3 text-right">{r.randomValue.toFixed(2)}</td>
                      <td className="py-2 pr-3">
                        <OutcomeBadge outcome={r.targetOutcome} />
                      </td>
                      <td className="py-2 pr-3">{r.outcome ? <OutcomeBadge outcome={r.outcome} /> : <span className="text-muted">In play</span>}</td>
                      <td className="py-2 text-right">{r.payout === null ? '—' : <Delta amount={r.payout - r.betAmount} />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <Panel className="mt-5 p-4 md:p-5">
        <h2 className="mb-3 text-lg font-semibold">Wallet transactions</h2>
        {transactions.length === 0 ? <EmptyState title="No transactions" /> : <TransactionList items={transactions} />}
      </Panel>

      <ProbabilityModal player={player} current={chances} open={modal === 'probability'} onClose={() => setModal(null)} />
      <AdjustBalanceModal player={player} open={modal === 'balance'} onClose={() => setModal(null)} />
      <StatusModal player={player} open={modal === 'status'} onClose={() => setModal(null)} />
    </>
  );
}
