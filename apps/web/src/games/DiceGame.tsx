import { BET_CHIPS, DICE_BET_LABEL, DICE_RETURN, diceBetWins, type DiceBet, type DiceBetType, type DiceDetail, type GameResult } from '@casino/shared';
import { Eraser, Repeat } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ChipPicker, PlacedChip } from '../components/BetControl';
import { Button, Panel } from '../components/ui';
import { cn, formatINR } from '../lib/format';
import { useCommitBalance } from '../lib/queries';
import { useReducedMotion } from '../lib/settings';
import { GameLayout, outcomeAnnouncement, processingLabel, ResultPanel, RoundError, useBalance, usePlayRound } from './common';
import type { GameProps } from './GamePage';

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

function Die({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <div
      role="img"
      aria-label={`Die showing ${value}`}
      className={cn(
        'grid size-20 grid-cols-3 grid-rows-3 gap-1 rounded-2xl bg-gradient-to-br from-white to-slate-200 p-3 shadow-[0_14px_30px_-10px_rgb(0_0_0/0.7),inset_0_-4px_0_rgb(0_0_0/0.12)] sm:size-24',
        rolling && 'animate-tumble',
      )}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} className="flex items-center justify-center">
          {PIPS[value]!.includes(i) && <span className={cn('size-3.5 rounded-full sm:size-4', value === 1 ? 'bg-table-red' : 'bg-slate-900')} />}
        </span>
      ))}
    </div>
  );
}

const ZONES: { type: DiceBetType; sub: string }[] = [
  { type: 'DOWN', sub: 'Total 2 – 6' },
  { type: 'SEVEN', sub: 'Total exactly 7' },
  { type: 'UP', sub: 'Total 8 – 12' },
];

export default function DiceGame({ config }: GameProps) {
  const reduced = useReducedMotion();
  const balance = useBalance();
  const commit = useCommitBalance();
  const { play, retry, pending, error, clearError } = usePlayRound<{ betAmount: number; bets: DiceBet[] }, GameResult<DiceDetail>>('dice');

  const [chip, setChip] = useState<number>(BET_CHIPS[2]);
  const [bets, setBets] = useState<Partial<Record<DiceBetType, number>>>({});
  const [lastBets, setLastBets] = useState<Partial<Record<DiceBetType, number>> | null>(null);
  const [faces, setFaces] = useState<[number, number]>([3, 4]);
  const [rolling, setRolling] = useState(false);
  const [result, setResult] = useState<GameResult<DiceDetail> | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const total = Object.values(bets).reduce((s, n) => s + (n ?? 0), 0);
  const busy = pending || rolling;

  const place = (type: DiceBetType) => {
    if (busy || total + chip > config.maxBet) return;
    setResult(null);
    setBets((b) => ({ ...b, [type]: (b[type] ?? 0) + chip }));
  };

  const reveal = (res: GameResult<DiceDetail>) => {
    setFaces(res.detail.dice);
    setRolling(false);
    setResult(res);
    commit(res.virtualBalance);
    setLastBets(bets);
    setBets({});
    setAnnouncement(outcomeAnnouncement(res.outcome, `${res.detail.dice[0]} and ${res.detail.dice[1]}, total ${res.detail.total}`, res.payout, res.betAmount));
  };

  const animate = (res: GameResult<DiceDetail>) => {
    if (reduced) return reveal(res);
    setRolling(true);
    // Flicker random faces while tumbling, then land on the server's roll.
    for (let i = 0; i < 8; i++) {
      timers.current.push(window.setTimeout(() => setFaces([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]), i * 85));
    }
    timers.current.push(window.setTimeout(() => reveal(res), 760));
  };

  const roll = async () => {
    const list = (Object.entries(bets) as [DiceBetType, number][]).filter(([, a]) => a > 0).map(([type, amount]) => ({ type, amount }));
    if (list.length === 0) return;
    const res = await play({ betAmount: total, bets: list });
    if (res) animate(res);
  };

  const onRetry = async () => {
    const res = await retry();
    if (res) animate(res);
  };

  const insufficient = balance !== undefined && total > balance;
  const belowMin = total > 0 && total < config.minBet;
  const shownTotal = faces[0] + faces[1];

  const board = (
    <Panel className="felt overflow-hidden p-4 sm:p-6">
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-5 py-2 sm:gap-8">
          <Die value={faces[0]} rolling={rolling} />
          <Die value={faces[1]} rolling={rolling} />
        </div>
        <p className="mt-3 h-8 font-display text-2xl font-semibold text-white/90" aria-hidden={rolling}>
          {rolling ? 'Rolling…' : result ? `Total ${shownTotal}` : '7 Up · 7 Down'}
        </p>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        {ZONES.map(({ type, sub }) => {
          const won = !!result && !rolling && diceBetWins(type, result.detail.total);
          const amount = bets[type];
          return (
            <button
              key={type}
              type="button"
              disabled={busy}
              onClick={() => place(type)}
              aria-label={`${DICE_BET_LABEL[type]}, pays ${DICE_RETURN[type] - 1} to 1${amount ? `. Your bet ${formatINR(amount)}` : ''}${won ? '. Winner' : ''}`}
              className={cn(
                'relative flex min-h-28 flex-col items-center justify-center rounded-2xl border-2 px-1 py-3 text-center transition hover:brightness-110 disabled:cursor-default',
                type === 'SEVEN' ? 'border-gold-400/70 bg-gold-400/15' : 'border-white/25 bg-black/20',
                won && 'ring-4 ring-gold-300',
              )}
            >
              <span className="font-display text-lg font-bold leading-tight text-white sm:text-2xl">
                {type === 'DOWN' ? '7 Down' : type === 'UP' ? '7 Up' : 'Lucky 7'}
              </span>
              <span className="mt-0.5 text-[11px] text-white/75 sm:text-sm">{sub}</span>
              <span className="mt-1.5 rounded-full bg-black/30 px-2 py-0.5 text-[11px] font-bold text-gold-200 sm:text-xs">
                Pays {DICE_RETURN[type] - 1}:1
              </span>
              {amount ? <PlacedChip amount={amount} className="absolute -right-1 -top-2" /> : null}
            </button>
          );
        })}
      </div>
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
          <Button variant="secondary" onClick={() => setBets({})} disabled={busy || total === 0} aria-label="Clear bets">
            <Eraser className="size-4" aria-hidden />
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              if (lastBets) setBets(lastBets);
              setResult(null);
            }}
            disabled={busy || !lastBets || total > 0}
          >
            <Repeat className="size-4" aria-hidden /> Rebet
          </Button>
        </div>
      </div>
      <ChipPicker value={chip} onChange={setChip} disabled={busy} chips={BET_CHIPS.filter((c) => c <= config.maxBet)} />
      <p className="text-xs text-subtle">Tap a zone to place a {formatINR(chip)} chip. You can back more than one.</p>
    </div>
  );

  const action = (
    <Button size="xl" block onClick={() => void roll()} disabled={busy || total === 0 || insufficient || belowMin} loading={pending}>
      {insufficient
        ? 'Not enough virtual balance'
        : belowMin
          ? `Minimum ${formatINR(config.minBet)}`
          : total === 0
            ? 'Place a bet to roll'
            : processingLabel(pending, rolling ? 'Rolling…' : `ROLL DICE · ${formatINR(total)}`)}
    </Button>
  );

  return (
    <GameLayout
      gameId="dice"
      announcement={announcement}
      board={
        <>
          {board}
          {error && <RoundError error={error} onRetry={() => void onRetry()} onDismiss={clearError} />}
          {result && !rolling && (
            <ResultPanel
              bet={result.betAmount}
              payout={result.payout}
              outcome={result.outcome}
              headline={`${result.detail.dice[0]} + ${result.detail.dice[1]} = ${result.detail.total}`}
              detail={result.detail.bets
                .map((b) => `${DICE_BET_LABEL[b.type]}: ${b.won ? `won ${formatINR(b.payout)}` : 'lost'}`)
                .join(' · ')}
            />
          )}
        </>
      }
      controls={controls}
      action={action}
    />
  );
}
