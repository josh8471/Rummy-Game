import { GAMES, OUTCOME_LABEL, type GameConfig, type GameId, type GameResult, type Outcome, type RoundView } from '@casino/shared';
import { BookOpen, ChevronLeft, CircleX, RotateCcw, WifiOff } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Delta } from '../components/Amount';
import { Modal } from '../components/Modal';
import { OutcomeBadge } from '../components/OutcomeBadge';
import { Paytable, paytableFor } from '../components/Paytable';
import { VirtualNotice } from '../components/VirtualNotice';
import { Button, Panel } from '../components/ui';
import { api, ApiError, newRequestKey } from '../lib/api';
import { cn, formatINR, timeLabel } from '../lib/format';
import { useCommitBalance, useGames, useHistory, useWallet } from '../lib/queries';

/* ─────────────── Data hooks ─────────────── */

export function useGameConfig(gameId: GameId): GameConfig | undefined {
  return useGames().data?.find((g) => g.id === gameId);
}

export function useBalance(): number | undefined {
  return useWallet().data?.virtualBalance;
}

/**
 * Sends a round to the server. One Idempotency-Key per attempt; "Try again"
 * after an uncertain failure re-sends the same key, so the server either
 * returns the round it already processed or processes it once.
 */
export function usePlayRound<TReq, TRes = GameResult>(gameId: GameId) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const inFlight = useRef(false);
  const last = useRef<{ body: TReq; key: string } | null>(null);

  const send = useCallback(
    async (body: TReq, key: string): Promise<TRes | null> => {
      if (inFlight.current) return null; // no duplicate submissions
      inFlight.current = true;
      setPending(true);
      setError(null);
      try {
        return await api.post<TRes>(`/api/games/${gameId}/play`, body, { 'Idempotency-Key': key });
      } catch (e) {
        setError(e instanceof ApiError ? e : new ApiError(0, 'UNKNOWN', 'Unable to start the round.'));
        return null;
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    [gameId],
  );

  const play = useCallback(
    (body: TReq) => {
      const key = newRequestKey();
      last.current = { body, key };
      return send(body, key);
    },
    [send],
  );

  const retry = useCallback(() => (last.current ? send(last.current.body, last.current.key) : Promise.resolve(null)), [send]);

  return { play, retry, pending, error, clearError: () => setError(null) };
}

/** Deal / act / resume for games with in-round decisions (Blackjack, Poker). */
export function useInteractiveRound<S>(gameId: GameId) {
  const [round, setRound] = useState<RoundView<S> | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const inFlight = useRef(false);
  const commit = useCommitBalance();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ round: RoundView<S> | null }>(`/api/games/${gameId}/active`);
      setRound(res.round);
      setError(null);
    } catch (e) {
      setError(e as ApiError);
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = useCallback(
    async (request: () => Promise<RoundView<S>>) => {
      if (inFlight.current) return null;
      inFlight.current = true;
      setPending(true);
      setError(null);
      try {
        const next = await request();
        setRound(next);
        return next;
      } catch (e) {
        const err = e instanceof ApiError ? e : new ApiError(0, 'UNKNOWN', 'Something went wrong.');
        // A stale or duplicate action: adopt the server's real state instead of erroring.
        const serverRound = (err.details as { round?: RoundView<S> } | undefined)?.round;
        if (err.status === 409 && serverRound) {
          setRound(serverRound);
          commit(serverRound.virtualBalance);
          return serverRound;
        }
        if (err.code === 'ROUND_IN_PROGRESS') {
          await load();
          return null;
        }
        setError(err);
        return null;
      } finally {
        inFlight.current = false;
        setPending(false);
      }
    },
    [commit, load],
  );

  const deal = useCallback(
    (betAmount: number) =>
      run(() => api.post<RoundView<S>>(`/api/games/${gameId}/play`, { betAmount }, { 'Idempotency-Key': newRequestKey() })),
    [gameId, run],
  );

  const act = useCallback(
    (body: Record<string, unknown>) => {
      if (!round) return Promise.resolve(null);
      return run(() => api.post<RoundView<S>>(`/api/games/${gameId}/rounds/${round.roundId}/action`, { ...body, seq: round.seq }));
    },
    [gameId, round, run],
  );

  return { round, setRound, loading, pending, error, clearError: () => setError(null), deal, act, reload: load };
}

/* ─────────────── Layout ─────────────── */

export function GameLayout({
  gameId,
  board,
  controls,
  action,
  side,
  announcement,
  paytableOnBoard,
}: {
  gameId: GameId;
  /** The board shows its own paytable from the sm breakpoint up. */
  paytableOnBoard?: boolean;
  board: ReactNode;
  controls?: ReactNode;
  /** Primary action (SPIN / DEAL / HIT…) — sticky above the bottom nav on phones. */
  action: ReactNode;
  side?: ReactNode;
  /** Screen-reader announcement of the latest result. */
  announcement?: string;
}) {
  const meta = GAMES[gameId];
  const [rulesOpen, setRulesOpen] = useState(false);
  return (
    <div>
      <header className="mb-4 flex items-center gap-2 md:mb-5">
        <Link
          to="/games"
          aria-label="Back to games"
          className="-ml-2 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-white/[0.06] hover:text-fg"
        >
          <ChevronLeft className="size-6" aria-hidden />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold leading-tight md:text-[32px]">{meta.name}</h1>
          <VirtualNotice variant="inline" />
        </div>
        <Button variant="secondary" size="md" onClick={() => setRulesOpen(true)} aria-label={`How to play ${meta.name}`}>
          <BookOpen className="size-4" aria-hidden />
          <span className="hidden sm:inline">How to play</span>
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section aria-label={`${meta.name} table`} className="min-w-0 space-y-4">
          {board}
          {controls && <Panel className="p-4">{controls}</Panel>}
          <div className="hidden md:block">{action}</div>
        </section>
        <aside className="space-y-4" aria-label="Round information">
          {side}
          <RecentRounds gameId={gameId} />
          <Panel className={cn('p-4', paytableOnBoard && 'sm:hidden')}>
            <h2 className="mb-2 font-semibold">Paytable</h2>
            <Paytable rows={paytableFor(gameId)} />
          </Panel>
        </aside>
      </div>

      {/* Mobile: keep the primary action reachable without scrolling (PRD §32). */}
      <div className="h-20 md:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t border-white/[0.07] bg-ink-900/95 px-4 py-2.5 backdrop-blur-xl md:hidden">
        {action}
      </div>

      <div aria-live="polite" role="status" className="sr-only">
        {announcement}
      </div>

      <Modal open={rulesOpen} onClose={() => setRulesOpen(false)} title={`How to play ${meta.name}`} description="Virtual ₹ only · No cash value">
        <ul className="list-disc space-y-1.5 pl-5 text-muted">
          {meta.howToPlay.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <h3 className="mb-1 mt-5 font-semibold">Paytable</h3>
        <Paytable rows={paytableFor(gameId)} />
        <p className="mt-4 text-sm text-subtle">Every result is decided by the server. Payouts are total return including your stake.</p>
      </Modal>
    </div>
  );
}

/* ─────────────── Result & errors ─────────────── */

/** Distinguishes BET, RESULT and PAYOUT (PRD §12). */
export function ResultPanel({
  bet,
  payout,
  outcome,
  headline,
  detail,
  outcomeLabel,
}: {
  bet: number;
  payout: number;
  outcome: Outcome;
  headline: ReactNode;
  detail?: ReactNode;
  outcomeLabel?: string;
}) {
  const net = payout - bet;
  const label = outcomeLabel ?? (net === 0 ? 'Stake back' : undefined);
  return (
    <Panel
      className={cn(
        'animate-fade-up overflow-hidden p-4',
        outcome === 'BIG_WIN' && 'border-gold-400/50 animate-glow',
        outcome === 'LOSS' && 'border-loss/20',
        (outcome === 'WIN' || outcome === 'SMALL_WIN') && 'border-win/25',
      )}
    >
      <div className="grid grid-cols-3 divide-x divide-white/[0.07] text-center">
        <div className="px-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">Bet</p>
          <p className="tabular mt-1 font-display text-lg font-semibold sm:text-xl">{formatINR(bet)}</p>
        </div>
        <div className="px-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">Result</p>
          <div className="mt-1 font-display text-lg font-semibold sm:text-xl">{headline}</div>
        </div>
        <div className="px-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-subtle">Payout</p>
          <p className="tabular mt-1 font-display text-lg font-semibold sm:text-xl">{formatINR(payout)}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-white/[0.07] pt-3">
        <OutcomeBadge outcome={outcome} label={label} />
        {net === 0 ? (
          <span className="text-muted">Stake returned</span>
        ) : (
          <>
            <span className="text-muted">Virtual {net > 0 ? 'win' : 'change'}</span>
            <Delta amount={net} className="font-display text-xl" />
          </>
        )}
      </div>
      {detail && <div className="mt-2 text-center text-sm text-muted">{detail}</div>}
    </Panel>
  );
}

export function outcomeAnnouncement(outcome: Outcome, headline: string, payout: number, bet: number): string {
  const net = payout - bet;
  const change = net === 0 ? 'stake returned' : `${net > 0 ? 'virtual win' : 'virtual change'} ${formatINR(net, { sign: true })}`;
  return `Result: ${headline}. ${net === 0 ? 'Stake back' : OUTCOME_LABEL[outcome]}. Payout ${formatINR(payout)}, ${change}.`;
}

/** PRD §34: "Unable to start the round. Your virtual balance was not changed. [TRY AGAIN]" */
export function RoundError({ error, onRetry, onDismiss }: { error: ApiError; onRetry?: () => void; onDismiss: () => void }) {
  const uncertain = error.status === 0;
  const Icon = uncertain ? WifiOff : CircleX;
  return (
    <Panel role="alert" className="animate-fade-up border-loss/30 p-4">
      <div className="flex gap-3">
        <Icon className="mt-0.5 size-5 shrink-0 text-loss" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{uncertain ? 'We couldn’t confirm the round.' : 'Unable to start the round.'}</p>
          <p className="text-sm text-muted">
            {uncertain
              ? 'Check your connection and try again — you will never be charged twice.'
              : error.retryable
                ? 'Your virtual balance was not changed.'
                : `${error.message} Your virtual balance was not changed.`}
          </p>
          <div className="mt-3 flex gap-2">
            {error.retryable && onRetry && (
              <Button size="sm" onClick={onRetry}>
                <RotateCcw className="size-4" aria-hidden /> Try again
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function RecentRounds({ gameId }: { gameId: GameId }) {
  const history = useHistory(gameId, 8);
  const items = history.data?.pages[0]?.items ?? [];
  return (
    <Panel className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Your recent rounds</h2>
        <Link to="/history" className="text-sm font-semibold text-gold-300 hover:text-gold-200">
          History
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="py-3 text-sm text-muted">No rounds yet — your results will appear here.</p>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {items.map((item) => (
            <li key={item.roundId} className="flex items-center gap-2 py-2 text-sm">
              <span className="min-w-0 flex-1 truncate text-muted" title={item.summary}>
                {item.summary}
              </span>
              {item.payout !== null ? (
                <Delta amount={item.payout - item.betAmount} className="text-sm" />
              ) : (
                <span className="text-subtle">In play</span>
              )}
              <span className="w-16 text-right text-xs text-subtle">{timeLabel(item.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** Shown when a game is switched off by an admin. */
export function GameUnavailable({ gameId }: { gameId: GameId }) {
  return (
    <Panel className="p-8 text-center">
      <p className="font-display text-xl font-semibold">{GAMES[gameId].name} is currently unavailable</p>
      <p className="mt-1 text-muted">An administrator has paused this game. Please try another one.</p>
      <Link to="/games" className="mt-5 inline-block">
        <Button tabIndex={-1}>Explore games</Button>
      </Link>
    </Panel>
  );
}

/** Button label that switches to "Processing round…" while the server works (PRD §33). */
export function processingLabel(pending: boolean, idle: string): string {
  return pending ? 'Processing round…' : idle;
}
