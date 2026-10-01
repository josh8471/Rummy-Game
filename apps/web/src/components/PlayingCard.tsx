import { cardLabel, isRedSuit, SUIT_SYMBOL, type Card } from '@casino/shared';
import type { CSSProperties } from 'react';
import { cn } from '../lib/format';

const SIZES = {
  xs: 'w-8 h-11 text-[11px] rounded-md',
  sm: 'w-11 h-[62px] text-sm rounded-lg',
  md: 'w-[58px] h-[82px] text-base rounded-lg sm:w-16 sm:h-[90px]',
  lg: 'w-[68px] h-[96px] text-lg rounded-xl sm:w-[84px] sm:h-[118px] sm:text-xl',
} as const;

export type CardSize = keyof typeof SIZES;

/** A playing card rendered in CSS. Face-down cards are announced as "Face-down card". */
export function PlayingCard({
  card,
  size = 'md',
  faceDown,
  highlight,
  dim,
  animate = true,
  delayMs = 0,
  className,
}: {
  card?: Card | null;
  size?: CardSize;
  faceDown?: boolean;
  highlight?: boolean;
  dim?: boolean;
  animate?: boolean;
  delayMs?: number;
  className?: string;
}) {
  const style: CSSProperties = animate ? { animationDelay: `${delayMs}ms` } : {};
  if (faceDown || !card) {
    return (
      <div
        role="img"
        aria-label="Face-down card"
        style={style}
        className={cn(
          'relative shrink-0 overflow-hidden border border-gold-500/40 shadow-lg',
          'bg-[repeating-linear-gradient(45deg,#1d2a4a_0_6px,#16213b_6px_12px)]',
          animate && 'animate-deal',
          SIZES[size],
          className,
        )}
      >
        <div className="absolute inset-1.5 rounded-[inherit] border border-gold-400/30" />
        <div className="absolute inset-0 flex items-center justify-center font-display font-bold text-gold-400/70">₹</div>
      </div>
    );
  }
  const red = isRedSuit(card.suit);
  const suit = SUIT_SYMBOL[card.suit];
  return (
    <div
      role="img"
      aria-label={cardLabel(card)}
      style={style}
      className={cn(
        'relative shrink-0 select-none border bg-gradient-to-b from-white to-[#eef0f5] font-display font-bold shadow-[0_6px_16px_-6px_rgb(0_0_0/0.6)] transition-[transform,opacity,box-shadow] duration-200',
        red ? 'text-[#c81e3a]' : 'text-[#111827]',
        highlight ? 'border-gold-400 ring-2 ring-gold-400/80' : 'border-black/10',
        dim && 'opacity-45',
        animate && 'animate-deal',
        SIZES[size],
        className,
      )}
    >
      <span className="absolute left-1 top-0.5 flex flex-col items-center leading-none sm:left-1.5 sm:top-1" aria-hidden>
        <span>{card.rank}</span>
        <span className="text-[0.85em]">{suit}</span>
      </span>
      <span className="absolute inset-0 flex items-center justify-center text-[1.9em] leading-none" aria-hidden>
        {suit}
      </span>
      <span className="absolute bottom-0.5 right-1 rotate-180 leading-none sm:bottom-1 sm:right-1.5" aria-hidden>
        {card.rank}
      </span>
    </div>
  );
}
