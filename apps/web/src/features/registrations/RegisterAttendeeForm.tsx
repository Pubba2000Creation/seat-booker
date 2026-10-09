import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import type { WorkshopResponse } from '@seat-booker/contracts';
import { useCreateRegistration } from './use-registrations';
import { Button } from '../../components/ui/Button';
import { TextField } from '../../components/ui/Field';
import { FormError } from '../../components/ui/States';
import { asApiError } from '../../lib/api-error';
import { isPast } from '../../lib/dates';

/**
 * The register-attendee form.
 *
 * Bookability is explained rather than merely blocked: a disabled button with no reason is
 * the kind of dead end that sends a staff member to the phone. The reason shown here is
 * derived from the workshop the server sent — and the server re-checks all of it anyway,
 * because this form can be stale by the time it is submitted.
 */

interface RegisterAttendeeFormProps {
  readonly workshop: WorkshopResponse;
}

/** Why registration is closed, or null when it is open. */
function closedReason(workshop: WorkshopResponse): string | null {
  if (workshop.status === 'DRAFT') {
    return 'This workshop is still a draft, so it is not open for registrations yet.';
  }
  if (workshop.status === 'CANCELLED') {
    return 'This workshop has been cancelled. Existing registrations are kept for the record, but no new ones can be taken.';
  }
  if (workshop.status === 'COMPLETED') {
    return 'This workshop has finished.';
  }
  if (isPast(workshop.startsAt)) {
    return 'This workshop has already started, so registrations are closed.';
  }
  if (workshop.isFull) {
    return `This workshop is full (${workshop.activeCount} of ${workshop.capacity} seats taken).`;
  }
  return null;
}

export function RegisterAttendeeForm({ workshop }: RegisterAttendeeFormProps): ReactElement {
  const [attendeeName, setAttendeeName] = useState('');
  const [attendeeEmail, setAttendeeEmail] = useState('');

  const mutation = useCreateRegistration(workshop.id);
  const reason = closedReason(workshop);

  const apiError = asApiError(mutation.error);
  const fieldErrors = apiError?.fieldErrors() ?? {};

  // ALREADY_REGISTERED names the attendee's email, so it belongs on that field rather
  // than in a toast.
  const emailError =
    apiError?.code === 'ALREADY_REGISTERED' ? apiError.message : fieldErrors['attendeeEmail'];

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    // The button is disabled while pending; this is the second guard, for an Enter key
    // repeat. The brief requires a double-click to produce exactly one registration.
    if (mutation.isPending) return;

    mutation.mutate(
      {
        attendeeName: attendeeName.trim(),
        // Lower-cased here as well as server-side so `A@x.com ` and `a@x.com` are visibly
        // the same person before submitting, not just after.
        attendeeEmail: attendeeEmail.trim().toLowerCase(),
      },
      {
        onSuccess: () => {
          // Cleared only on success, so a rejected submission keeps what was typed and
          // the staff member can correct one field instead of retyping both.
          setAttendeeName('');
          setAttendeeEmail('');
        },
      },
    );
  };

  if (reason !== null) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-sm font-medium text-slate-700">Registrations closed</p>
        <p className="mt-1 text-sm text-slate-600">{reason}</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3">
      <TextField
        label="Attendee name"
        name="attendeeName"
        placeholder="Full name"
        value={attendeeName}
        required
        maxLength={200}
        onChange={(event) => setAttendeeName(event.target.value)}
        error={fieldErrors['attendeeName']}
      />

      <TextField
        label="Attendee email"
        name="attendeeEmail"
        type="email"
        placeholder="name@example.com"
        value={attendeeEmail}
        required
        maxLength={254}
        onChange={(event) => setAttendeeEmail(event.target.value)}
        error={emailError}
        hint="Used to stop the same person being booked twice."
      />

      {/* Form-level failures only — field-level ones are already attached above. */}
      {apiError !== null &&
      apiError.code !== 'ALREADY_REGISTERED' &&
      apiError.code !== 'VALIDATION_ERROR' &&
      apiError.code !== 'WORKSHOP_FULL' &&
      apiError.code !== 'WORKSHOP_NOT_BOOKABLE' ? (
        <FormError error={mutation.error} />
      ) : null}

      <Button
        type="submit"
        isLoading={mutation.isPending}
        disabled={attendeeName.trim().length === 0 || attendeeEmail.trim().length === 0}
      >
        {mutation.isPending ? 'Registering…' : 'Register attendee'}
      </Button>

      <p className="text-xs text-slate-500">
        {workshop.seatsAvailable === 1
          ? 'Only 1 seat left — if someone else takes it first you will be told straight away.'
          : `${workshop.seatsAvailable} seats available.`}
      </p>
    </form>
  );
}
