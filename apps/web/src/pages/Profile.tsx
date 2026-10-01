import { AVATARS, GAMES, OUTCOME_LABEL, OUTCOMES, type Outcome } from '@casino/shared';
import { useMutation } from '@tanstack/react-query';
import { Coffee, LogOut, Pencil, ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Modal } from '../components/Modal';
import { OutcomeBadge } from '../components/OutcomeBadge';
import { ErrorState } from '../components/States';
import { Button, PageHeader, Panel, ProgressBar, SectionTitle, Skeleton, StatTile } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { useLogout } from '../lib/auth';
import { cn, durationLabel, formatINR } from '../lib/format';
import { touchPlaySession } from '../lib/playSession';
import { keys, queryClient, useProfile } from '../lib/queries';
import { useSettings } from '../lib/settings';

const BAR: Record<Outcome, string> = {
  LOSS: 'bg-loss/70',
  SMALL_WIN: 'bg-win/50',
  WIN: 'bg-win',
  BIG_WIN: 'bg-gold-400',
};

function AvatarPicker({ open, onClose, current }: { open: boolean; onClose: () => void; current: string }) {
  const save = useMutation({
    mutationFn: (avatar: string) => api.put('/api/profile', { avatar }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.me });
      void queryClient.invalidateQueries({ queryKey: ['player', 'profile'] });
      onClose();
    },
  });
  return (
    <Modal open={open} onClose={onClose} title="Choose an avatar">
      <div className="grid grid-cols-4 gap-2">
        {AVATARS.map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={a === current}
            aria-label={`Avatar ${a}`}
            onClick={() => save.mutate(a)}
            className={cn(
              'flex aspect-square items-center justify-center rounded-2xl border text-3xl transition',
              a === current ? 'border-gold-400/70 bg-gold-400/15' : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.08]',
            )}
          >
            <span aria-hidden>{a}</span>
          </button>
        ))}
      </div>
      {save.error && (
        <p role="alert" className="mt-3 text-sm text-loss">
          {errorMessage(save.error)}
        </p>
      )}
    </Modal>
  );
}

export default function ProfilePage() {
  const [start] = useState(() => touchPlaySession());
  const profile = useProfile(true, start);
  const logout = useLogout();
  const { settings } = useSettings();
  const [now, setNow] = useState(() => Date.now());
  const [picker, setPicker] = useState(false);

  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);

  if (profile.error) return <ErrorState message="Couldn’t load your profile." onRetry={() => void profile.refetch()} />;
  const p = profile.data;

  return (
    <>
      <PageHeader title="Profile" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr] lg:items-start">
        <div className="space-y-4">
          <Panel className="p-5 text-center">
            {p ? (
              <>
                <button
                  type="button"
                  onClick={() => setPicker(true)}
                  aria-label="Change avatar"
                  className="group relative mx-auto flex size-24 items-center justify-center rounded-full border border-gold-400/40 bg-gold-400/10 text-5xl"
                >
                  <span aria-hidden>{p.user.avatar}</span>
                  <span className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full bg-ink-700 text-muted group-hover:text-fg">
                    <Pencil className="size-4" aria-hidden />
                  </span>
                </button>
                <h2 className="mt-3 text-2xl font-semibold">{p.user.username}</h2>
                <p className="text-sm text-muted">{p.user.email}</p>
                <div className="mt-4 text-left">
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-semibold text-gold-200">Level {p.user.level}</span>
                    <span className="tabular text-subtle">
                      {p.user.xp - p.levelProgress.currentLevelXp} / {p.levelProgress.nextLevelXp - p.levelProgress.currentLevelXp} XP
                    </span>
                  </div>
                  <ProgressBar
                    label="Progress to next level"
                    value={p.user.xp - p.levelProgress.currentLevelXp}
                    max={p.levelProgress.nextLevelXp - p.levelProgress.currentLevelXp}
                  />
                  <p className="mt-1.5 text-xs text-subtle">Earn 1 XP for every ₹100 of virtual stake.</p>
                </div>
              </>
            ) : (
              <Skeleton className="h-56" />
            )}
          </Panel>

          <Panel className="p-5">
            <SectionTitle>This session</SectionTitle>
            {p ? (
              <dl className="grid grid-cols-2 gap-3">
                {[
                  ['Session time', durationLabel(now - start)],
                  ['Rounds played', String(p.session.rounds)],
                  ['Virtual won', formatINR(p.session.virtualWon)],
                  ['Virtual lost', formatINR(p.session.virtualLost)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-white/[0.04] p-3">
                    <dt className="text-sm text-muted">{label}</dt>
                    <dd className="tabular mt-0.5 font-display text-lg font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <Skeleton className="h-36" />
            )}
            <p className="mt-3 flex items-start gap-2 text-sm text-muted">
              <Coffee className="mt-0.5 size-4 shrink-0 text-gold-300" aria-hidden />
              <span>
                Break reminder: {settings.breakReminderMinutes > 0 ? `every ${settings.breakReminderMinutes} minutes` : 'off'}.{' '}
                <Link to="/settings" className="font-semibold text-gold-300 hover:text-gold-200">
                  Change
                </Link>
              </span>
            </p>
          </Panel>

          <Button variant="danger" block onClick={() => void logout()}>
            <LogOut className="size-4" aria-hidden /> Sign out
          </Button>
        </div>

        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <StatTile label="Rounds played" value={p ? p.stats.rounds.toLocaleString('en-IN') : '—'} />
            <StatTile label="Total virtual bet" value={p ? formatINR(p.stats.totalBet) : '—'} />
            <StatTile label="Total returned" value={p ? formatINR(p.stats.totalPayout) : '—'} />
            <StatTile
              label="Biggest win"
              value={p ? formatINR(p.stats.biggestWin) : '—'}
              hint={p?.stats.favoriteGame ? `Favourite: ${GAMES[p.stats.favoriteGame].name}` : undefined}
            />
          </div>

          <Panel className="p-5">
            <SectionTitle>Results breakdown</SectionTitle>
            {p ? (
              <ul className="space-y-3">
                {OUTCOMES.map((o) => {
                  const total = Math.max(1, p.stats.rounds);
                  const pct = Math.round((p.stats.outcomes[o] / total) * 100);
                  return (
                    <li key={o} className="grid grid-cols-[110px_1fr_56px] items-center gap-3">
                      <OutcomeBadge outcome={o} className="justify-self-start" />
                      <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden>
                        <div className={cn('h-full rounded-full', BAR[o])} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="tabular text-right text-sm text-muted">
                        {p.stats.outcomes[o]} <span className="sr-only">{OUTCOME_LABEL[o]} rounds</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Skeleton className="h-32" />
            )}
          </Panel>

          <Panel className="p-5">
            <SectionTitle>
              <span className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-gold-300" aria-hidden /> Your simulation profile
              </span>
            </SectionTitle>
            {p ? (
              <>
                <p className="text-muted">
                  Your rounds use the <strong className="text-fg">{p.simulation.profileName}</strong> profile. The server draws a random number
                  from 0 to 100 each round and these chances decide which kind of result the game produces.
                </p>
                <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      ['Win', p.simulation.chances.winChance],
                      ['Small win', p.simulation.chances.smallWinChance],
                      ['Big win', p.simulation.chances.bigWinChance],
                      ['Loss', p.simulation.chances.lossChance],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-white/[0.04] p-3 text-center">
                      <dt className="text-sm text-muted">{label}</dt>
                      <dd className="tabular font-display text-xl font-semibold">{value}%</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-3 text-sm text-subtle">
                  Profiles exist for simulation and testing and are set by administrators. They only affect virtual ₹, which has no cash value.
                </p>
              </>
            ) : (
              <Skeleton className="h-32" />
            )}
          </Panel>
        </div>
      </div>
      {p && <AvatarPicker open={picker} onClose={() => setPicker(false)} current={p.user.avatar} />}
    </>
  );
}
