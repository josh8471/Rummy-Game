import { cn, useSvgId } from '../lib/format';

export function LogoMark({ className }: { className?: string }) {
  const id = useSvgId('logo');
  return (
    <svg viewBox="0 0 64 64" className={cn('size-9 shrink-0', className)} aria-hidden>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fde68a" />
          <stop offset="1" stopColor="#d4960f" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#${id})`} />
      <circle cx="32" cy="32" r="21" fill="#0b0f19" />
      <g fill="#0b0f19">
        <rect x="29" y="2" width="6" height="9" rx="2" />
        <rect x="29" y="53" width="6" height="9" rx="2" />
        <rect x="2" y="29" width="9" height="6" rx="2" />
        <rect x="53" y="29" width="9" height="6" rx="2" />
      </g>
      <text x="32" y="41" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="24" fill="#f7c948">
        ₹
      </text>
    </svg>
  );
}

export function Logo({ compact, className }: { compact?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      {!compact && (
        <span className="leading-none">
          <span className="block font-display text-[19px] font-semibold tracking-tight">
            Sim<span className="gold-text">Casino</span>
          </span>
          <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.18em] text-subtle">Virtual ₹ simulation</span>
        </span>
      )}
    </span>
  );
}
