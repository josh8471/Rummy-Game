import { GAMES, type GameConfig } from '@casino/shared';
import { Play } from 'lucide-react';
import { Link } from 'react-router';
import { cn, formatINR } from '../lib/format';
import { GameArt } from './GameArt';

export function GameCard({ game, className }: { game: GameConfig; className?: string }) {
  const meta = GAMES[game.id];
  const body = (
    <>
      <div className="relative aspect-[16/9] overflow-hidden">
        <GameArt gameId={game.id} accent={meta.accent} className="transition-transform duration-500 group-hover:scale-[1.04]" />
        {!game.enabled && (
          <span className="absolute left-3 top-3 rounded-full bg-ink-950/80 px-2.5 py-1 text-xs font-semibold text-muted">
            Unavailable
          </span>
        )}
        {game.kind === 'interactive' && game.enabled && (
          <span className="absolute left-3 top-3 rounded-full bg-ink-950/70 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-gold-200">
            Live decisions
          </span>
        )}
      </div>
      <div className="flex items-end justify-between gap-3 p-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold leading-tight">{meta.name}</h3>
          <p className="mt-0.5 truncate text-sm text-muted">{meta.tagline}</p>
          <p className="mt-1.5 text-sm font-semibold text-gold-300">From {formatINR(game.minBet)}</p>
        </div>
        <span
          className={cn(
            'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-4 text-sm font-bold',
            game.enabled ? 'bg-gradient-to-b from-gold-300 to-gold-500 text-[#1a1204]' : 'bg-white/[0.06] text-subtle',
          )}
          aria-hidden
        >
          <Play className="size-4" /> PLAY
        </span>
      </div>
    </>
  );

  const shell = cn(
    'group glass block overflow-hidden rounded-2xl transition duration-200',
    game.enabled ? 'hover:-translate-y-0.5 hover:border-gold-400/40' : 'opacity-60',
    className,
  );

  if (!game.enabled) {
    return (
      <div className={shell} aria-label={`${meta.name} — currently unavailable`}>
        {body}
      </div>
    );
  }
  return (
    <Link to={`/games/${game.id}`} className={shell} aria-label={`Play ${meta.name}, bets from ${formatINR(game.minBet)}`}>
      {body}
    </Link>
  );
}
