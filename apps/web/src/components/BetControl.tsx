import { BET_CHIPS, BET_STEP } from '@casino/shared';
import { Minus, Plus } from 'lucide-react';
import { useId } from 'react';
import { cn, formatCompactINR, formatINR } from '../lib/format';

/** Step used by the − / + buttons for a given bet size. */
function stepFor(amount: number): number {
  if (amount < 500) return 50;
  if (amount < 2_000) return 100;
  if (amount < 10_000) return 500;
  return 1_000;
}

export function clampBet(amount: number, min: number, max: number): number {
  const stepped = Math.round(amount / BET_STEP) * BET_STEP;
  return Math.min(max, Math.max(min, stepped));
}

/** [−] ₹500 [+] with quick chips. Values are validated again on the server. */
export function BetControl({
  value,
  onChange,
  min,
  max,
  balance,
  disabled,
  label = 'Virtual bet',
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  balance?: number;
  disabled?: boolean;
  label?: string;
}) {
  const id = useId();
  const effectiveMax = balance !== undefined ? Math.max(min, Math.min(max, Math.floor(balance / BET_STEP) * BET_STEP)) : max;
  const down = () => onChange(clampBet(value - stepFor(value - 1), min, effectiveMax));
  const up = () => onChange(clampBet(value + stepFor(value), min, effectiveMax));

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span id={id} className="text-sm font-medium text-muted">
          {label}
        </span>
        <span className="text-xs text-subtle">
          {formatINR(min)} – {formatCompactINR(max)}
        </span>
      </div>
      <div className="flex items-center gap-2" role="group" aria-labelledby={id}>
        <button
          type="button"
          onClick={down}
          disabled={disabled || value <= min}
          aria-label="Decrease bet"
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-fg transition hover:bg-white/[0.1] disabled:opacity-40"
        >
          <Minus className="size-5" aria-hidden />
        </button>
        <output
          aria-live="polite"
          className="tabular flex h-12 min-w-0 flex-1 items-center justify-center rounded-xl border border-gold-400/25 bg-ink-900/80 font-display text-xl font-semibold text-gold-200"
        >
          {formatINR(value)}
        </output>
        <button
          type="button"
          onClick={up}
          disabled={disabled || value >= effectiveMax}
          aria-label="Increase bet"
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-fg transition hover:bg-white/[0.1] disabled:opacity-40"
        >
          <Plus className="size-5" aria-hidden />
        </button>
      </div>
      <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
        {BET_CHIPS.filter((chip) => chip >= min && chip <= max).map((chip) => (
          <button
            key={chip}
            type="button"
            disabled={disabled || chip > effectiveMax}
            onClick={() => onChange(chip)}
            aria-pressed={value === chip}
            className={cn(
              'h-11 shrink-0 rounded-full border px-3.5 text-sm font-semibold transition disabled:opacity-35',
              value === chip
                ? 'border-gold-400/70 bg-gold-400/15 text-gold-200'
                : 'border-white/10 bg-white/[0.04] text-muted hover:text-fg',
            )}
          >
            {formatCompactINR(chip)}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Round chip used to pick a denomination on betting boards (roulette, dice). */
export function ChipPicker({
  value,
  onChange,
  disabled,
  chips = BET_CHIPS,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  chips?: readonly number[];
}) {
  const colors = ['from-sky-400 to-sky-600', 'from-emerald-400 to-emerald-600', 'from-rose-400 to-rose-600', 'from-violet-400 to-violet-600', 'from-amber-300 to-amber-500', 'from-slate-200 to-slate-400'];
  return (
    <div role="radiogroup" aria-label="Chip value" className="no-scrollbar flex gap-2 overflow-x-auto p-1">
      {chips.map((chip, i) => (
        <button
          key={chip}
          type="button"
          role="radio"
          aria-checked={value === chip}
          aria-label={`Chip ${formatINR(chip)}`}
          disabled={disabled}
          onClick={() => onChange(chip)}
          className={cn(
            'relative flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-b text-[11px] font-extrabold text-ink-950 shadow-md transition sm:size-[52px]',
            colors[i % colors.length],
            value === chip ? 'scale-110 ring-2 ring-gold-300 ring-offset-2 ring-offset-ink-900' : 'opacity-80 hover:opacity-100',
          )}
        >
          <span className="absolute inset-1 rounded-full border-2 border-dashed border-white/60" aria-hidden />
          <span className="relative">{formatCompactINR(chip).replace('₹', '')}</span>
        </button>
      ))}
    </div>
  );
}

/** Small chip marker showing how much is placed on a betting spot. */
export function PlacedChip({ amount, className }: { amount: number; className?: string }) {
  return (
    <span
      className={cn(
        'pointer-events-none inline-flex min-w-7 items-center justify-center rounded-full border-2 border-dashed border-white/70 bg-gradient-to-b from-gold-300 to-gold-500 px-1 text-[10px] font-extrabold leading-6 text-ink-950 shadow-md animate-pop',
        className,
      )}
    >
      {formatCompactINR(amount).replace('₹', '')}
    </span>
  );
}
