import {
  CircleHelp,
  Gamepad2,
  Gift,
  History,
  House,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Trophy,
  User,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useLogout, useSession } from '../lib/auth';
import { cn } from '../lib/format';
import { useWallet } from '../lib/queries';
import { AnimatedAmount } from './Amount';
import { BreakReminder } from './BreakReminder';
import { Logo, LogoMark } from './Logo';
import { Modal } from './Modal';
import { VirtualNotice } from './VirtualNotice';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const PRIMARY: NavItem[] = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/games', label: 'Games', icon: Gamepad2 },
  { to: '/wallet', label: 'Wallet', icon: Wallet },
  { to: '/rewards', label: 'Rewards', icon: Gift },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/profile', label: 'Profile', icon: User },
];

const SECONDARY: NavItem[] = [
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/help', label: 'Help', icon: CircleHelp },
];

/** Mobile bottom navigation (PRD §6). */
const BOTTOM: NavItem[] = PRIMARY.filter((i) => i.to !== '/leaderboard');

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      title={item.label}
      className={({ isActive }) =>
        cn(
          'group relative flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors md:justify-center xl:justify-start',
          isActive ? 'bg-gold-400/12 text-gold-200' : 'text-muted hover:bg-white/[0.05] hover:text-fg',
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && <span className="absolute -left-3 top-2 h-7 w-1 rounded-r-full bg-gold-400" aria-hidden />}
          <Icon className="size-5 shrink-0" aria-hidden />
          <span className="md:sr-only xl:not-sr-only">{item.label}</span>
        </>
      )}
    </NavLink>
  );
}

function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const logout = useLogout();
  return (
    <aside
      aria-label="Main navigation"
      className="fixed inset-y-0 left-0 z-30 hidden w-[76px] flex-col border-r border-white/[0.06] bg-ink-900/85 px-3 py-4 backdrop-blur-xl md:flex xl:w-[248px] xl:px-4"
    >
      <Link to="/" className="mb-6 flex items-center justify-center rounded-xl xl:justify-start xl:px-1" aria-label="SimCasino home">
        <span className="xl:hidden">
          <LogoMark />
        </span>
        <span className="hidden xl:inline-flex">
          <Logo />
        </span>
      </Link>
      <nav className="flex flex-1 flex-col gap-1">
        {PRIMARY.map((item) => (
          <SidebarLink key={item.to} item={item} />
        ))}
        <div className="my-3 border-t border-white/[0.07]" role="separator" />
        {SECONDARY.map((item) => (
          <SidebarLink key={item.to} item={item} />
        ))}
        {isAdmin && <SidebarLink item={{ to: '/admin', label: 'Admin', icon: ShieldCheck }} />}
      </nav>
      <button
        type="button"
        onClick={() => void logout()}
        title="Sign out"
        className="flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-muted transition-colors hover:bg-white/[0.05] hover:text-fg md:justify-center xl:justify-start"
      >
        <LogOut className="size-5 shrink-0" aria-hidden />
        <span className="md:sr-only xl:not-sr-only">Sign out</span>
      </button>
    </aside>
  );
}

function BalanceLink({ compact }: { compact?: boolean }) {
  const wallet = useWallet();
  const balance = wallet.data?.virtualBalance;
  return (
    <Link
      to="/wallet"
      aria-label={balance === undefined ? 'Virtual wallet' : `Virtual balance, open wallet`}
      className={cn('flex min-w-0 flex-col rounded-xl', compact ? '' : 'items-end px-3 py-1 hover:bg-white/[0.04]')}
    >
      <span className={cn('font-display font-semibold leading-tight text-fg', compact ? 'text-[22px]' : 'text-xl')}>
        {balance === undefined ? '₹—' : <AnimatedAmount value={balance} />}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-gold-300/90">Virtual ₹ • No cash</span>
    </Link>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { user } = useSession();
  return (
    <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-3 px-4 md:px-6 xl:px-10">
        {/* Mobile: compact wallet header (PRD §5). */}
        <div className="flex min-w-0 items-center gap-3 md:hidden">
          <LogoMark className="size-8" />
          <BalanceLink compact />
        </div>
        <div className="hidden md:block">
          <VirtualNotice />
        </div>
        <div className="flex items-center gap-1">
          <div className="hidden md:block">
            <BalanceLink />
          </div>
          <Link
            to="/profile"
            aria-label="Your profile"
            className="hidden size-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-xl md:inline-flex"
          >
            <span aria-hidden>{user?.avatar ?? '🦚'}</span>
          </Link>
          <button
            type="button"
            onClick={onMenu}
            aria-label="Open menu"
            className="inline-flex size-11 items-center justify-center rounded-xl text-muted hover:bg-white/[0.06] hover:text-fg md:hidden"
          >
            <Menu className="size-6" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}

function BottomNav() {
  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.07] bg-ink-900/92 pb-safe backdrop-blur-xl md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-md grid-cols-5">
        {BOTTOM.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors',
                  isActive ? 'text-gold-300' : 'text-subtle hover:text-fg',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn('flex h-7 w-12 items-center justify-center rounded-full transition-colors', isActive && 'bg-gold-400/15')}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  {label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function MoreMenu({ open, onClose, isAdmin }: { open: boolean; onClose: () => void; isAdmin: boolean }) {
  const logout = useLogout();
  const items: NavItem[] = [
    { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
    { to: '/history', label: 'Game history', icon: History },
    ...SECONDARY,
    ...(isAdmin ? [{ to: '/admin', label: 'Admin dashboard', icon: ShieldCheck }] : []),
  ];
  return (
    <Modal open={open} onClose={onClose} title="Menu" description={<VirtualNotice variant="inline" />}>
      <ul className="-mx-2 space-y-1">
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <Link to={to} onClick={onClose} className="flex h-12 items-center gap-3 rounded-xl px-3 font-medium hover:bg-white/[0.05]">
              <Icon className="size-5 text-muted" aria-hidden /> {label}
            </Link>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => {
              onClose();
              void logout();
            }}
            className="flex h-12 w-full items-center gap-3 rounded-xl px-3 font-medium text-loss hover:bg-loss/10"
          >
            <LogOut className="size-5" aria-hidden /> Sign out
          </button>
        </li>
      </ul>
    </Modal>
  );
}

export function AppShell() {
  const { user } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-dvh md:pl-[76px] xl:pl-[248px]">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-gold-400 px-4 py-2 font-semibold text-ink-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <Sidebar isAdmin={isAdmin} />
      <TopBar onMenu={() => setMenuOpen(true)} />
      <main
        id="main"
        key={location.pathname.startsWith('/games/') ? 'game' : location.pathname}
        className="mx-auto w-full max-w-[1400px] animate-fade-up px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-4 md:px-6 md:pb-12 md:pt-6 xl:px-10"
      >
        <Outlet />
      </main>
      <BottomNav />
      <MoreMenu open={menuOpen} onClose={() => setMenuOpen(false)} isAdmin={isAdmin} />
      <BreakReminder />
    </div>
  );
}
