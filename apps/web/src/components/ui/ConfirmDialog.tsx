import { useEffect, useRef } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { Button } from './Button';

/**
 * Modal confirmation. Used for cancelling a registration, which the brief requires to be
 * confirmed — and the confirmation names the attendee, so "cancel" can never be clicked on
 * the wrong row without the name being visible first.
 *
 * Built on the native `<dialog>` element so focus trapping, Escape-to-close and the
 * backdrop come from the platform rather than from hand-written key handlers.
 */

interface ConfirmDialogProps {
  readonly isOpen: boolean;
  readonly title: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
  readonly tone?: 'danger' | 'primary';
  readonly isPending?: boolean;
  readonly onConfirm: () => void;
  readonly onClose: () => void;
  readonly children: ReactNode;
}

export function ConfirmDialog({
  isOpen,
  title,
  confirmLabel,
  cancelLabel = 'Go back',
  tone = 'danger',
  isPending = false,
  onConfirm,
  onClose,
  children,
}: ConfirmDialogProps): ReactElement | null {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  // Escape closes the native dialog directly, bypassing React — so the parent's state is
  // synced back here rather than being left thinking the dialog is still open. Closing
  // mid-request is ignored: the mutation is already in flight and must be allowed to land.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (event: Event): void => {
      event.preventDefault();
      if (!isPending) onClose();
    };

    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose, isPending]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirm-dialog-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-900/40"
    >
      <div className="px-5 py-4">
        <h2 id="confirm-dialog-title" className="text-base font-semibold text-slate-900">
          {title}
        </h2>
        <div className="mt-2 text-sm text-slate-600">{children}</div>
      </div>
      <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
        <Button variant="secondary" onClick={onClose} disabled={isPending}>
          {cancelLabel}
        </Button>
        <Button variant={tone} onClick={onConfirm} isLoading={isPending}>
          {confirmLabel}
        </Button>
      </footer>
    </dialog>
  );
}
