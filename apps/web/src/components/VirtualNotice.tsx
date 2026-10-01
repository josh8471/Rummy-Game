import { VIRTUAL_NOTICE } from '@casino/shared';
import { ShieldCheck } from 'lucide-react';
import { cn } from '../lib/format';

/** The mandatory "VIRTUAL ₹ ONLY — NO CASH VALUE" notice (PRD §1). */
export function VirtualNotice({ variant = 'pill', className }: { variant?: 'pill' | 'banner' | 'inline'; className?: string }) {
  if (variant === 'banner') {
    return (
      <div
        className={cn(
          'flex items-center justify-center gap-2 rounded-xl border border-gold-400/25 bg-gold-400/[0.07] px-3 py-2 text-center text-xs font-bold tracking-[0.12em] text-gold-300 sm:text-[13px]',
          className,
        )}
      >
        <ShieldCheck className="size-4 shrink-0" aria-hidden />
        <span>{VIRTUAL_NOTICE}</span>
      </div>
    );
  }
  if (variant === 'inline') {
    return (
      <p className={cn('text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-300/90', className)}>
        Virtual ₹ • No cash value
      </p>
    );
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-gold-400/25 bg-gold-400/[0.08] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-gold-300',
        className,
      )}
    >
      <ShieldCheck className="size-3.5" aria-hidden />
      {VIRTUAL_NOTICE}
    </span>
  );
}
