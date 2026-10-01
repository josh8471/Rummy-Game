import type { Achievement } from '@casino/shared';
import { Lock } from 'lucide-react';
import { cn } from '../lib/format';
import { ProgressBar } from './ui';

export function AchievementGrid({ achievements, limit, className }: { achievements: Achievement[]; limit?: number; className?: string }) {
  const list = limit ? [...achievements].sort((a, b) => Number(b.unlocked) - Number(a.unlocked)).slice(0, limit) : achievements;
  return (
    <ul className={cn('grid grid-cols-1 gap-3 sm:grid-cols-2', className)}>
      {list.map((a) => (
        <li
          key={a.id}
          className={cn('flex items-center gap-3 rounded-2xl border p-3.5', a.unlocked ? 'border-gold-400/30 bg-gold-400/[0.06]' : 'border-white/[0.07] bg-white/[0.02]')}
        >
          <span
            className={cn('flex size-11 shrink-0 items-center justify-center rounded-xl text-2xl', a.unlocked ? 'bg-gold-400/15' : 'bg-white/[0.05] grayscale')}
            aria-hidden
          >
            {a.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-semibold">
              {a.title}
              {a.unlocked ? (
                <span className="rounded-full bg-win/15 px-2 py-0.5 text-[10px] font-bold uppercase text-win">Unlocked</span>
              ) : (
                <Lock className="size-3.5 text-subtle" aria-label="Locked" />
              )}
            </p>
            <p className="truncate text-sm text-muted">{a.description}</p>
            {!a.unlocked && a.target > 1 && (
              <div className="mt-1.5 flex items-center gap-2">
                <ProgressBar value={a.progress} max={a.target} label={`${a.title} progress`} className="flex-1" />
                <span className="tabular text-xs text-subtle">
                  {a.progress}/{a.target}
                </span>
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
