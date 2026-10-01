import { DAILY_REWARD_TIMEZONE } from './constants';

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });

/** ₹8,42,50,000 — Indian digit grouping. `sign` adds a leading + for positive amounts. */
export function formatINR(amount: number, options: { sign?: boolean } = {}): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '−' : options.sign && rounded > 0 ? '+' : '';
  return `${sign}₹${inr.format(Math.abs(rounded))}`;
}

/** ₹8.4Cr / ₹12.5L / ₹25K — for tight spaces. */
export function formatCompactINR(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '−' : '';
  const trim = (n: number) => (n >= 100 ? n.toFixed(0) : n.toFixed(1)).replace(/\.0$/, '');
  if (abs >= 1e7) return `${sign}₹${trim(abs / 1e7)}Cr`;
  if (abs >= 1e5) return `${sign}₹${trim(abs / 1e5)}L`;
  if (abs >= 1e3) return `${sign}₹${trim(abs / 1e3)}K`;
  return `${sign}₹${abs}`;
}

/** Level 1 at 0 XP, level 2 at 25, level 3 at 100, level 4 at 225 … */
export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 25)) + 1;
}

export function xpForLevel(level: number): number {
  return 25 * (level - 1) ** 2;
}

/** XP earned for a settled round: 1 per ₹100 staked, at least 1. */
export function xpForStake(staked: number): number {
  return Math.max(1, Math.floor(staked / 100));
}

/** Calendar date (YYYY-MM-DD) in India Standard Time — daily rewards reset at IST midnight. */
export function istDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DAILY_REWARD_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
