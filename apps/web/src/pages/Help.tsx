import { GAME_IDS, GAMES } from '@casino/shared';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { Paytable, paytableFor } from '../components/Paytable';
import { VirtualNotice } from '../components/VirtualNotice';
import { PageHeader, Panel } from '../components/ui';

function Item({ question, children }: { question: string; children: ReactNode }) {
  return (
    <details className="group border-b border-white/[0.07] last:border-0">
      <summary className="flex min-h-12 list-none items-center justify-between gap-3 py-3 font-semibold [&::-webkit-details-marker]:hidden">
        {question}
        <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="pb-4 text-muted">{children}</div>
    </details>
  );
}

export default function HelpPage() {
  return (
    <>
      <PageHeader title="Help" subtitle="How SimCasino works." actions={<VirtualNotice />} />
      <div className="grid grid-cols-1 max-w-5xl gap-5 lg:grid-cols-2 lg:items-start">
        <Panel className="px-5 py-2">
          <h2 className="pb-1 pt-3 text-lg font-semibold">Frequently asked</h2>
          <Item question="Is this real money?">
            No. Every ₹ in SimCasino is virtual and has no cash value. There are no deposits, withdrawals, cash-outs, crypto conversions,
            transfers between players, or redemptions for goods or services. Internally the currency is labelled <code>INR_VIRTUAL</code>.
          </Item>
          <Item question="How are results decided?">
            On the server. When you play, the server checks your bet, draws a random number, applies your simulation profile, works out the
            result with the game’s rules and updates your virtual wallet in one database transaction. Your device never decides a result.
          </Item>
          <Item question="What is a simulation profile?">
            A set of chances (Win, Small win, Big win, Loss) used to test and balance the games. You can see yours on your Profile page. Each
            game still follows its own rules and paytable. If a bet can’t produce the drawn result (for example, a single Red bet can’t be a
            25× big win) the game picks the closest sensible result. A big payout is only possible when a Big Win is drawn.
          </Item>
          <Item question="Do my choices matter in Blackjack and Poker?">
            Yes. In Blackjack your own cards are dealt naturally — if you hit and go over 21, you bust. In Poker, the cards you hold stay in
            your hand.
          </Item>
          <Item question="Why was my balance not changed after an error?">
            Bets are only taken once a round is fully validated. If anything fails, the whole round is cancelled and your virtual balance
            stays exactly as it was. Retrying a failed request is safe — it can never charge you twice.
          </Item>
          <Item question="How do daily rewards work?">
            Claim once per day (resets at midnight IST). Claiming on consecutive days builds a streak that increases the reward up to Day 7.
          </Item>
          <Item question="Can I get reminders to take a break?">
            Yes — by default we remind you every 30 minutes with your session time and results. Change it in Settings.
          </Item>
        </Panel>
        <Panel className="px-5 py-2">
          <h2 className="pb-1 pt-3 text-lg font-semibold">Game rules & paytables</h2>
          {GAME_IDS.map((id) => (
            <Item key={id} question={GAMES[id].name}>
              <ul className="list-disc space-y-1 pl-5">
                {GAMES[id].howToPlay.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <Paytable rows={paytableFor(id)} className="mt-3 max-w-md" />
              <p className="mt-2 text-xs text-subtle">Payouts shown as total return including your stake. Amounts are rounded to whole virtual rupees.</p>
            </Item>
          ))}
        </Panel>
      </div>
    </>
  );
}
