import { GAMES, type AdminGameConfig } from '@casino/shared';
import { Pencil } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { GameArt } from '../components/GameArt';
import { Modal } from '../components/Modal';
import { ErrorState } from '../components/States';
import { Button, Field, inputClass, PageHeader, Panel, Skeleton } from '../components/ui';
import { errorMessage } from '../lib/api';
import { cn, formatINR } from '../lib/format';
import { useAdminGames, useAdminMutation } from './data';

function EditGameModal({ game, onClose }: { game: AdminGameConfig | null; onClose: () => void }) {
  const ids = { min: useId(), max: useId(), reason: useId() };
  const [enabled, setEnabled] = useState(true);
  const [minBet, setMinBet] = useState('');
  const [maxBet, setMaxBet] = useState('');
  const [reason, setReason] = useState('');
  const save = useAdminMutation<Record<string, unknown>>('put', () => `/api/admin/games/${game?.id}`);

  useEffect(() => {
    if (!game) return;
    setEnabled(game.enabled);
    setMinBet(String(game.minBet));
    setMaxBet(String(game.maxBet));
    setReason('');
    save.reset();
  }, [game]);

  const min = Number(minBet);
  const max = Number(maxBet);
  const betError =
    !Number.isInteger(min) || !Number.isInteger(max) || min < 10 || min % 10 !== 0 || max % 10 !== 0
      ? 'Bets must be whole multiples of ₹10.'
      : min > max
        ? 'Minimum bet cannot exceed maximum bet.'
        : null;
  const valid = !betError && reason.trim().length >= 3;

  return (
    <Modal
      open={!!game}
      onClose={onClose}
      title={game ? `Configure ${game.name}` : ''}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={save.isPending} onClick={() => save.mutate({ enabled, minBet: min, maxBet: max, reason }, { onSuccess: onClose })}>
            SAVE
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
          <span>
            <span className="block font-semibold">Game enabled</span>
            <span className="text-sm text-muted">Players can start new rounds</span>
          </span>
          <input type="checkbox" role="switch" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-6 accent-[#f7c948]" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Minimum bet (₹)" htmlFor={ids.min}>
            <input id={ids.min} type="number" inputMode="numeric" step={10} className={cn(inputClass, 'tabular')} value={minBet} onChange={(e) => setMinBet(e.target.value)} />
          </Field>
          <Field label="Maximum bet (₹)" htmlFor={ids.max}>
            <input id={ids.max} type="number" inputMode="numeric" step={10} className={cn(inputClass, 'tabular')} value={maxBet} onChange={(e) => setMaxBet(e.target.value)} />
          </Field>
        </div>
        {betError && (
          <p role="alert" className="text-sm text-loss">
            {betError}
          </p>
        )}
        <Field label="Reason (recorded in the audit log)" htmlFor={ids.reason}>
          <input id={ids.reason} className={inputClass} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Balancing test" />
        </Field>
        {save.error && (
          <p role="alert" className="text-sm text-loss">
            {errorMessage(save.error)}
          </p>
        )}
      </div>
    </Modal>
  );
}

export function GamesConfigPage() {
  const games = useAdminGames();
  const [editing, setEditing] = useState<AdminGameConfig | null>(null);
  return (
    <>
      <PageHeader title="Game configuration" subtitle="Enable or pause games and set virtual bet limits. Every change is audited." />
      {games.error ? (
        <ErrorState message="Couldn’t load games." onRetry={() => void games.refetch()} />
      ) : !games.data ? (
        <Skeleton className="h-80" />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {games.data.map((g) => (
            <li key={g.id}>
              <Panel className="overflow-hidden">
                <div className="aspect-[16/6]">
                  <GameArt gameId={g.id} accent={GAMES[g.id].accent} />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold">{g.name}</h2>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-bold uppercase',
                        g.enabled ? 'bg-win/12 text-win' : 'bg-white/[0.08] text-muted',
                      )}
                    >
                      {g.enabled ? '● Enabled' : '○ Paused'}
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <dt className="text-muted">Min bet</dt>
                      <dd className="tabular font-semibold">{formatINR(g.minBet)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Max bet</dt>
                      <dd className="tabular font-semibold">{formatINR(g.maxBet)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted">Rounds</dt>
                      <dd className="tabular font-semibold">{g.rounds.toLocaleString('en-IN')}</dd>
                    </div>
                  </dl>
                  <Button variant="secondary" block className="mt-4" onClick={() => setEditing(g)}>
                    <Pencil className="size-4" aria-hidden /> Configure
                  </Button>
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}
      <EditGameModal game={editing} onClose={() => setEditing(null)} />
    </>
  );
}
