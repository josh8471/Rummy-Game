import type { BlackjackAction, BlackjackHandView, BlackjackState } from '@casino/shared';
import { useEffect, useRef, useState } from 'react';
import { BetControl, clampBet } from '../components/BetControl';
import { PlayingCard } from '../components/PlayingCard';
import { Button, Panel } from '../components/ui';
import { cn, formatINR } from '../lib/format';
import { useCommitBalance } from '../lib/queries';
import { useReducedMotion } from '../lib/settings';
import { GameLayout, outcomeAnnouncement, processingLabel, ResultPanel, RoundError, useBalance, useInteractiveRound } from './common';
import type { GameProps } from './GamePage';

const RESULT_TEXT = { BLACKJACK: 'Blackjack!', WIN: 'Win', PUSH: 'Push', LOSS: 'Loss' } as const;
const RESULT_STYLE = {
  BLACKJACK: 'bg-gold-400 text-ink-950',
  WIN: 'bg-win text-ink-950',
  PUSH: 'bg-white/80 text-ink-950',
  LOSS: 'bg-loss text-ink-950',
} as const;

function totalLabel(total: number, soft: boolean) {
  return soft && total < 21 ? `${total - 10} / ${total}` : String(total);
}

function HandView({ hand, active, index, count }: { hand: BlackjackHandView; active: boolean; index: number; count: number }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center rounded-2xl border px-3 pb-3 pt-2 transition',
        active ? 'border-gold-300/80 bg-gold-400/10' : 'border-transparent',
      )}
      aria-label={count > 1 ? `Hand ${index + 1}` : 'Your hand'}
    >
      <div className="flex h-7 items-center gap-2 text-sm">
        {count > 1 && <span className="font-semibold text-white/70">Hand {index + 1}</span>}
        <span className="tabular rounded-full bg-black/40 px-2.5 py-0.5 font-display font-bold text-white">
          {hand.status === 'BUST' ? `Bust ${hand.total}` : totalLabel(hand.total, hand.soft)}
        </span>
        {hand.result && <span className={cn('rounded-full px-2 py-0.5 text-xs font-extrabold uppercase', RESULT_STYLE[hand.result])}>{RESULT_TEXT[hand.result]}</span>}
      </div>
      <div className="mt-2 flex pl-6">
        {hand.cards.map((card, i) => (
          <PlayingCard key={i} card={card} size="md" className="-ml-6 sm:-ml-5" delayMs={i < 2 ? i * 120 : 0} />
        ))}
      </div>
      <p className="mt-1.5 text-xs text-white/70">
        Bet {formatINR(hand.bet)}
        {hand.doubled && ' · doubled'}
      </p>
    </div>
  );
}

export default function BlackjackGame({ config }: GameProps) {
  const reduced = useReducedMotion();
  const balance = useBalance();
  const commit = useCommitBalance();
  const { round, loading, pending, error, clearError, deal, act } = useInteractiveRound<BlackjackState>('blackjack');
  const [bet, setBet] = useState(() => clampBet(500, config.minBet, config.maxBet));
  const [revealed, setRevealed] = useState(true);
  const [announcement, setAnnouncement] = useState('');
  const timer = useRef(0);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const state = round?.state;
  const settled = round?.status === 'SETTLED';
  const playing = round?.status === 'IN_PROGRESS';

  /** Commit balance and announce once the dealer's cards have been shown. */
  const onRound = (next: typeof round) => {
    if (!next) return;
    if (next.status === 'SETTLED') {
      setRevealed(false);
      timer.current = window.setTimeout(
        () => {
          setRevealed(true);
          commit(next.virtualBalance);
          const s = next.state;
          const summary = s.hands.map((h) => `${RESULT_TEXT[h.result!]} with ${h.total}`).join(', ');
          setAnnouncement(outcomeAnnouncement(next.outcome!, `${summary}. Dealer ${s.dealer.total}`, next.payout ?? 0, next.betAmount));
        },
        reduced ? 50 : 350 + next.state.dealer.cards.length * 220,
      );
    } else {
      commit(next.virtualBalance);
      const hand = next.state.hands[next.state.activeHand ?? 0];
      if (hand) setAnnouncement(`Your total ${hand.total}. Dealer shows ${next.state.dealer.total}.`);
    }
  };

  const start = async () => onRound(await deal(bet));
  const doAction = async (action: BlackjackAction) => onRound(await act({ action }));

  const activeHand = state && state.activeHand !== null ? state.hands[state.activeHand] : undefined;
  const allowed = new Set(state?.allowedActions ?? []);
  const canAfford = (extra: number) => balance === undefined || balance >= extra;
  const insufficient = balance !== undefined && balance < bet;
  const dealerDone = settled && revealed;

  const board = (
    <Panel className="felt relative overflow-hidden p-4 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-[50%] border border-gold-300/15" />
      <div className="relative flex min-h-[380px] flex-col justify-between gap-4 sm:min-h-[420px]">
        <div className="flex flex-col items-center" aria-label="Dealer">
          <div className="flex h-7 items-center gap-2 text-sm">
            <span className="font-semibold uppercase tracking-[0.2em] text-white/70">Dealer</span>
            {state && (
              <span className="tabular rounded-full bg-black/40 px-2.5 py-0.5 font-display font-bold text-white">
                {state.dealer.hasHiddenCard ? `${state.dealer.total} + ?` : settled && !revealed ? '…' : state.dealer.total > 21 ? `Bust ${state.dealer.total}` : state.dealer.total}
              </span>
            )}
          </div>
          <div className="mt-2 flex min-h-[90px] pl-6">
            {state ? (
              <>
                {state.dealer.cards.map((card, i) =>
                  i === 0 || dealerDone ? (
                    <PlayingCard key={`${i}-${dealerDone}`} card={card} size="md" className="-ml-6 sm:-ml-5" delayMs={i === 0 ? 0 : (i - 1) * 220} />
                  ) : (
                    <PlayingCard key={`h${i}`} faceDown size="md" className="-ml-6 sm:-ml-5" />
                  ),
                )}
                {state.dealer.hasHiddenCard && <PlayingCard faceDown size="md" className="-ml-6 sm:-ml-5" />}
              </>
            ) : (
              <p className="self-center text-sm text-white/60">Dealer stands on 17 · Blackjack pays 3:2</p>
            )}
          </div>
        </div>

        <p className="text-center font-display text-xs font-bold uppercase tracking-[0.35em] text-gold-200/60">
          {playing ? 'Your move' : settled ? (revealed ? 'Round over' : 'Dealer plays…') : 'Place your bet'}
        </p>

        <div className="flex flex-wrap items-end justify-center gap-2">
          {state ? (
            state.hands.map((hand, i) => <HandView key={i} hand={hand} index={i} count={state.hands.length} active={playing === true && state.activeHand === i} />)
          ) : (
            <div className="flex h-[120px] items-center">
              <span className="rounded-full border-2 border-dashed border-white/40 px-5 py-2 font-display font-bold text-white/80">{formatINR(bet)}</span>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );

  const actionButtons = (
    <div className="grid grid-cols-4 gap-2">
      <Button size="lg" onClick={() => void doAction('HIT')} disabled={pending || !allowed.has('HIT')}>
        HIT
      </Button>
      <Button size="lg" variant="secondary" onClick={() => void doAction('STAND')} disabled={pending || !allowed.has('STAND')}>
        STAND
      </Button>
      <Button
        size="lg"
        variant="secondary"
        onClick={() => void doAction('DOUBLE')}
        disabled={pending || !allowed.has('DOUBLE') || !canAfford(activeHand?.bet ?? 0)}
        title={allowed.has('DOUBLE') && !canAfford(activeHand?.bet ?? 0) ? 'Not enough virtual balance' : undefined}
      >
        DOUBLE
      </Button>
      <Button
        size="lg"
        variant="secondary"
        onClick={() => void doAction('SPLIT')}
        disabled={pending || !allowed.has('SPLIT') || !canAfford(activeHand?.bet ?? 0)}
        title={allowed.has('SPLIT') && !canAfford(activeHand?.bet ?? 0) ? 'Not enough virtual balance' : undefined}
      >
        SPLIT
      </Button>
    </div>
  );

  const action = playing ? (
    actionButtons
  ) : (
    <Button size="xl" block onClick={() => void start()} disabled={pending || loading || insufficient || (settled && !revealed)} loading={pending}>
      {insufficient ? 'Not enough virtual balance' : processingLabel(pending, settled ? `DEAL AGAIN · ${formatINR(bet)}` : `DEAL · ${formatINR(bet)}`)}
    </Button>
  );

  return (
    <GameLayout
      gameId="blackjack"
      announcement={announcement}
      board={
        <>
          {board}
          {error && <RoundError error={error} onDismiss={clearError} />}
          {round && settled && revealed && round.outcome && (
            <ResultPanel
              bet={round.betAmount}
              payout={round.payout ?? 0}
              outcome={round.outcome}
              outcomeLabel={round.state.hands.every((h) => h.result === 'PUSH') ? 'Push — stake back' : undefined}
              headline={round.state.hands.map((h) => RESULT_TEXT[h.result!]).join(' / ')}
              detail={`Dealer ${round.state.dealer.total > 21 ? `bust (${round.state.dealer.total})` : round.state.dealer.total} · You ${round.state.hands.map((h) => h.total).join(' / ')}`}
            />
          )}
        </>
      }
      controls={
        playing ? (
          <p className="text-center text-sm text-muted">
            {activeHand ? `Playing ${state!.hands.length > 1 ? `hand ${state!.activeHand! + 1} · ` : ''}total ${activeHand.total}. ` : ''}
            Double and Split add another {formatINR(activeHand?.bet ?? bet)} virtual stake.
          </p>
        ) : (
          <BetControl value={bet} onChange={setBet} min={config.minBet} max={config.maxBet} balance={balance} disabled={pending || (settled && !revealed)} />
        )
      }
      action={action}
    />
  );
}
