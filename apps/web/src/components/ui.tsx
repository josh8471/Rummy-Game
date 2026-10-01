import { LoaderCircle } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/format';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-gradient-to-b from-gold-300 to-gold-500 text-[#1a1204] shadow-[0_8px_24px_-10px_rgb(247_201_72/0.7),inset_0_1px_0_rgb(255_255_255/0.5)] hover:from-gold-200 hover:to-gold-400 disabled:from-ink-600 disabled:to-ink-600 disabled:text-subtle disabled:shadow-none',
  secondary: 'bg-white/[0.06] text-fg border border-white/10 hover:bg-white/[0.1] disabled:text-subtle disabled:bg-white/[0.03]',
  ghost: 'text-muted hover:text-fg hover:bg-white/[0.06] disabled:text-subtle',
  danger: 'bg-loss/15 text-loss border border-loss/30 hover:bg-loss/25 disabled:opacity-50',
  success: 'bg-win/15 text-win border border-win/30 hover:bg-win/25 disabled:opacity-50',
};

const SIZES: Record<ButtonSize, string> = {
  // "md" and up meet the 44px minimum touch target.
  sm: 'h-9 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-11 px-4 text-[15px] gap-2 rounded-xl',
  lg: 'h-12 px-6 text-base gap-2 rounded-xl',
  xl: 'h-14 px-8 text-base sm:text-lg gap-2.5 rounded-2xl tracking-wide',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, block, className, children, disabled, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex select-none items-center justify-center font-semibold transition-[background,color,transform,box-shadow] duration-150 active:scale-[0.98] disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

export function IconButton({
  label,
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted transition-colors hover:bg-white/[0.07] hover:text-fg disabled:opacity-40',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Panel({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('glass rounded-2xl', className)} {...props}>
      {children}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3 md:mb-7">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold leading-tight md:text-[32px] xl:text-[36px]">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ children, action, id }: { children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="text-lg font-semibold md:text-[22px]">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-muted">
      <LoaderCircle className="size-5 animate-spin" aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** A <span> (display:block) so it is valid inside paragraphs and headings too. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn('block animate-pulse rounded-xl bg-white/[0.05]', className)} />;
}

export function StatTile({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <Panel className="p-4">
      <div className="flex items-center gap-2 text-sm text-muted">
        {icon}
        <span>{label}</span>
      </div>
      <div className="tabular mt-1.5 font-display text-2xl font-semibold md:text-[26px]">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-subtle">{hint}</div>}
    </Panel>
  );
}

export function ProgressBar({ value, max, label, className }: { value: number; max: number; label: string; className?: string }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn('h-2 overflow-hidden rounded-full bg-white/[0.08]', className)}
    >
      <div className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300 transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string | null;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-muted">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-subtle">{hint}</p>}
      {error && (
        <p id={`${htmlFor}-error`} className="mt-1 text-sm text-loss" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  'h-11 w-full rounded-xl border border-white/10 bg-ink-900/80 px-3.5 text-[15px] text-fg placeholder:text-subtle transition-colors focus:border-gold-400/70 focus:outline-none focus-visible:outline-2 focus-visible:outline-gold-400 aria-[invalid=true]:border-loss/70';
