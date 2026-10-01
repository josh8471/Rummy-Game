import { POKER_HAND_LABEL, type PokerState } from '@casino/shared';
import { useState } from 'react';
import { BetControl, clampBet } from '../components/BetControl';
import { Paytable, paytableFor } from '../components/Paytable';
import { PlayingCard } from '../components/PlayingCard';
import { Button, Panel } from '../components/ui';
import { cn, formatINR } from '../lib/format';
import { useCommitBalance } from '../lib/queries';
import { GameLayout, outcomeAnnouncement, processingLabel, ResultPanel, RoundError, useBalance, useInteractiveRound } from './common';
import type { GameProps } from './GamePage';

export default function PokerGame({ config }: GameProps) {
  const balance = useBalance();
  const commit = useCommitBalance();
  const { round, loading, pending, error, clearError, deal, act } = useInteractiveRound<PokerState>('poker');
  const [bet, setBet] = useState(() => clampBet(500, config.minBet, config.maxBet));
  const [holds, setHolds] = useState<boolean[]>([false, false, false, false, false]);
  const [announcement, setAnnouncement] = useState('');

  const state = round?.state;
  const holding = round?.status === 'IN_PROGRESS';
  const done = round?.status === 'SETTLED';

  const start = async () => {
    setHolds([false, false, false, false, false]);
    const next = await deal(bet);
    if (next) {
      commit(next.virtualBalance);
      setAnnouncement(`Dealt: ${next.state.handLabel}. Choose cards to hold, then draw.`);
    }
  };

  const draw = async () => {
    const next = await act({ action: 'DRAW', holds });
    if (next?.status === 'SETTLED' && next.outcome) {
      commit(next.virtualBalance);
      setAnnouncement(outcomeAnnouncement(next.outcome, next.state.handLabel, next.payout ?? 0, next.betAmount));
    }
  };

  const toggle = (i: number) => setHolds((h) => h.map((v, j) => (j === i ? !v : v)));
  const insufficient = balance !== undefined && balance < bet;
  const finalHand = done && state ? POKER_HAND_LABEL[state.hand] : undefined;

  const board = (
    <Panel className="overflow-hidden bg-gradient-to-b from-[#2a0c1f] to-[#12050d] p-4 sm:p-6">
      <div className="mx-auto max-w-[640px]">
        <div className="hidden rounded-xl border border-gold-500/30 bg-black/30 p-2 sm:block">
          <Paytable rows={paytableFor('poker')} highlight={finalHand} className="[&_tr]:border-white/[0.06] [&_td]:py-1 text-[13px]" />
        </div>
        <p className="mt-4 h-7 text-center font-display text-lg font-semibold text-gold-200" aria-hidden>
          {state ? (done ? state.handLabel : state.hand !== 'NOTHING' ? `You have ${state.handLabel}` : 'Choose cards to hold') : 'Jacks or Better'}
        </p>
        <div className="mt-2 grid grid-cols-5 gap-1.5 sm:gap-3" role="group" aria-label="Your cards">
          {(state?.cards ?? Array.from({ length: 5 }, () => null)).map((card, i) => {
            const held = holding ? holds[i]! : done ? state!.held[i]! : false;
            return (
              <button
                key={`${round?.roundId ?? 'none'}-${i}-${done}`}
                type="button"
                disabled={!holding || pending}
                onClick={() => toggle(i)}
                aria-pressed={holding ? held : undefined}
                aria-label={card ? `${held ? 'Held: ' : ''}card ${i + 1}` : `Card ${i + 1}, not dealt`}
                className={cn('flex flex-col items-center gap-1.5 rounded-xl pb-1 transition disabled:cursor-default', held && holding && '-translate-y-2')}
              >
                <PlayingCard card={card} faceDown={!card} size="lg" highlight={held} delayMs={i * 80} className="max-w-full" />
                <span
                  className={cn(
                    'h-6 rounded-full px-2 text-[11px] font-extrabold uppercase leading-6 tracking-wider',
                    held ? 'bg-gold-400 text-ink-950' : holding ? 'text-white/50' : 'text-transparent',
                  )}
                >
                  {held ? 'Held' : 'Tap to hold'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Panel>
  );

  const action = holding ? (
    <Button size="xl" block onClick={() => void draw()} disabled={pending} loading={pending}>
      {processingLabel(pending, holds.every(Boolean) ? 'STAND PAT' : `DRAW ${holds.filter((h) => !h).length}`)}
    </Button>
  ) : (
    <Button size="xl" block onClick={() => void start()} disabled={pending || loading || insufficient} loading={pending}>
      {insufficient ? 'Not enough virtual balance' : processingLabel(pending, done ? `DEAL AGAIN · ${formatINR(bet)}` : `DEAL · ${formatINR(bet)}`)}
    </Button>
  );

  return (
    <GameLayout
      gameId="poker"
      paytableOnBoard
      announcement={announcement}
      board={
        <>
          {board}
          {error && <RoundError error={error} onDismiss={clearError} />}
          {round && done && round.outcome && (
            <ResultPanel
              bet={round.betAmount}
              payout={round.payout ?? 0}
              outcome={round.outcome}
              outcomeLabel={round.payout === round.betAmount ? 'Stake back' : undefined}
              headline={round.state.handLabel}
              detail={round.state.multiplier > 0 ? `Pays ${round.state.multiplier}×` : 'No paying hand'}
            />
          )}
        </>
      }
      controls={
        holding ? (
          <p className="text-center text-sm text-muted">Tap the cards you want to keep, then draw. Unheld cards are replaced.</p>
        ) : (
          <BetControl value={bet} onChange={setBet} min={config.minBet} max={config.maxBet} balance={balance} disabled={pending} />
        )
      }
      action={action}
    />
  );
}
