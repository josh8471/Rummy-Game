import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '../lib/format';

/**
 * Accessible modal on the native <dialog> element (focus trap, Esc to close).
 * Desktop: centred, 480–600px wide. Mobile: bottom sheet, full width, max 90vh.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', onCancel);
    return () => dialog.removeEventListener('cancel', onCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        'm-0 mt-auto max-h-[90vh] w-full max-w-none overflow-hidden rounded-t-3xl border border-white/10 bg-ink-850 p-0 text-fg shadow-2xl backdrop:bg-transparent',
        'open:flex open:animate-sheet open:flex-col',
        'sm:m-auto sm:max-h-[85vh] sm:rounded-3xl sm:open:animate-pop',
        size === 'md' ? 'sm:w-[520px]' : 'sm:w-[600px]',
      )}
    >
      {open && (
        <>
          <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] px-5 pb-3 pt-4 sm:px-6 sm:pt-5">
            <div className="min-w-0">
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-white/20 sm:hidden" aria-hidden />
              <h2 id={titleId} className="text-lg font-semibold sm:text-xl">
                {title}
              </h2>
              {description && <div className="mt-0.5 text-sm text-muted">{description}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-white/[0.07] hover:text-fg"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
          {footer && <div className="border-t border-white/[0.07] px-5 py-3 pb-safe sm:px-6 sm:py-4">{footer}</div>}
        </>
      )}
    </dialog>
  );
}
