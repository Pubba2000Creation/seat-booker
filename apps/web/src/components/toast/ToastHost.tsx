import type { ReactElement } from 'react';
import { useToast } from './toast-context';
import type { ToastTone } from './toast-context';

const TONE_STYLES: Readonly<Record<ToastTone, string>> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  error: 'border-rose-200 bg-rose-50 text-rose-900',
  info: 'border-sky-200 bg-sky-50 text-sky-900',
};

const TONE_ICONS: Readonly<Record<ToastTone, string>> = {
  success: '✓',
  error: '!',
  info: 'i',
};

/**
 * Renders the toast stack. Mounted once near the router root.
 *
 * `aria-live="polite"` means a screen reader announces a toast without interrupting — which
 * matters for the "last seat was just taken" message, the one toast in this app that
 * carries information the user cannot get any other way.
 */
export function ToastHost(): ReactElement {
  const { toasts, dismissToast } = useToast();

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 top-4 z-50 flex flex-col items-center gap-2 px-4"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.tone === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border px-4 py-3 shadow-lg ${TONE_STYLES[toast.tone]}`}
        >
          <span
            aria-hidden="true"
            className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/70 text-xs font-bold"
          >
            {TONE_ICONS[toast.tone]}
          </span>
          <p className="flex-1 text-sm font-medium">{toast.message}</p>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            className="shrink-0 rounded px-1 text-lg leading-none opacity-60 transition hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
            aria-label="Dismiss notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
