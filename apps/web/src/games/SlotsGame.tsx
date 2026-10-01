import { SLOT_SYMBOL_INFO, SLOT_SYMBOLS, type GameResult, type SlotsDetail, type SlotSymbol } from '@casino/shared';
import { useEffect, useRef, useState } from 'react';
import { BetControl, clampBet } from '../components/BetControl';
import { Button, Panel } from '../components/ui';
import { cn } from '../lib/format';
import { useCommitBalance } from '../lib/queries';
import { useReducedMotion } from '../lib/settings';
import { GameLayout, outcomeAnnouncement, processingLabel, ResultPanel, RoundError, useBalance, usePlayRound } from './common';
import type { GameProps } from './GamePage';

const randomSymbol = () => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)]!;
const randomColumn = () => [randomSymbol(), randomSymbol(), randomSymbol()];

function SlotGlyph({ symbol }: { symbol: SlotSymbol }) {
  if (symbol === 'BAR') {
    return (
      <span className="rounded-md bg-gradient-to-b from-zinc-700 to-black px-[0.18em] py-[0.04em] font-display text-[0.42em] font-black tracking-wider text-gold-300 ring-1 ring-gold-500/70">
        BAR
      </span>
    );
  }
  if (symbol === 'SEVEN') {
    return (
      <span className="font-display font-black leading-none text-[#e0243a] [text-shadow:0_3px_0_#7a0f1c,0_0_20px_rgb(224_36_58/0.45)]">
        7
      </span>
    );
  }
  return <span className="leading-none">{SLOT_SYMBOL_INFO[symbol].glyph}</span>;
}

const SPIN_BASE_MS = 1100;
const SPIN_STAGGER_MS = 380;

export default function SlotsGame({ config }: GameProps) {
  const reduced = useReducedMotion();
  const balance = useBalance();
  const commit = useCommitBalance();
  const { play, retry, pending, error, clearError } = usePlayRound<{ betAmount: number }, GameResult<SlotsDetail>>('slots');

  const [bet, setBet] = useState(() => clampBet(500, config.minBet, config.maxBet));
  const [grid, setGrid] = useState<SlotSymbol[][]>(() => [randomColumn(), randomColumn(), randomColumn()]);
  const [strips, setStrips] = useState<SlotSymbol[][] | null>(null);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<GameResult<SlotsDetail> | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const timers = useRef<number[]>([]);

  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const busy = pending || strips !== null;

  const reveal = (res: GameResult<SlotsDetail>) => {
    setGrid(res.detail.grid);
    setStrips(null);
    setRolling(false);
    setResult(res);
    commit(res.virtualBalance);
    const headline = res.detail.payline.map((s) => SLOT_SYMBOL_INFO[s].label).join(', ');
    setAnnouncement(outcomeAnnouncement(res.outcome, headline, res.payout, res.betAmount));
  };

  const animate = (res: GameResult<SlotsDetail>) => {
    if (reduced) {
      reveal(res);
      return;
    }
    // Each strip starts with what's on screen and ends with the server's result.
    setStrips(
      grid.map((column, reel) => [
        ...column,
        ...Array.from({ length: 14 + reel * 5 }, randomSymbol),
        ...res.detail.grid[reel]!,
      ]),
    );
    setRolling(false);
    timers.current.push(window.setTimeout(() => setRolling(true), 30));
    timers.current.push(window.setTimeout(() => reveal(res), SPIN_BASE_MS + SPIN_STAGGER_MS * 2 + 120));
  };

  const spin = async () => {
    setResult(null);
    const res = await play({ betAmount: bet });
    if (res) animate(res);
  };

  const onRetry = async () => {
    const res = await retry();
    if (res) animate(res);
  };

  const win = result?.detail.win;
  const winningCells = new Set<number>(win ? (win.kind === 'THREE' ? [0, 1, 2] : [0, 1]) : []);
  const insufficient = balance !== undefined && balance < bet;

  const board = (
    <Panel className="relative overflow-hidden p-3 sm:p-5">
      <div aria-hidden className="absolute inset-x-0 -top-20 mx-auto h-40 w-3/4 rounded-full bg-gold-400/10 blur-3xl" />
      <div className="relative mx-auto max-w-[560px] rounded-[28px] border-2 border-gold-500/60 bg-gradient-to-b from-[#2a1d05] to-[#120c02] p-2.5 shadow-[inset_0_2px_0_rgb(255_255_255/0.08),0_20px_50px_-20px_rgb(0_0_0/0.8)] sm:p-4">
        <p className="mb-2 text-center text-[11px] font-bold uppercase tracking-[0.3em] text-gold-300/80 sm:mb-3">Slot Machine</p>
        <div
          className="relative grid grid-cols-3 gap-1.5 [--cell:76px] sm:gap-2.5 sm:[--cell:100px] xl:[--cell:116px]"
          role="img"
          aria-label={`Reels showing ${grid.map((col) => SLOT_SYMBOL_INFO[col[1]!].label).join(', ')} on the payline`}
        >
          {[0, 1, 2].map((reel) => {
            const strip = strips?.[reel];
            const duration = SPIN_BASE_MS + reel * SPIN_STAGGER_MS;
            return (
              <div key={reel} className="relative h-[calc(var(--cell)*3)] overflow-hidden rounded-2xl bg-gradient-to-b from-[#fbf6e6] via-white to-[#f1e7c9] shadow-inner">
                {strip ? (
                  <div
                    className="absolute inset-x-0 top-0"
                    style={{
                      transform: rolling ? `translateY(-${((strip.length - 3) / strip.length) * 100}%)` : 'translateY(0)',
                      transition: rolling ? `transform ${duration}ms cubic-bezier(0.2, 0.85, 0.25, 1.04)` : 'none',
                      filter: rolling ? 'blur(0.4px)' : undefined,
                    }}
                  >
                    {strip.map((s, i) => (
                      <div key={i} className="flex h-[var(--cell)] items-center justify-center text-[calc(var(--cell)*0.55)]">
                        <SlotGlyph symbol={s} />
                      </div>
                    ))}
                  </div>
                ) : (
                  grid[reel]!.map((s, row) => (
                    <div
                      key={row}
                      className={cn(
                        'flex h-[var(--cell)] items-center justify-center text-[calc(var(--cell)*0.55)] transition-opacity',
                        result && row !== 1 && 'opacity-45',
                        row === 1 && winningCells.has(reel) && 'animate-pop bg-gold-300/30',
                      )}
                    >
                      <SlotGlyph symbol={s} />
                    </div>
                  ))
                )}
                <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(0_0_0/0.28),transparent_22%,transparent_78%,rgb(0_0_0/0.28))]" />
              </div>
            );
          })}
          {/* Payline */}
          <div aria-hidden className="pointer-events-none absolute inset-x-[-6px] top-1/2 h-[var(--cell)] -translate-y-1/2 rounded-xl border-2 border-gold-400/80 shadow-[0_0_24px_rgb(247_201_72/0.35)]" />
        </div>
        <p className="mt-2 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-300/70 sm:mt-3">Middle row pays</p>
      </div>
    </Panel>
  );

  const action = (
    <Button size="xl" block onClick={() => void spin()} disabled={busy || insufficient} loading={pending}>
      {insufficient ? 'Not enough virtual balance' : processingLabel(pending, strips ? 'Spinning…' : 'SPIN')}
    </Button>
  );

  return (
    <GameLayout
      gameId="slots"
      announcement={announcement}
      board={
        <>
          {board}
          {error && <RoundError error={error} onRetry={() => void onRetry()} onDismiss={clearError} />}
          {result && !strips && (
            <ResultPanel
              bet={result.betAmount}
              payout={result.payout}
              outcome={result.outcome}
              headline={
                <span className="inline-flex items-center gap-1 text-2xl" aria-label={result.detail.payline.map((s) => SLOT_SYMBOL_INFO[s].label).join(', ')}>
                  {result.detail.payline.map((s, i) => (
                    <span key={i} className="inline-flex h-8 min-w-6 items-center justify-center text-[26px]">
                      <SlotGlyph symbol={s} />
                    </span>
                  ))}
                </span>
              }
              detail={
                win
                  ? win.kind === 'THREE'
                    ? `Three ${SLOT_SYMBOL_INFO[win.symbol].label}s pay ${win.multiplier}×`
                    : `Two ${SLOT_SYMBOL_INFO[win.symbol].label}s pay ${win.multiplier}×`
                  : 'No match on the payline'
              }
            />
          )}
        </>
      }
      controls={<BetControl value={bet} onChange={setBet} min={config.minBet} max={config.maxBet} balance={balance} disabled={busy} />}
      action={action}
    />
  );
}
