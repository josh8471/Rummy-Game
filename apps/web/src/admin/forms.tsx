import {
  PROBABILITY_TOTAL_ERROR,
  totalChance,
  type AdminPlayerRow,
  type Chances,
  type ProfileItem,
} from '@casino/shared';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { Modal } from '../components/Modal';
import { Button, Field, inputClass } from '../components/ui';
import { errorMessage } from '../lib/api';
import { cn, formatINR } from '../lib/format';
import { RangeBar } from './charts';
import { useAdminMutation, useProfiles } from './data';

const CHANCE_FIELDS: { key: keyof Chances; label: string }[] = [
  { key: 'winChance', label: 'Win chance' },
  { key: 'smallWinChance', label: 'Small win chance' },
  { key: 'bigWinChance', label: 'Big win chance' },
  { key: 'lossChance', label: 'Loss chance' },
];

const sameChances = (a: Chances, b: Chances) => CHANCE_FIELDS.every(({ key }) => a[key] === b[key]);

/** Four percentage inputs with a live total and the PRD §24 validation message. */
function ChanceInputs({ values, onChange, disabled }: { values: Chances; onChange: (v: Chances) => void; disabled?: boolean }) {
  const id = useId();
  const total = totalChance(values);
  const ok = total === 100;
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        {CHANCE_FIELDS.map(({ key, label }) => (
          <Field key={key} label={label} htmlFor={`${id}-${key}`}>
            <div className="relative">
              <input
                id={`${id}-${key}`}
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                step={1}
                disabled={disabled}
                className={cn(inputClass, 'tabular pr-9')}
                value={Number.isFinite(values[key]) ? values[key] : ''}
                onChange={(e) => onChange({ ...values, [key]: e.target.value === '' ? Number.NaN : Number(e.target.value) })}
              />
              <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted">%</span>
            </div>
          </Field>
        ))}
      </div>
      <div
        className={cn(
          'mt-3 flex items-center justify-between rounded-xl border px-3.5 py-2.5',
          ok ? 'border-win/30 bg-win/[0.07]' : 'border-loss/40 bg-loss/10',
        )}
        role={ok ? undefined : 'alert'}
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          {ok ? <CircleCheck className="size-4 text-win" aria-hidden /> : <TriangleAlert className="size-4 text-loss" aria-hidden />}
          {ok ? 'Total' : PROBABILITY_TOTAL_ERROR}
        </span>
        <span className="tabular font-display text-lg font-semibold">{Number.isFinite(total) ? total : '—'}%</span>
      </div>
      {ok && (
        <div className="mt-3">
          <p className="mb-1.5 text-sm font-medium text-muted">Random value ranges (0–100)</p>
          <RangeBar chances={values} />
        </div>
      )}
    </div>
  );
}

function ReasonField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string | null }) {
  const id = useId();
  return (
    <Field label="Reason (recorded in the audit log)" htmlFor={id} error={error}>
      <textarea
        id={id}
        rows={2}
        maxLength={500}
        placeholder="e.g. Simulation testing"
        className={cn(inputClass, 'h-auto py-2.5')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

const validReason = (r: string) => r.trim().length >= 3;

/** PRD §24 — configure a player's probability profile. */
export function ProbabilityModal({ player, current, open, onClose }: { player: AdminPlayerRow; current?: Chances; open: boolean; onClose: () => void }) {
  const profiles = useProfiles();
  const selectId = useId();
  const [selection, setSelection] = useState<string>(String(player.profileId));
  const [values, setValues] = useState<Chances>(current ?? { winChance: 45, smallWinChance: 25, bigWinChance: 5, lossChance: 25 });
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const save = useAdminMutation<Record<string, unknown>>('put', () => `/api/admin/players/${player.id}/probability`);

  // Load the player's current profile values once profiles arrive.
  useEffect(() => {
    if (!open) return;
    setSelection(String(player.profileId));
    setReason('');
    setTouched(false);
    save.reset();
    const p = profiles.data?.find((x) => x.id === player.profileId);
    if (p) setValues({ winChance: p.winChance, smallWinChance: p.smallWinChance, bigWinChance: p.bigWinChance, lossChance: p.lossChance });
  }, [open, profiles.data, player.profileId]);

  const selected = profiles.data?.find((p) => String(p.id) === selection);
  const choose = (value: string) => {
    setSelection(value);
    const p = profiles.data?.find((x) => String(x.id) === value);
    if (p) setValues({ winChance: p.winChance, smallWinChance: p.smallWinChance, bigWinChance: p.bigWinChance, lossChance: p.lossChance });
  };
  const edit = (v: Chances) => {
    setValues(v);
    if (selected && !sameChances(selected, v)) setSelection('custom');
  };

  const valid = totalChance(values) === 100 && CHANCE_FIELDS.every(({ key }) => Number.isInteger(values[key]) && values[key] >= 0 && values[key] <= 100);
  const submit = () => {
    setTouched(true);
    if (!valid || !validReason(reason)) return;
    const body = selected && sameChances(selected, values) ? { profileId: selected.id, reason } : { ...values, reason };
    save.mutate(body, { onSuccess: onClose });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Probability configuration"
      description="Simulation and testing only · virtual ₹"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={save.isPending} disabled={!valid}>
            SAVE
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-3">
          <span className="text-2xl" aria-hidden>
            {player.avatar}
          </span>
          <div>
            <p className="text-sm text-muted">Player</p>
            <p className="font-semibold">{player.username}</p>
          </div>
        </div>
        <Field label="Profile" htmlFor={selectId}>
          <select id={selectId} className={inputClass} value={selection} onChange={(e) => choose(e.target.value)}>
            {(profiles.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.isSystem ? '' : ' (custom)'}
              </option>
            ))}
            <option value="custom">Custom values…</option>
          </select>
        </Field>
        <ChanceInputs values={values} onChange={edit} />
        <ReasonField value={reason} onChange={setReason} error={touched && !validReason(reason) ? 'Please give a reason (at least 3 characters).' : null} />
        {save.error && (
          <p role="alert" className="text-sm text-loss">
            {errorMessage(save.error)}
          </p>
        )}
      </div>
    </Modal>
  );
}

/** PRD §25 — create or edit a custom simulation profile. */
export function ProfileModal({ profile, open, onClose }: { profile: ProfileItem | null; open: boolean; onClose: () => void }) {
  const nameId = useId();
  const descId = useId();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [values, setValues] = useState<Chances>({ winChance: 15, smallWinChance: 30, bigWinChance: 5, lossChance: 50 });
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const create = useAdminMutation<Record<string, unknown>>('post', () => '/api/admin/profiles');
  const update = useAdminMutation<Record<string, unknown>>('put', () => `/api/admin/profiles/${profile?.id}`);
  const mutation = profile ? update : create;

  useEffect(() => {
    if (!open) return;
    setName(profile?.name ?? '');
    setDescription(profile?.description ?? '');
    setValues(profile ?? { winChance: 15, smallWinChance: 30, bigWinChance: 5, lossChance: 50 });
    setReason('');
    setTouched(false);
    create.reset();
    update.reset();
  }, [open, profile]);

  const valid = totalChance(values) === 100 && name.trim().length >= 2;
  const submit = () => {
    setTouched(true);
    if (!valid || !validReason(reason)) return;
    const { winChance, smallWinChance, bigWinChance, lossChance } = values;
    mutation.mutate({ name: name.trim(), description: description.trim(), winChance, smallWinChance, bigWinChance, lossChance, reason }, { onSuccess: onClose });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={profile ? `Edit ${profile.name}` : 'New simulation profile'}
      description={profile && profile.assignedPlayers > 0 ? `Changes apply to ${profile.assignedPlayers} assigned player(s) from their next round.` : 'For testing game behaviour and balancing.'}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={mutation.isPending} disabled={!valid}>
            SAVE
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Profile name" htmlFor={nameId} error={touched && name.trim().length < 2 ? 'Name must be at least 2 characters.' : null}>
          <input id={nameId} className={inputClass} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description (optional)" htmlFor={descId}>
          <input id={descId} className={inputClass} value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <ChanceInputs values={values} onChange={setValues} />
        <ReasonField value={reason} onChange={setReason} error={touched && !validReason(reason) ? 'Please give a reason (at least 3 characters).' : null} />
        {mutation.error && (
          <p role="alert" className="text-sm text-loss">
            {errorMessage(mutation.error)}
          </p>
        )}
      </div>
    </Modal>
  );
}

export function AdjustBalanceModal({ player, open, onClose }: { player: AdminPlayerRow; open: boolean; onClose: () => void }) {
  const amountId = useId();
  const [direction, setDirection] = useState<1 | -1>(1);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const save = useAdminMutation<Record<string, unknown>>('post', () => `/api/admin/players/${player.id}/adjust-balance`);

  useEffect(() => {
    if (open) {
      setAmount('');
      setReason('');
      setTouched(false);
      save.reset();
    }
  }, [open]);

  const value = Number(amount);
  const validAmount = Number.isInteger(value) && value > 0 && (direction === 1 || value <= player.virtualBalance);
  const submit = () => {
    setTouched(true);
    if (!validAmount || !validReason(reason)) return;
    save.mutate({ amount: direction * value, reason }, { onSuccess: onClose });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Adjust virtual balance"
      description={`${player.username} · current ${formatINR(player.virtualBalance)} virtual`}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            {direction === 1 ? 'Add' : 'Remove'} {validAmount ? formatINR(value) : ''}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Direction">
          {([1, -1] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={direction === d}
              onClick={() => setDirection(d)}
              className={cn('h-11 rounded-xl border font-semibold', direction === d ? 'border-gold-400/60 bg-gold-400/10 text-gold-200' : 'border-white/10 text-muted')}
            >
              {d === 1 ? 'Add virtual ₹' : 'Remove virtual ₹'}
            </button>
          ))}
        </div>
        <Field
          label="Amount (₹, virtual)"
          htmlFor={amountId}
          error={touched && !validAmount ? (direction === -1 && value > player.virtualBalance ? 'Cannot remove more than the current balance.' : 'Enter a whole amount above zero.') : null}
        >
          <input id={amountId} type="number" inputMode="numeric" min={1} className={cn(inputClass, 'tabular')} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <ReasonField value={reason} onChange={setReason} error={touched && !validReason(reason) ? 'Please give a reason (at least 3 characters).' : null} />
        <p className="text-sm text-muted">Recorded as an ADMIN_ADJUSTMENT ledger entry and in the audit log.</p>
        {save.error && (
          <p role="alert" className="text-sm text-loss">
            {errorMessage(save.error)}
          </p>
        )}
      </div>
    </Modal>
  );
}

export function StatusModal({ player, open, onClose }: { player: AdminPlayerRow; open: boolean; onClose: () => void }) {
  const next = player.status === 'active' ? 'suspended' : 'active';
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const save = useAdminMutation<Record<string, unknown>>('put', () => `/api/admin/players/${player.id}/status`);
  useEffect(() => {
    if (open) {
      setReason('');
      setTouched(false);
      save.reset();
    }
  }, [open]);
  const submit = () => {
    setTouched(true);
    if (!validReason(reason)) return;
    save.mutate({ status: next, reason }, { onSuccess: onClose });
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={next === 'suspended' ? `Suspend ${player.username}?` : `Reactivate ${player.username}?`}
      description={next === 'suspended' ? 'They will be signed out and unable to play until reactivated.' : 'They will be able to sign in and play again.'}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={next === 'suspended' ? 'danger' : 'success'} onClick={submit} loading={save.isPending}>
            {next === 'suspended' ? 'Suspend player' : 'Reactivate player'}
          </Button>
        </div>
      }
    >
      <ReasonField value={reason} onChange={setReason} error={touched && !validReason(reason) ? 'Please give a reason (at least 3 characters).' : null} />
      {save.error && (
        <p role="alert" className="mt-3 text-sm text-loss">
          {errorMessage(save.error)}
        </p>
      )}
    </Modal>
  );
}
