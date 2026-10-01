import { useEffect, useRef, useState } from 'react';
import { cn, formatINR } from '../lib/format';
import { useReducedMotion } from '../lib/settings';

/** A virtual ₹ amount that counts smoothly to its new value (instant with reduced motion). */
export function AnimatedAmount({ value, className, sign }: { value: number; className?: string; sign?: boolean }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (start === value) return;
    setFlash(value > start ? 'up' : 'down');
    const clear = window.setTimeout(() => setFlash(null), 900);
    if (reduced) {
      setShown(value);
      return () => window.clearTimeout(clear);
    }
    const duration = 700;
    const t0 = performance.now();
    let frame = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(start + (value - start) * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(clear);
    };
  }, [value, reduced]);

  return (
    <span
      className={cn(
        'tabular transition-colors duration-500',
        flash === 'up' && 'text-win',
        flash === 'down' && 'text-loss',
        className,
      )}
    >
      {formatINR(shown, { sign })}
    </span>
  );
}

/** Signed change such as +₹1,000 / −₹500, coloured and never colour-only. */
export function Delta({ amount, className }: { amount: number; className?: string }) {
  return (
    <span className={cn('tabular font-semibold', amount > 0 ? 'text-win' : amount < 0 ? 'text-loss' : 'text-muted', className)}>
      {formatINR(amount, { sign: true })}
    </span>
  );
}
