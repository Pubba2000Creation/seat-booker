import { useState } from 'react';
import type { ReactElement } from 'react';
import type { RegistrationResponse, RegistrationStatusFilter } from '@seat-booker/contracts';
import { useCancelRegistration, useWorkshopRegistrations } from './use-registrations';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { TextField } from '../../components/ui/Field';
import { RegistrationStatusBadge } from '../../components/ui/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '../../components/ui/States';
import { formatDateTime } from '../../lib/dates';

/**
 * The attendee list and the history view — the same component with a different status
 * filter, because the brief wants both and they differ only in which rows they show and
 * whether the who/when-cancelled columns are worth the space.
 *
 * History is the part of the brief that answers "who cancelled this?", so `registeredBy`
 * and `cancelledBy` are shown with names, not ids.
 */

interface RegistrationListProps {
  readonly workshopId: string;
  readonly status: RegistrationStatusFilter;
  /** MANAGER and STAFF may both cancel; the column is hidden when nothing is cancellable. */
  readonly canCancel: boolean;
}

interface PendingCancel {
  readonly registration: RegistrationResponse;
}

export function RegistrationList({
  workshopId,
  status,
  canCancel,
}: RegistrationListProps): ReactElement {
  const query = useWorkshopRegistrations(workshopId, status);
  const cancelMutation = useCancelRegistration(workshopId);

  const [pending, setPending] = useState<PendingCancel | null>(null);
  const [reason, setReason] = useState('');

  const items = query.data?.items ?? [];
  const isHistory = status === 'ALL';

  const confirmCancel = (): void => {
    if (pending === null) return;

    cancelMutation.mutate(
      { registrationId: pending.registration.id, reason },
      {
        // Closed on settle rather than on success: an ALREADY_CANCELLED result is also
        // final for this dialog — the row is cancelled, just not by this click.
        onSettled: () => {
          setPending(null);
          setReason('');
        },
      },
    );
  };

  if (query.isLoading) {
    return <LoadingState label="Loading registrations…" />;
  }

  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        onRetry={() => void query.refetch()}
        isRetrying={query.isFetching}
      />
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title={isHistory ? 'No registrations yet' : 'No one is registered yet'}
        description={
          isHistory
            ? 'Registrations and cancellations will appear here as they happen.'
            : 'Use the form to register the first attendee.'
        }
      />
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <th scope="col" className="px-5 py-2.5">
                Attendee
              </th>
              <th scope="col" className="px-5 py-2.5">
                Status
              </th>
              <th scope="col" className="px-5 py-2.5">
                Registered
              </th>
              {isHistory ? (
                <th scope="col" className="px-5 py-2.5">
                  Cancelled
                </th>
              ) : null}
              {canCancel ? (
                <th scope="col" className="px-5 py-2.5 text-right">
                  <span className="sr-only">Actions</span>
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {items.map((registration) => (
              <tr key={registration.id} className="border-b border-slate-100">
                <td className="px-5 py-3">
                  <p className="font-medium text-slate-900">{registration.attendeeName}</p>
                  <p className="text-xs text-slate-500">{registration.attendeeEmail}</p>
                </td>
                <td className="px-5 py-3">
                  <RegistrationStatusBadge status={registration.status} />
                </td>
                <td className="px-5 py-3 text-xs text-slate-600">
                  <p>{formatDateTime(registration.registeredAt)}</p>
                  <p className="text-slate-500">
                    by {registration.registeredBy?.name ?? 'Unknown'}
                  </p>
                </td>
                {isHistory ? (
                  <td className="px-5 py-3 text-xs text-slate-600">
                    {registration.cancelledAt !== null ? (
                      <>
                        <p>{formatDateTime(registration.cancelledAt)}</p>
                        <p className="text-slate-500">
                          by {registration.cancelledBy?.name ?? 'Unknown'}
                        </p>
                        {registration.cancelReason !== null ? (
                          <p className="mt-0.5 italic text-slate-500">
                            “{registration.cancelReason}”
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                ) : null}
                {canCancel ? (
                  <td className="px-5 py-3 text-right">
                    {registration.status === 'ACTIVE' ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setPending({ registration });
                          setReason('');
                        }}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        isOpen={pending !== null}
        title="Cancel this registration?"
        confirmLabel="Yes, cancel registration"
        cancelLabel="Keep registration"
        isPending={cancelMutation.isPending}
        onConfirm={confirmCancel}
        onClose={() => {
          setPending(null);
          setReason('');
        }}
      >
        {/* Naming the attendee is the point of the dialog — it is the last chance to
            notice the wrong row was clicked. */}
        <p>
          <span className="font-medium text-slate-900">{pending?.registration.attendeeName}</span>{' '}
          will lose their seat, and it will be offered to someone else. The registration stays in
          the history.
        </p>
        <div className="mt-3">
          <TextField
            label="Reason (optional)"
            placeholder="e.g. Called to say they cannot attend"
            value={reason}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
      </ConfirmDialog>
    </>
  );
}
