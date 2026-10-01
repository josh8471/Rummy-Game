import { AVATARS, loginSchema, registerSchema, STARTING_BALANCE, type MeResponse } from '@casino/shared';
import { useMutation } from '@tanstack/react-query';
import { Ban, Gamepad2, ShieldCheck, Sparkles } from 'lucide-react';
import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Logo } from '../components/Logo';
import { VirtualNotice } from '../components/VirtualNotice';
import { Button, Field, inputClass } from '../components/ui';
import { api, errorMessage } from '../lib/api';
import { setSession, useSession } from '../lib/auth';
import { cn, formatINR } from '../lib/format';

function AuthLayout({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-white/[0.06] bg-ink-900 p-12 lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute -right-24 -top-24 size-[28rem] rounded-full bg-gold-400/10 blur-3xl" />
        <Logo />
        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-tight">
            A polished casino floor — <span className="gold-text">with none of the real money.</span>
          </h2>
          <ul className="mt-8 space-y-4 text-muted">
            <li className="flex gap-3">
              <Gamepad2 className="mt-0.5 size-5 shrink-0 text-gold-300" aria-hidden />
              Seven simulated games: Slots, Roulette, Blackjack, Teen Patti, Andar Bahar, Dice and Poker.
            </li>
            <li className="flex gap-3">
              <ShieldCheck className="mt-0.5 size-5 shrink-0 text-gold-300" aria-hidden />
              Every result is decided on the server and recorded in your history.
            </li>
            <li className="flex gap-3">
              <Ban className="mt-0.5 size-5 shrink-0 text-gold-300" aria-hidden />
              No deposits, no withdrawals, no cash-out, no transfers. Ever.
            </li>
          </ul>
        </div>
        <VirtualNotice variant="banner" className="relative max-w-md" />
      </aside>
      <main className="flex flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[420px]">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-[28px] font-semibold leading-tight md:text-[32px]">{title}</h1>
          <p className="mt-1.5 text-muted">{subtitle}</p>
          <VirtualNotice variant="banner" className="mt-5 lg:hidden" />
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}

function fieldErrors(schema: typeof loginSchema | typeof registerSchema, values: unknown): Record<string, string> {
  const parsed = schema.safeParse(values);
  if (parsed.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? 'form');
    errors[key] ??= issue.message;
  }
  return errors;
}

/**
 * After sign-in, go back to the page the player originally asked for (only
 * same-site paths are accepted). `handled` stops the "already signed in"
 * redirect from racing this navigation.
 */
function useAfterAuth() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const handled = useRef(false);
  const next = params.get('next');
  const target = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  const afterAuth = (session: MeResponse, welcome = false) => {
    handled.current = true;
    setSession(session);
    navigate(target, { replace: true, state: welcome ? { welcome: true } : undefined });
  };
  return { afterAuth, target, handled };
}

export function LoginPage() {
  const { user } = useSession();
  const location = useLocation();
  const flash = (location.state as { message?: string } | null)?.message;
  const { afterAuth, target, handled } = useAfterAuth();
  const [values, setValues] = useState({ username: '', password: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const login = useMutation({
    mutationFn: (body: typeof values) => api.post<MeResponse>('/api/auth/login', body),
    onSuccess: (session) => afterAuth(session),
  });

  if (user) return handled.current ? null : <Navigate to={target} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found = fieldErrors(loginSchema, values);
    setErrors(found);
    if (Object.keys(found).length === 0) login.mutate(values);
  };

  const fillDemo = (username: string, password: string) => setValues({ username, password });

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your virtual ₹ wallet.">
      {flash && (
        <p role="status" className="mb-4 rounded-xl border border-win/30 bg-win/10 px-3.5 py-2.5 text-sm text-win">
          {flash}
        </p>
      )}
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Username or email" htmlFor="username" error={errors.username}>
          <input
            id="username"
            autoComplete="username"
            className={inputClass}
            value={values.username}
            aria-invalid={!!errors.username}
            onChange={(e) => setValues({ ...values, username: e.target.value })}
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password}>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className={inputClass}
            value={values.password}
            aria-invalid={!!errors.password}
            onChange={(e) => setValues({ ...values, password: e.target.value })}
          />
        </Field>
        {login.error && (
          <p role="alert" className="rounded-xl border border-loss/30 bg-loss/10 px-3.5 py-2.5 text-sm text-loss">
            {errorMessage(login.error)}
          </p>
        )}
        <Button type="submit" size="lg" block loading={login.isPending}>
          {login.isPending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
      <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        <p className="text-sm font-semibold">Demo accounts</p>
        <p className="mt-0.5 text-sm text-muted">Tap to fill in, then sign in.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" size="md" onClick={() => fillDemo('demo_player_001', 'demo1234')}>
            Player
          </Button>
          <Button variant="secondary" size="md" onClick={() => fillDemo('admin_001', 'admin1234')}>
            Admin
          </Button>
        </div>
      </div>
      <p className="mt-6 text-center text-muted">
        New here?{' '}
        <Link to="/register" className="font-semibold text-gold-300 hover:text-gold-200">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}

export function RegisterPage() {
  const { user } = useSession();
  const { afterAuth, target, handled } = useAfterAuth();
  const [values, setValues] = useState({ username: '', email: '', password: '', avatar: AVATARS[0] as string });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [agreed, setAgreed] = useState(false);
  const register = useMutation({
    mutationFn: (body: typeof values) => api.post<MeResponse>('/api/auth/register', body),
    onSuccess: (session) => afterAuth(session, true),
  });

  if (user) return handled.current ? null : <Navigate to={target} replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found = fieldErrors(registerSchema, values);
    if (!agreed) found.agree = 'Please confirm you understand the currency is virtual.';
    setErrors(found);
    if (Object.keys(found).length === 0) register.mutate(values);
  };

  return (
    <AuthLayout title="Create your account" subtitle={`Start with ${formatINR(STARTING_BALANCE)} in virtual ₹ — free, and never real money.`}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-muted">Choose an avatar</legend>
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((avatar) => (
              <label
                key={avatar}
                className={cn(
                  'flex size-11 items-center justify-center rounded-xl border text-xl transition has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-gold-400',
                  values.avatar === avatar ? 'border-gold-400/70 bg-gold-400/15' : 'border-white/10 bg-white/[0.04]',
                )}
              >
                <input
                  type="radio"
                  name="avatar"
                  value={avatar}
                  className="sr-only"
                  checked={values.avatar === avatar}
                  onChange={() => setValues({ ...values, avatar })}
                />
                <span aria-hidden>{avatar}</span>
                <span className="sr-only">Avatar {avatar}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <Field label="Username" htmlFor="username" error={errors.username} hint="3–20 letters, numbers or underscores.">
          <input
            id="username"
            autoComplete="username"
            className={inputClass}
            value={values.username}
            aria-invalid={!!errors.username}
            onChange={(e) => setValues({ ...values, username: e.target.value })}
          />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className={inputClass}
            value={values.email}
            aria-invalid={!!errors.email}
            onChange={(e) => setValues({ ...values, email: e.target.value })}
          />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password} hint="At least 8 characters.">
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className={inputClass}
            value={values.password}
            aria-invalid={!!errors.password}
            onChange={(e) => setValues({ ...values, password: e.target.value })}
          />
        </Field>
        <div>
          <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5 text-sm">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-[#f7c948]"
            />
            <span>
              I understand that all ₹ in SimCasino is <strong>virtual</strong>, has <strong>no cash value</strong>, and can’t be deposited,
              withdrawn, transferred or redeemed.
            </span>
          </label>
          {errors.agree && (
            <p role="alert" className="mt-1 text-sm text-loss">
              {errors.agree}
            </p>
          )}
        </div>
        {register.error && (
          <p role="alert" className="rounded-xl border border-loss/30 bg-loss/10 px-3.5 py-2.5 text-sm text-loss">
            {errorMessage(register.error)}
          </p>
        )}
        <Button type="submit" size="lg" block loading={register.isPending}>
          <Sparkles className="size-4" aria-hidden /> Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-muted">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-gold-300 hover:text-gold-200">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
