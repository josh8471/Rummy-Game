import { GAMES } from '@casino/shared';
import { Activity, CalendarClock, Coins, Gamepad2, Users } from 'lucide-react';
import { Link } from 'react-router';
import { ErrorState } from '../components/States';
import { PageHeader, Panel, Skeleton, StatTile } from '../components/ui';
import { dateTimeLabel, formatINR } from '../lib/format';
import { ChartCard, ColumnChart, OutcomeMixChart, OutcomeMixLegend, OutcomeMixTable } from './charts';
import { useOverview } from './data';
import { SecurityEventList } from './Security';

const dayFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dayShort = new Intl.DateTimeFormat('en-IN', { day: 'numeric', timeZone: 'UTC' });

export function OverviewPage() {
  const overview = useOverview();
  if (overview.error) return <ErrorState message="Couldn’t load the dashboard." onRetry={() => void overview.refetch()} />;
  const o = overview.data;

  const perDay =
    o?.roundsPerDay.map((d) => {
      const date = new Date(`${d.date}T00:00:00Z`);
      return { label: dayFmt.format(date), short: dayShort.format(date), value: d.rounds };
    }) ?? [];

  return (
    <>
      <PageHeader title="Dashboard" subtitle="These values represent virtual game data only." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile icon={<Users className="size-4" aria-hidden />} label="Total players" value={o ? o.metrics.totalPlayers.toLocaleString('en-IN') : '—'} />
        <StatTile icon={<Activity className="size-4" aria-hidden />} label="Active players" value={o ? o.metrics.activePlayers.toLocaleString('en-IN') : '—'} hint="Played in the last 24 hours" />
        <StatTile icon={<Coins className="size-4" aria-hidden />} label="Virtual money circulation" value={o ? formatINR(o.metrics.virtualCirculation) : '—'} hint="Sum of all virtual wallets" />
        <StatTile icon={<Gamepad2 className="size-4" aria-hidden />} label="Games played" value={o ? o.metrics.gamesPlayed.toLocaleString('en-IN') : '—'} hint="All-time rounds" />
        <StatTile icon={<CalendarClock className="size-4" aria-hidden />} label="Rounds today" value={o ? o.metrics.roundsToday.toLocaleString('en-IN') : '—'} hint="Since midnight IST" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ChartCard
          title="Rounds per day"
          subtitle="Last 14 days (IST)"
          table={
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-left text-xs uppercase tracking-wider text-subtle">
                  <th scope="col" className="py-2 font-semibold">Day</th>
                  <th scope="col" className="py-2 text-right font-semibold">Rounds</th>
                </tr>
              </thead>
              <tbody>
                {perDay.map((d) => (
                  <tr key={d.label} className="border-b border-white/[0.05] last:border-0">
                    <td className="py-1.5">{d.label}</td>
                    <td className="tabular py-1.5 text-right">{d.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          }
        >
          {o ? <ColumnChart data={perDay} valueLabel="rounds" /> : <Skeleton className="h-52" />}
        </ChartCard>

        <ChartCard
          title="Outcome mix"
          subtitle="Last 30 days · share of settled rounds"
          legend={<OutcomeMixLegend />}
          table={o ? <OutcomeMixTable rows={o.outcomeMix} /> : null}
        >
          {o ? <OutcomeMixChart rows={o.outcomeMix} /> : <Skeleton className="h-52" />}
          <p className="mt-4 text-xs text-subtle">
            Target is what the probability engine drew; actual is what the game produced. They differ when a bet can’t produce the drawn
            outcome (e.g. a single Red bet has no small win) or a player’s own Blackjack decision decides the hand.
          </p>
        </ChartCard>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Panel className="p-4 md:p-5">
          <h2 className="mb-3 text-lg font-semibold">By game</h2>
          <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-left text-xs uppercase tracking-wider text-subtle">
                  <th scope="col" className="py-2 pr-3 font-semibold">Game</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Rounds</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Wagered</th>
                  <th scope="col" className="py-2 pr-3 text-right font-semibold">Paid out</th>
                  <th scope="col" className="py-2 text-right font-semibold">Return</th>
                </tr>
              </thead>
              <tbody>
                {(o?.byGame ?? []).map((g) => (
                  <tr key={g.gameId} className="border-b border-white/[0.05] last:border-0">
                    <th scope="row" className="py-2.5 pr-3 text-left font-medium">{GAMES[g.gameId].name}</th>
                    <td className="tabular py-2.5 pr-3 text-right">{g.rounds.toLocaleString('en-IN')}</td>
                    <td className="tabular py-2.5 pr-3 text-right">{formatINR(g.wagered)}</td>
                    <td className="tabular py-2.5 pr-3 text-right">{formatINR(g.paid)}</td>
                    <td className="tabular py-2.5 text-right">{g.wagered > 0 ? `${Math.round((g.paid / g.wagered) * 100)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!o && <Skeleton className="h-40" />}
        </Panel>

        <Panel className="p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent security events</h2>
            <Link to="/admin/security" className="text-sm font-semibold text-gold-300 hover:text-gold-200">
              View all
            </Link>
          </div>
          {o ? <SecurityEventList events={o.recentSecurityEvents} compact /> : <Skeleton className="h-40" />}
          {o && o.recentSecurityEvents.length > 0 && (
            <p className="mt-2 text-xs text-subtle">Latest: {dateTimeLabel(o.recentSecurityEvents[0]!.createdAt)}</p>
          )}
        </Panel>
      </div>
    </>
  );
}
