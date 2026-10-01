import type { GameResult, TeenPattiDetail } from '@casino/shared';
import { useEffect, useRef, useState } from 'react';
import { BetControl, clampBet } from '../components/BetControl';
import { PlayingCard } from '../components/PlayingCard';
import { Button, Panel } from '../components/ui';
import { cn } from '../lib/format';
import { useCommitBalance } from '../lib/queries';
import { useReducedMotion } from '../lib/settings';
import { GameLayout, outcomeAnnouncement, processingLabel, ResultPanel, RoundError, useBalance, usePlayRound } from './common';
import type { GameProps } from './GamePage';

type Stage = 'idle' | 'dealt' | 'player' | 'done';

function Hand({
  title,
  info,
  revealed,
  winner,
  dealtCount,
}: {
  title: string;
  info: TeenPattiDetail['player'] | null;
  revealed: boolean;
  winner: boolean;
  dealtCount: number;
}) {
  return (
    <div className={cn('rounded-2xl border p-3 text-center transition sm:p-4', winner ? 'border-gold-300/80 bg-gold-400/10' : 'border-white/15 bg-black/15')}>
      <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-white/80">{title}</p>
      <div className="mt-2 flex justify-center gap-2 sm:gap-3">
        {[0, 1, 2].map((i) =>
          i < dealtCount ? (
            <PlayingCard key={`${i}-${revealed}`} card={revealed ? info?.cards[i] : null} faceDown={!revealed} size="lg" highlight={winner && revealed} delayMs={i * 90} />
          ) : (
            <div key={i} className="h-[96px] w-[68px] rounded-xl border border-dashed border-white/20 sm:h-[118px] sm:w-[84px]" aria-hidden />
          ),
        )}
      </div>
      <p className="mt-2 h-6 font-semibold text-gold-200">{revealed && info ? info.label : ''}</p>
    </div>
  );
}

export default function TeenPattiGame({ config }: GameProps) {
  const reduced = useReducedMotion();
  const balance = useBalance();
  const commit = useCommitBalance();
  const { play, retry, pending, error, clearError } = usePlayRound<{ betAmount: number }, GameResult<TeenPattiDetail>>('teen-patti');

  const [bet, setBet] = useState(() => clampBet(500, config.minBet, config.maxBet));
  const [round, setRound] = useState<GameResult<TeenPattiDetail> | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [announcement, setAnnouncement] = useState('');
  const timers = useRef<number[]>([]);
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  const busy = pending || stage === 'dealt' || stage === 'player';

  const finish = (res: GameResult<TeenPattiDetail>) => {
    setStage('done');
    commit(res.virtualBalance);
    const d = res.detail;
    const headline = d.winner === 'TIE' ? `Tie, both ${d.player.label}` : `${d.winner === 'PLAYER' ? 'You win' : 'Dealer wins'}: ${d.player.label} against ${d.dealer.label}`;
    setAnnouncement(outcomeAnnouncement(res.outcome, headline, res.payout, res.betAmount));
  };

  const animate = (res: GameResult<TeenPattiDetail>) => {
    setRound(res);
    if (reduced) return finish(res);
    setStage('dealt');
    timers.current.push(window.setTimeout(() => setStage('player'), 800));
    timers.current.push(window.setTimeout(() => finish(res), 1700));
  };

  const deal = async () => {
    setRound(null);
    setStage('idle');
    const res = await play({ betAmount: bet });
    if (res) animate(res);
  };

  const onRetry = async () => {
    const res = await retry();
    if (res) animate(res);
  };

  const d = round?.detail ?? null;
  const done = stage === 'done';
  const insufficient = balance !== undefined && balance < bet;

  const board = (
    <Panel className="felt overflow-hidden p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-4">
        <Hand title="Dealer" info={d?.dealer ?? null} revealed={done} winner={done && d?.winner === 'DEALER'} dealtCount={round ? 3 : 0} />
        <p className="text-center font-display text-sm font-bold uppercase tracking-[0.3em] text-gold-200/80">
          {done && d ? (d.winner === 'TIE' ? 'Tie' : d.winner === 'PLAYER' ? 'You win' : 'Dealer wins') : 'vs'}
        </p>
        <Hand title="You" info={d?.player ?? null} revealed={stage === 'player' || done} winner={done && d?.winner === 'PLAYER'} dealtCount={round ? 3 : 0} />
      </div>
    </Panel>
  );

  const action = (
    <Button size="xl" block onClick={() => void deal()} disabled={busy || insufficient} loading={pending}>
      {insufficient ? 'Not enough virtual balance' : processingLabel(pending, stage === 'dealt' || stage === 'player' ? 'Revealing…' : 'DEAL')}
    </Button>
  );

  return (
    <GameLayout
      gameId="teen-patti"
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
              headline={round.detail.winner === 'TIE' ? 'Tie' : round.detail.winner === 'PLAYER' ? 'You win' : 'Dealer wins'}
              outcomeLabel={round.detail.winner === 'TIE' ? 'Tie — stake back' : undefined}
              detail={`${round.detail.player.label} vs ${round.detail.dealer.label}${round.detail.winner === 'PLAYER' ? ` · pays ${round.detail.multiplier}×` : ''}`}
            />
          )}
        </>
      }
      controls={<BetControl value={bet} onChange={setBet} min={config.minBet} max={config.maxBet} balance={balance} disabled={busy} />}
      action={action}
    />
  );
}
