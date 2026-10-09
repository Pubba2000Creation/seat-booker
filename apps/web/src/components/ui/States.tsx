import type { ReactElement, ReactNode } from 'react';
import { errorMessage } from '../../lib/api-error';
import { Button } from './Button';

/**
 * Loading, empty and error states.
 *
 * Every list in this app renders one of these rather than a blank area — the brief asks
 * for real loading and empty states, and a staff member who sees nothing cannot tell
 * "no workshops this week" from "it is still loading" or "the server is down".
 */

export function Spinner({ className = '' }: { readonly className?: string }): ReactElement {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700 ${className}`}
    />
  );
}

export function LoadingState({ label = 'Loading…' }: { readonly label?: string }): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-slate-500">
      <Spinner />
      <p className="text-sm">{label}</p>
    </div>
  );
}

interface EmptyStateProps {
  readonly title: string;
  readonly description?: string | undefined;
  readonly action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps): ReactElement {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      {description !== undefined ? (
        <p className="max-w-sm text-sm text-slate-500">{description}</p>
      ) : null}
      {action !== undefined ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

interface ErrorStateProps {
  readonly error: unknown;
  readonly onRetry?: (() => void) | undefined;
  readonly isRetrying?: boolean;
}

export function ErrorState({ error, onRetry, isRetrying = false }: ErrorStateProps): ReactElement {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center"
    >
      <p className="text-sm font-semibold text-rose-700">Could not load this</p>
      {/* `errorMessage` guarantees a plain-English sentence — never raw JSON or SQL. */}
      <p className="max-w-sm text-sm text-slate-600">{errorMessage(error)}</p>
      {onRetry !== undefined ? (
        <Button variant="secondary" size="sm" onClick={onRetry} isLoading={isRetrying}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** Inline form-level error, for a failure that belongs above the submit button. */
export function FormError({ error }: { readonly error: unknown }): ReactElement | null {
  if (error === null || error === undefined) return null;

  return (
    <p
      role="alert"
      className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
    >
      {errorMessage(error)}
    </p>
  );
}
