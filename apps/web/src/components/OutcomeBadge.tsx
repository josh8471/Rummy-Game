import { OUTCOME_LABEL, type Outcome } from '@casino/shared';
import { CircleCheck, CircleX, Sparkles, Star } from 'lucide-react';
import { cn } from '../lib/format';

const STYLE: Record<Outcome, string> = {
  LOSS: 'bg-loss/12 text-loss border-loss/30',
  SMALL_WIN: 'bg-win/10 text-win border-win/25',
  WIN: 'bg-win/15 text-win border-win/35',
  BIG_WIN: 'bg-gold-400/15 text-gold-300 border-gold-400/40',
};

const ICON = { LOSS: CircleX, SMALL_WIN: CircleCheck, WIN: Star, BIG_WIN: Sparkles } as const;

/** Win/loss is always communicated with text and an icon, never colour alone (PRD §30). */
export function OutcomeBadge({ outcome, label, className }: { outcome: Outcome; label?: string; className?: string }) {
  const Icon = ICON[outcome];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide',
        STYLE[outcome],
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label ?? OUTCOME_LABEL[outcome]}
    </span>
  );
}
