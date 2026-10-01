import { Inbox, RotateCcw, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '../lib/format';
import { Button, Spinner } from './ui';

export function EmptyState({
  title,
  message,
  action,
  icon,
  className,
}: {
  title: string;
  message?: ReactNode;
  action?: { label: string; to: string };
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-white/[0.05] text-subtle">
        {icon ?? <Inbox className="size-7" aria-hidden />}
      </div>
      <p className="font-display text-lg font-semibold">{title}</p>
      {message && <p className="mt-1 max-w-sm text-muted">{message}</p>}
      {action && (
        <Link to={action.to} className="mt-5">
          <Button tabIndex={-1}>{action.label}</Button>
        </Link>
      )}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-loss/10 text-loss">
        <TriangleAlert className="size-7" aria-hidden />
      </div>
      <p className="font-display text-lg font-semibold">{title}</p>
      {message && <p className="mt-1 max-w-sm text-muted">{message}</p>}
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          <RotateCcw className="size-4" aria-hidden /> Try again
        </Button>
      )}
    </div>
  );
}

export function LoadingState({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-3 py-16 text-muted', className)}>
      <Spinner label={label} />
      <span>{label}</span>
    </div>
  );
}
