import { GAMES, STARTING_BALANCE, type GameConfig } from '@casino/shared';
import { ArrowRight, History, Wallet } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { AchievementGrid } from '../components/Achievements';
import { AnimatedAmount } from '../components/Amount';
import { DailyRewardCard } from '../components/DailyReward';
import { GameArt } from '../components/GameArt';
import { GameCard } from '../components/GameCard';
import { Modal } from '../components/Modal';
import { EmptyState, ErrorState } from '../components/States';
import { TransactionList } from '../components/TransactionList';
import { VirtualNotice } from '../components/VirtualNotice';
import { Button, Panel, SectionTitle, Skeleton } from '../components/ui';
import { useSession } from '../lib/auth';
import { formatINR } from '../lib/format';
import { useGames, useRewards, useTransactions, useWallet } from '../lib/queries';

function WalletCard() {
  const wallet = useWallet();
  return (
    <Panel className="relative overflow-hidden p-5 md:p-6">
      <div aria-hidden className="absolute -left-16 -top-20 size-56 rounded-full bg-gold-400/10 blur-3xl" />
      <p className="relative text-sm font-medium text-muted">Virtual Balance</p>
      <p className="relative mt-1 font-display text-[40px] font-semibold leading-none md:text-5xl">
        {wallet.data ? <AnimatedAmount value={wallet.data.virtualBalance} /> : <Skeleton className="h-12 w-48" />}
      </p>
      <VirtualNotice variant="banner" className="relative mt-4 justify-start" />
      <div className="relative mt-4 grid grid-cols-2 gap-2">
        <Link to="/wallet">
          <Button variant="secondary" block tabIndex={-1}>
            <Wallet className="size-4" aria-hidden /> Wallet
          </Button>
        </Link>
        <Link to="/history">
          <Button variant="secondary" block tabIndex={-1}>
            <History className="size-4" aria-hidden /> History
          </Button>
        </Link>
      </div>
    </Panel>
  );
}

/** A different featured game each day. */
function featuredGame(games: GameConfig[]): GameConfig | undefined {
  const enabled = games.filter((g) => g.enabled);
  if (enabled.length === 0) return undefined;
  const day = Math.floor(Date.now() / 86_400_000);
  return enabled[day % enabled.length];
}

function FeaturedGame({ game }: { game: GameConfig }) {
  const meta = GAMES[game.id];
  return (
    <Link
      to={`/games/${game.id}`}
      className="group glass relative block overflow-hidden rounded-3xl transition hover:border-gold-400/40"
      aria-label={`Featured game: ${meta.name}. Play now`}
    >
      <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr]">
        <div className="aspect-[16/9] overflow-hidden md:order-2 md:aspect-auto md:h-full">
          <GameArt gameId={game.id} accent={meta.accent} className="transition-transform duration-500 group-hover:scale-[1.04]" />
        </div>
        <div className="flex flex-col justify-center p-5 md:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-300">Featured today</p>
          <h2 className="mt-2 text-2xl font-semibold md:text-[32px]">{meta.name}</h2>
          <p className="mt-1.5 text-muted">{meta.tagline}. Bets from {formatINR(game.minBet)}.</p>
          <span className="mt-5 inline-flex h-12 w-fit items-center gap-2 rounded-xl bg-gradient-to-b from-gold-300 to-gold-500 px-6 font-bold text-[#1a1204]">
            Play now <ArrowRight className="size-4" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}

function RecentActivity() {
  const txns = useTransactions('all', 6);
  const items = txns.data?.pages.flatMap((p) => p.items).slice(0, 6) ?? [];
  return (
    <Panel className="p-4 md:p-5">
      <SectionTitle
        action={
          <Link to="/wallet" className="text-sm font-semibold text-gold-300 hover:text-gold-200">
            View all
          </Link>
        }
      >
        Recent activity
      </SectionTitle>
      {txns.isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : txns.error ? (
        <ErrorState message="Couldn’t load your activity." onRetry={() => void txns.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title="No activity yet" message="Your virtual transactions will appear here." />
      ) : (
        <TransactionList items={items} />
      )}
    </Panel>
  );
}

export function HomePage() {
  const { user } = useSession();
  const games = useGames();
  const rewards = useRewards();
  const location = useLocation();
  const navigate = useNavigate();
  const [welcome, setWelcomeOpen] = useState(() => Boolean((location.state as { welcome?: boolean } | null)?.welcome));
  const setWelcome = (open: boolean) => {
    setWelcomeOpen(open);
    // Clear the one-time flag so a reload doesn't show the welcome again.
    if (!open) navigate('.', { replace: true, state: null });
  };
  const featured = games.data ? featuredGame(games.data) : undefined;

  return (
    <div className="space-y-5 md:space-y-7">
      <header>
        <p className="text-muted">Welcome back,</p>
        <h1 className="flex items-center gap-2 text-[26px] font-semibold leading-tight md:text-[32px] xl:text-[36px]">
          <span aria-hidden>{user?.avatar}</span> {user?.username}
        </h1>
      </header>

      <div className="grid grid-cols-1 gap-4 md:gap-5 lg:grid-cols-2">
        <WalletCard />
        <DailyRewardCard rewards={rewards.data} />
      </div>

      {featured ? <FeaturedGame game={featured} /> : <Skeleton className="h-56 rounded-3xl" />}

      <section aria-labelledby="games-heading">
        <SectionTitle
          id="games-heading"
          action={
            <Link to="/games" className="text-sm font-semibold text-gold-300 hover:text-gold-200">
              All games
            </Link>
          }
        >
          Games
        </SectionTitle>
        {games.error ? (
          <ErrorState message="Couldn’t load games." onRetry={() => void games.refetch()} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(games.data ?? []).slice(0, 4).map((g) => (
              <GameCard key={g.id} game={g} />
            ))}
            {!games.data && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <RecentActivity />
        {/* On phones, achievements live on the Rewards tab to keep Home light (PRD §7). */}
        <Panel className="hidden p-4 md:block md:p-5">
          <SectionTitle
            action={
              <Link to="/rewards" className="text-sm font-semibold text-gold-300 hover:text-gold-200">
                See all
              </Link>
            }
          >
            Achievements
          </SectionTitle>
          {rewards.data ? <AchievementGrid achievements={rewards.data.achievements} limit={4} className="sm:grid-cols-1 xl:grid-cols-1" /> : <Skeleton className="h-40" />}
        </Panel>
      </div>

      <Modal
        open={welcome}
        onClose={() => setWelcome(false)}
        title="Welcome to SimCasino!"
        footer={
          <Button block onClick={() => setWelcome(false)}>
            Start playing
          </Button>
        }
      >
        <p className="text-muted">
          We’ve added <strong className="text-fg">{formatINR(STARTING_BALANCE)}</strong> in virtual ₹ to your wallet.
        </p>
        <VirtualNotice variant="banner" className="my-4" />
        <ul className="list-disc space-y-1.5 pl-5 text-muted">
          <li>Virtual ₹ can’t be bought, withdrawn, transferred or exchanged for anything.</li>
          <li>Every result is decided on the server and saved in your game history.</li>
          <li>Claim a free daily reward and build a streak.</li>
        </ul>
      </Modal>
    </div>
  );
}
