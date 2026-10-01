import { ANDAR_BAHAR_RETURN, cardLabel, type AndarBaharDetail, type AndarBaharSide, type Card, type GameResult } from '@casino/shared';
import { useEffect, useRef, useState } from 'react';
import { BetControl, clampBet } from '../components/BetControl';
import { PlayingCard } from '../components/PlayingCard';
import { Button, Panel } from '../components/ui';
import { cn, formatINR } from '../lib/format';
import { useCommitBalance } from '../lib/queries';
import { useReducedMotion } from '../lib/settings';
import { GameLayout, outcomeAnnouncement, processingLabel, ResultPanel, RoundError, useBalance, usePlayRound } from './common';
import type { GameProps } from './GamePage';

const SIDE_LABEL: Record<AndarBaharSide, string> = { ANDAR: 'Andar', BAHAR: 'Bahar' };
const ODDS: Record<AndarBaharSide, string> = { ANDAR: '0.9:1', BAHAR: '1:1' };

function Pile({ side, cards, winner, matchIndex }: { side: AndarBaharSide; cards: Card[]; winner: boolean; matchIndex: number | null }) {
  return (
    <div className={cn('rounded-2xl border p-3 transition', winner ? 'border-gold-300/80 bg-gold-400/10' : 'border-white/15 bg-black/15')}>
      <div className="mb-2 flex items-center justify-between">
        <p className="font-display text-lg font-bold tracking-wide text-white">
          {SIDE_LABEL[side]} <span className="text-sm font-medium text-white/60">{side === 'ANDAR' ? '(inside)' : '(outside)'}</span>
        </p>
        <span className="text-sm text-white/70">{cards.length} cards</span>
      </div>
      <div className="flex min-h-[62px] flex-wrap gap-y-2 pl-4" aria-label={`${SIDE_LABEL[side]} cards`}>
        {cards.map((card, i) => (
          <PlayingCard key={i} card={card} size="sm" highlight={matchIndex === i} className="-ml-4 first:ml-[-1rem]" />
        ))}
      </div>
    </div>
  );
}

export default function AndarBaharGame({ config }: GameProps) {
  const reduced = useReducedMotion();
  const balance = useBalance();
  const commit = useCommitBalance();
  const { play, retry, pending, error, clearError } = usePlayRound<{ betAmount: number; side: AndarBaharSide }, GameResult<AndarBaharDetail>>('andar-bahar');

  const [bet, setBet] = useState(() => clampBet(500, config.minBet, config.maxBet));
  const [side, setSide] = useState<AndarBaharSide>('ANDAR');
  const [round, setRound] = useState<GameResult<AndarBaharDetail> | null>(null);
  const [shown, setShown] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const dealing = round !== null && shown < round.detail.cardsDealt;
  const busy = pending || dealing;

  const finish = (res: GameResult<AndarBaharDetail>) => {
    setShown(res.detail.cardsDealt);
    commit(res.virtualBalance);
    setAnnouncement(
      outcomeAnnouncement(res.outcome, `${SIDE_LABEL[res.detail.winner]} wins after ${res.detail.cardsDealt} cards`, res.payout, res.betAmount),
    );
  };

  const animate = (res: GameResult<AndarBaharDetail>) => {
    setRound(res);
    const n = res.detail.cardsDealt;
    if (reduced) return finish(res);
    setShown(0);
    const step = Math.max(70, Math.min(240, 3200 / n));
    for (let i = 1; i <= n; i++) {
      timers.current.push(window.setTimeout(() => (i === n ? finish(res) : setShown(i)), 350 + i * step));
    }
  };

  const deal = async () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    setRound(null);
    const res = await play({ betAmount: bet, side });
    if (res) animate(res);
  };

  const onRetry = async () => {
    const res = await retry();
    if (res) animate(res);
  };

  // Cards alternate Andar, Bahar, Andar… — reveal them in that order.
  const d = round?.detail;
  const andar = d ? d.andar.slice(0, Math.ceil(shown / 2)) : [];
  const bahar = d ? d.bahar.slice(0, Math.floor(shown / 2)) : [];
  const done = !!d && !dealing;
  const matchIndex = (s: AndarBaharSide) => (done && d!.winner === s ? (s === 'ANDAR' ? d!.andar.length : d!.bahar.length) - 1 : null);
  const insufficient = balance !== undefined && balance < bet;

  const board = (
    <Panel className="felt overflow-hidden p-4 sm:p-6">
      <div className="flex flex-col items-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.3em] text-gold-200">Joker</p>
        {d ? (
          <PlayingCard card={d.joker} size="lg" highlight={done} />
        ) : (
          <PlayingCard faceDown size="lg" animate={false} />
        )}
        <p className="mt-2 h-6 text-sm text-white/80">
          {d ? (done ? `${SIDE_LABEL[d.winner]} matched the ${cardLabel(d.joker).split(' of ')[0]}!` : 'Dealing…') : 'Pick a side and deal'}
        </p>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3">
        <Pile side="ANDAR" cards={andar} winner={done && d!.winner === 'ANDAR'} matchIndex={matchIndex('ANDAR')} />
        <Pile side="BAHAR" cards={bahar} winner={done && d!.winner === 'BAHAR'} matchIndex={matchIndex('BAHAR')} />
      </div>
    </Panel>
  );

  const controls = (
    <div className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-muted">Your side</legend>
        <div className="grid grid-cols-2 gap-2">
          {(['ANDAR', 'BAHAR'] as const).map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              aria-pressed={side === s}
              onClick={() => setSide(s)}
              className={cn(
                'flex h-16 flex-col items-center justify-center rounded-2xl border-2 transition',
                side === s ? 'border-gold-400 bg-gold-400/15 text-gold-200' : 'border-white/10 bg-white/[0.04] text-muted hover:text-fg',
              )}
            >
              <span className="font-display text-lg font-bold">{SIDE_LABEL[s]}</span>
              <span className="text-xs">
                Pays {ODDS[s]} ({ANDAR_BAHAR_RETURN[s]}×)
              </span>
            </button>
          ))}
        </div>
      </fieldset>
      <BetControl value={bet} onChange={setBet} min={config.minBet} max={config.maxBet} balance={balance} disabled={busy} />
    </div>
  );

  const action = (
    <Button size="xl" block onClick={() => void deal()} disabled={busy || insufficient} loading={pending}>
      {insufficient ? 'Not enough virtual balance' : processingLabel(pending, dealing ? 'Dealing…' : `DEAL · ${SIDE_LABEL[side]} ${formatINR(bet)}`)}
    </Button>
  );

  return (
    <GameLayout
      gameId="andar-bahar"
      announcement={announcement}
      board={
        <>
          {board}
          {error && <RoundError error={error} onRetry={() => void onRetry()} onDismiss={clearError} />}
          {round && done && (
            <ResultPanel
              bet={round.betAmount}
              payout={round.payout}
              outcome={round.outcome}
              headline={`${SIDE_LABEL[round.detail.winner]} wins`}
              detail={`You backed ${SIDE_LABEL[round.detail.side]} · ${round.detail.cardsDealt} cards dealt`}
            />
          )}
        </>
      }
      controls={controls}
      action={action}
    />
  );
}
