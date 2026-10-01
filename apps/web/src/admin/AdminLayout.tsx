import {
  ArrowLeft,
  Gamepad2,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router';
import { LogoMark } from '../components/Logo';
import { VirtualNotice } from '../components/VirtualNotice';
import { cn } from '../lib/format';

const NAV: { to: string; label: string; short: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/admin', label: 'Overview', short: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/players', label: 'Players', short: 'Players', icon: Users },
  { to: '/admin/profiles', label: 'Probability profiles', short: 'Profiles', icon: SlidersHorizontal },
  { to: '/admin/games', label: 'Game configuration', short: 'Games', icon: Gamepad2 },
  { to: '/admin/audit', label: 'Audit log', short: 'Audit', icon: ScrollText },
  { to: '/admin/security', label: 'Security events', short: 'Security', icon: ShieldAlert },
];

/**
 * Desktop: sidebar. Tablet: collapsible icon rail. Mobile: top bar + bottom
 * navigation (PRD §21).
 */
export function AdminLayout() {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className={cn('min-h-dvh md:pl-[76px] lg:pl-[248px]')}>
      <a href="#admin-main" className="sr-only z-50 rounded-lg bg-gold-400 px-4 py-2 font-semibold text-ink-950 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <aside
        aria-label="Admin navigation"
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-white/[0.06] bg-ink-900/95 px-3 py-4 backdrop-blur-xl transition-[width] md:flex lg:w-[248px] lg:px-4',
          expanded ? 'w-[248px] shadow-2xl' : 'w-[76px]',
        )}
      >
        <div className={cn('mb-6 flex items-center gap-2.5', expanded ? 'px-1' : 'justify-center lg:justify-start lg:px-1')}>
          <LogoMark />
          <span className={cn('leading-tight', expanded ? '' : 'hidden lg:block')}>
            <span className="block font-display text-[17px] font-semibold">
              Sim<span className="gold-text">Casino</span>
            </span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-subtle">Admin</span>
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={label}
              onClick={() => setExpanded(false)}
              className={({ isActive }) =>
                cn(
                  'flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors',
                  expanded ? '' : 'justify-center lg:justify-start',
                  isActive ? 'bg-gold-400/12 text-gold-200' : 'text-muted hover:bg-white/[0.05] hover:text-fg',
                )
              }
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className={expanded ? '' : 'sr-only lg:not-sr-only'}>{label}</span>
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
          aria-expanded={expanded}
          className="mb-1 flex h-11 items-center justify-center rounded-xl text-muted hover:bg-white/[0.05] hover:text-fg lg:hidden"
        >
          {expanded ? <PanelLeftClose className="size-5" aria-hidden /> : <PanelLeftOpen className="size-5" aria-hidden />}
        </button>
        <Link
          to="/"
          title="Back to casino"
          className={cn('flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium text-muted hover:bg-white/[0.05] hover:text-fg', expanded ? '' : 'justify-center lg:justify-start')}
        >
          <ArrowLeft className="size-5 shrink-0" aria-hidden />
          <span className={expanded ? '' : 'sr-only lg:not-sr-only'}>Back to casino</span>
        </Link>
      </aside>

      {/* Mobile / tablet top bar */}
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-ink-950/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-3 px-4 md:px-6 xl:px-10">
          <div className="flex items-center gap-2.5 md:hidden">
            <LogoMark className="size-8" />
            <span className="leading-tight">
              <span className="block font-display font-semibold">Admin</span>
              <VirtualNotice variant="inline" className="text-[10px]" />
            </span>
          </div>
          <span className="hidden md:block">
            <VirtualNotice />
          </span>
          <Link to="/" className="inline-flex h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-white/[0.05] hover:text-fg md:hidden">
            <ArrowLeft className="size-4" aria-hidden /> Casino
          </Link>
        </div>
      </header>

      <main id="admin-main" className="mx-auto w-full max-w-[1400px] px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-4 md:px-6 md:pb-12 md:pt-6 xl:px-10">
        <Outlet />
      </main>

      <nav aria-label="Admin navigation" className="fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.07] bg-ink-900/95 pb-safe backdrop-blur-xl md:hidden">
        <ul className="grid h-16 grid-cols-5">
          {NAV.slice(0, 5).map(({ to, short, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn('flex h-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold', isActive ? 'text-gold-300' : 'text-subtle hover:text-fg')
                }
              >
                <Icon className="size-5" aria-hidden />
                {short}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
