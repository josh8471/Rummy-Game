import { useId } from 'react';

export { formatCompactINR, formatINR } from '@casino/shared';

/** A DOM id that is safe inside SVG url(#…) references. */
export function useSvgId(prefix = 'svg'): string {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

const timeFmt = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' });
const dateYearFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Today", "Yesterday", "28 Sept" (in the viewer's local time). */
export function dayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const diff = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.getFullYear() === now.getFullYear() ? dateFmt.format(d) : dateYearFmt.format(d);
}

/** "Today, 01:32 am" */
export function dateTimeLabel(iso: string): string {
  return `${dayLabel(iso)}, ${timeFmt.format(new Date(iso))}`;
}

export function timeLabel(iso: string): string {
  return timeFmt.format(new Date(iso));
}

/** 1h 05m / 12m 30s */
export function durationLabel(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}
