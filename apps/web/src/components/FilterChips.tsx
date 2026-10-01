import { cn } from '../lib/format';

/** Filter chips; horizontally scrollable on small screens (PRD §9). */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition-colors',
            value === option.value
              ? 'border-gold-400/60 bg-gold-400/15 text-gold-200'
              : 'border-white/10 bg-white/[0.04] text-muted hover:text-fg',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
