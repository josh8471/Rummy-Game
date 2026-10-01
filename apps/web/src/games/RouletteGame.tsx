import {
  BET_CHIPS,
  ROULETTE_WHEEL,
  rouletteBetLabel,
  rouletteBetWins,
  rouletteColor,
  type GameResult,
  type RouletteBet,
  type RouletteBetSpot,
  type RouletteColor,
  type RouletteDetail,
} from '@casino/shared';
import { Eraser, Repeat, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ChipPicker, PlacedChip } from '../components/BetControl';
import { Button, Panel } from '../components/ui';
import { cn, formatINR } from '../lib/format';
import { useCommitBalance } from '../lib/queries';
import { useReducedMotion } from '../lib/settings';
import { GameLayout, outcomeAnnouncement, processingLabel, ResultPanel, RoundError, useBalance, usePlayRound } from './common';
import type { GameProps } from './GamePage';

type Spot = RouletteBetSpot;
const keyOf = (s: Spot) => (s.value === undefined ? s.type : `${s.type}-${s.value}`);
function spotOf(key: string): Spot {
  const [type, value] = key.split('-') as [Spot['type'], string | undefined];
  return value === undefined ? { type } : { type, value: Number(value) };
}

const COLOR_CLASS: Record<RouletteColor, string> = {
  RED: 'bg-table-red text-white',
  BLACK: 'bg-table-black text-white',
  GREEN: 'bg-table-green text-white',
};
const COLOR_WORD: Record<RouletteColor, string> = { RED: 'Red', BLACK: 'Black', GREEN: 'Green' };
const SEG = 360 / ROULETTE_WHEEL.length;

/* ─────────────── Wheel ─────────────── */

function Wheel({ rotation, durationMs, result }: { rotation: number; durationMs: number; result: number | null }) {
  const r = 100;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[260px] sm:max-w-[300px]">
      <svg viewBox="-112 -112 224 224" className="h-full w-full drop-shadow-[0_18px_30px_rgb(0_0_0/0.6)]" aria-hidden>
        <circle r={111} fill="#6b4a0d" />
        <circle r={107} fill="#e5a91a" />
        <g style={{ transform: `rotate(${rotation}deg)`, transition: `transform ${durationMs}ms cubic-bezier(0.12, 0.65, 0.16, 1)` }}>
          {ROULETTE_WHEEL.map((n, i) => {
            const a0 = ((i * SEG - 90) * Math.PI) / 180;
            const a1 = (((i + 1) * SEG - 90) * Math.PI) / 180;
            const color = rouletteColor(n);
            const fill = color === 'GREEN' ? '#14935a' : color === 'RED' ? '#c8283a' : '#161b27';
            const mid = (i + 0.5) * SEG;
            return (
              <g key={n}>
                <path
                  d={`M0 0 L${r * Math.cos(a0)} ${r * Math.sin(a0)} A${r} ${r} 0 0 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)} Z`}
                  fill={fill}
                  stroke="#d8b25a"
                  strokeWidth={0.6}
                />
                <text
                  x={0}
                  y={-86}
                  transform={`rotate(${mid})`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={9}
                  fontWeight={700}
                  fill="#fff"
                  fontFamily="Outfit Variable, sans-serif"
                >
                  {n}
                </text>
              </g>
            );
          })}
          <circle r={70} fill="none" stroke="#d8b25a" strokeWidth={1.2} />
          <circle r={62} fill="#2b1c06" />
          <circle r={58} fill="url(#hub)" />
          {[0, 45, 90, 135].map((a) => (
            <rect key={a} x={-2.5} y={-46} width={5} height={92} rx={2.5} fill="#e5a91a" transform={`rotate(${a})`} />
          ))}
          <circle r={13} fill="#f7c948" stroke="#8a620e" strokeWidth={2} />
        </g>
        <defs>
          <radialGradient id="hub">
            <stop offset="0%" stopColor="#5a3d0b" />
            <stop offset="100%" stopColor="#2b1c06" />
          </radialGradient>
        </defs>
        {/* Pointer + ball at the top */}
        <path d="M0 -94 L-8 -110 L8 -110 Z" fill="#fff" stroke="#b98510" strokeWidth={1.5} />
        {result !== null && <circle cx={0} cy={-78} r={5} fill="#fff" stroke="#999" strokeWidth={0.8} />}
      </svg>
    </div>
  );
}

/* ─────────────── Board ─────────────── */

function SpotButton({
  spot,
  amount,
  won,
  onPlace,
  disabled,
  className,
  children,
  label,
}: {
  spot: Spot;
  amount?: number;
  won: boolean;
  onPlace: (spot: Spot) => void;
  disabled: boolean;
  className?: string;
  children: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onPlace(spot)}
      aria-label={`${label}${amount ? `. Your bet ${formatINR(amount)}` : ''}${won ? '. Winner' : ''}`}
      className={cn(
        'relative flex min-h-11 items-center justify-center rounded-lg border border-white/15 font-display font-semibold transition hover:brightness-125 disabled:cursor-default disabled:hover:brightness-100',
        won && 'z-10 ring-2 ring-gold-300 ring-offset-1 ring-offset-felt-dark',
        className,
      )}
    >
      {children}
      {amount ? <PlacedChip amount={amount} className="absolute -right-1 -top-1.5" /> : null}
    </button>
  );
}

const COLUMN_NUMBERS = (col: number) => Array.from({ length: 12 }, (_, i) => i * 3 + col);

export default function RouletteGame({ config }: GameProps) {
  const reduced = useReducedMotion();
  const balance = useBalance();
  const commit = useCommitBalance();
  const { play, retry, pending, error, clearError } = usePlayRound<{ betAmount: number; bets: RouletteBet[] }, GameResult<RouletteDetail>>('roulette');

  const [chip, setChip] = useState<number>(BET_CHIPS[2]);
  const [bets, setBets] = useState<Record<string, number>>({});
  /** Placement log, so Undo removes exactly the last chip. */
  const [placed, setPlaced] = useState<{ key: string; amount: number }[]>([]);
  const [lastBets, setLastBets] = useState<Record<string, number> | null>(null);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<GameResult<RouletteDetail> | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const timer = useRef<number>(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const total = Object.values(bets).reduce((s, n) => s + n, 0);
  const busy = pending || spinning;
  const spinMs = reduced ? 250 : 4200;

  const place = (spot: Spot) => {
    if (busy || total + chip > config.maxBet) return;
    if (result) setResult(null);
    const key = keyOf(spot);
    setBets((b) => ({ ...b, [key]: (b[key] ?? 0) + chip }));
    setPlaced((p) => [...p, { key, amount: chip }]);
  };

  const undo = () => {
    const last = placed[placed.length - 1];
    if (!last) return;
    setPlaced((p) => p.slice(0, -1));
    setBets((b) => {
      const next = { ...b };
      const remaining = (b[last.key] ?? 0) - last.amount;
      if (remaining <= 0) delete next[last.key];
      else next[last.key] = remaining;
      return next;
    });
  };

  const reveal = (res: GameResult<RouletteDetail>) => {
    setSpinning(false);
    setResult(res);
    commit(res.virtualBalance);
    setLastBets(bets);
    setBets({});
    setPlaced([]);
    const headline = `${res.detail.number} ${COLOR_WORD[res.detail.color]}`;
    setAnnouncement(outcomeAnnouncement(res.outcome, headline, res.payout, res.betAmount));
  };

  const animate = (res: GameResult<RouletteDetail>) => {
    const idx = ROULETTE_WHEEL.indexOf(res.detail.number as (typeof ROULETTE_WHEEL)[number]);
    const target = (360 - (idx + 0.5) * SEG) % 360;
    const current = ((rotation % 360) + 360) % 360;
    let delta = target - current;
    if (delta < 0) delta += 360;
    setSpinning(true);
    setRotation(rotation + (reduced ? 0 : 360 * 5) + delta);
    timer.current = window.setTimeout(() => reveal(res), spinMs + 150);
  };

  const spin = async () => {
    if (total === 0) return;
    const body = {
      betAmount: total,
      bets: Object.entries(bets).map(([key, amount]) => ({ ...spotOf(key), amount }) as RouletteBet),
    };
    const res = await play(body);
    if (res) animate(res);
  };

  const onRetry = async () => {
    const res = await retry();
    if (res) animate(res);
  };

  const rebet = () => {
    if (!lastBets) return;
    setResult(null);
    setBets(lastBets);
    setPlaced(Object.entries(lastBets).map(([key, amount]) => ({ key, amount })));
  };

  const winning = (spot: Spot) => (result && !spinning ? rouletteBetWins(spot, result.detail.number) && Boolean(bets[keyOf(spot)] ?? lastBets?.[keyOf(spot)]) : false);
  const isHit = (n: number) => !!result && !spinning && result.detail.number === n;
  const spotProps = (spot: Spot) => ({
    spot,
    amount: bets[keyOf(spot)],
    won: winning(spot),
    onPlace: place,
    disabled: busy,
    label: rouletteBetLabel(spot),
  });

  const numberCell = (n: number, className?: string) => {
    const color = rouletteColor(n);
    return (
      <SpotButton
        key={n}
        {...spotProps({ type: 'NUMBER', value: n })}
        label={`${n} ${COLOR_WORD[color]}`}
        className={cn(COLOR_CLASS[color], isHit(n) && 'ring-2 ring-white', className)}
      >
        {n}
      </SpotButton>
    );
  };

  const insufficient = balance !== undefined && total > balance;

  const mobileBoard = (
    <div className="space-y-3 lg:hidden">
      <div className="grid grid-cols-2 gap-2">
        <SpotButton {...spotProps({ type: 'RED' })} className="h-12 bg-table-red text-white">
          ◆ Red <span className="ml-1 text-xs opacity-80">1:1</span>
        </SpotButton>
        <SpotButton {...spotProps({ type: 'BLACK' })} className="h-12 bg-table-black text-white">
          ◆ Black <span className="ml-1 text-xs opacity-80">1:1</span>
        </SpotButton>
        <SpotButton {...spotProps({ type: 'ODD' })} className="h-12 bg-white/[0.06]">
          Odd <span className="ml-1 text-xs opacity-70">1:1</span>
        </SpotButton>
        <SpotButton {...spotProps({ type: 'EVEN' })} className="h-12 bg-white/[0.06]">
          Even <span className="ml-1 text-xs opacity-70">1:1</span>
        </SpotButton>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((d) => (
          <SpotButton key={`d${d}`} {...spotProps({ type: 'DOZEN', value: d })} className="h-12 flex-col bg-white/[0.06] text-sm leading-tight">
            {rouletteBetLabel({ type: 'DOZEN', value: d })}
            <span className="text-[10px] font-normal opacity-70">2:1</span>
          </SpotButton>
        ))}
        {[1, 2, 3].map((c) => (
          <SpotButton key={`c${c}`} {...spotProps({ type: 'COLUMN', value: c })} className="h-12 flex-col bg-white/[0.06] text-sm leading-tight">
            Col {c}
            <span className="text-[10px] font-normal opacity-70">{c}, {c + 3}, {c + 6}… · 2:1</span>
          </SpotButton>
        ))}
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {numberCell(0, 'col-span-6 h-11')}
        {Array.from({ length: 36 }, (_, i) => numberCell(i + 1, 'h-11 text-[15px]'))}
      </div>
    </div>
  );

  const desktopBoard = (
    <div className="hidden lg:block">
      <div className="grid grid-cols-[56px_repeat(12,minmax(0,1fr))_64px] gap-1.5">
        {numberCell(0, 'row-span-3 h-full text-lg')}
        {[3, 2, 1].map((col) => COLUMN_NUMBERS(col).map((n) => numberCell(n, 'h-12 text-[15px]')).concat(
          <SpotButton key={`col${col}`} {...spotProps({ type: 'COLUMN', value: col })} className="h-12 bg-white/[0.06] text-sm">
            2:1
          </SpotButton>,
        ))}
        <div />
        {[1, 2, 3].map((d) => (
          <SpotButton key={`dz${d}`} {...spotProps({ type: 'DOZEN', value: d })} className="col-span-4 h-11 bg-white/[0.06] text-sm">
            {rouletteBetLabel({ type: 'DOZEN', value: d })}
          </SpotButton>
        ))}
        <div />
        <div />
        <SpotButton {...spotProps({ type: 'EVEN' })} className="col-span-3 h-11 bg-white/[0.06] text-sm">
          Even
        </SpotButton>
        <SpotButton {...spotProps({ type: 'RED' })} className="col-span-3 h-11 bg-table-red text-sm text-white">
          ◆ Red
        </SpotButton>
        <SpotButton {...spotProps({ type: 'BLACK' })} className="col-span-3 h-11 bg-table-black text-sm text-white">
          ◆ Black
        </SpotButton>
        <SpotButton {...spotProps({ type: 'ODD' })} className="col-span-3 h-11 bg-white/[0.06] text-sm">
          Odd
        </SpotButton>
      </div>
    </div>
  );

  // The wheel sits above the table on phones/tablets and in the side column on
  // desktop, so the 12-column betting table always gets the full width.
  const wheelBlock = (
    <div className="flex flex-col items-center gap-3">
      <Wheel rotation={rotation} durationMs={spinMs} result={result && !spinning ? result.detail.number : null} />
      <div className="flex h-12 items-center">
        {result && !spinning ? (
          <span className={cn('inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-display text-xl font-bold animate-pop', COLOR_CLASS[result.detail.color])}>
            {result.detail.number} <span className="text-sm font-semibold tracking-wider">{COLOR_WORD[result.detail.color].toUpperCase()}</span>
          </span>
        ) : (
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-white/60">{spinning ? 'No more bets' : 'Place your bets'}</span>
        )}
      </div>
    </div>
  );

  const board = (
    <Panel className="felt overflow-hidden p-3 sm:p-5">
      <div className="mb-4 lg:hidden">{wheelBlock}</div>
      {mobileBoard}
      {desktopBoard}
    </Panel>
  );

  const controls = (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Total virtual bet</p>
          <p className="tabular font-display text-2xl font-semibold text-gold-200">{formatINR(total)}</p>
        </div>
        <div className="flex gap-1.5">
          <Button variant="secondary" size="md" onClick={undo} disabled={busy || placed.length === 0} aria-label="Undo last chip">
            <Undo2 className="size-4" aria-hidden />
          </Button>
          <Button
            variant="secondary"
            size="md"
            onClick={() => {
              setBets({});
              setPlaced([]);
            }}
            disabled={busy || total === 0}
            aria-label="Clear all bets"
          >
            <Eraser className="size-4" aria-hidden />
          </Button>
          <Button variant="secondary" size="md" onClick={rebet} disabled={busy || !lastBets || total > 0}>
            <Repeat className="size-4" aria-hidden /> Rebet
          </Button>
        </div>
      </div>
      <ChipPicker value={chip} onChange={setChip} disabled={busy} chips={BET_CHIPS.filter((c) => c <= config.maxBet)} />
      <p className="text-xs text-subtle">
        Tap the board to place a {formatINR(chip)} chip. Table limits {formatINR(config.minBet)} – {formatINR(config.maxBet)} per spin.
      </p>
    </div>
  );

  const belowMin = total > 0 && total < config.minBet;
  const action = (
    <Button size="xl" block onClick={() => void spin()} disabled={busy || total === 0 || insufficient || belowMin} loading={pending}>
      {insufficient
        ? 'Not enough virtual balance'
        : belowMin
          ? `Minimum ${formatINR(config.minBet)}`
          : total === 0
            ? 'Place a bet to spin'
            : processingLabel(pending, spinning ? 'Spinning…' : `SPIN ROULETTE · ${formatINR(total)}`)}
    </Button>
  );

  return (
    <GameLayout
      gameId="roulette"
      announcement={announcement}
      board={
        <>
          {board}
          {error && <RoundError error={error} onRetry={() => void onRetry()} onDismiss={clearError} />}
          {result && !spinning && (
            <ResultPanel
              bet={result.betAmount}
              payout={result.payout}
              outcome={result.outcome}
              headline={
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn('inline-flex size-8 items-center justify-center rounded-full text-base', COLOR_CLASS[result.detail.color])}>
                    {result.detail.number}
                  </span>
                  <span className="text-base">{COLOR_WORD[result.detail.color].toUpperCase()}</span>
                </span>
              }
              detail={
                <ul className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1">
                  {result.detail.bets.map((b, i) => (
                    <li key={i}>
                      {formatINR(b.amount)} → {rouletteBetLabel(b)}: <span className={b.won ? 'font-semibold text-win' : 'text-loss'}>{b.won ? `won ${formatINR(b.payout)}` : 'lost'}</span>
                    </li>
                  ))}
                </ul>
              }
            />
          )}
        </>
      }
      controls={controls}
      action={action}
      side={<Panel className="felt hidden p-5 lg:block">{wheelBlock}</Panel>}
    />
  );
}
