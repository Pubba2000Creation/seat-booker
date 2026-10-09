import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { WORKSHOP_LOCATIONS, WORKSHOP_STATUSES } from '@seat-booker/contracts';
import type {
  CreateWorkshopRequest,
  UpdateWorkshopRequest,
  WorkshopLocation,
  WorkshopResponse,
  WorkshopStatus,
} from '@seat-booker/contracts';
import {
  useCreateWorkshop,
  useUpdateWorkshop,
  useWorkshop,
} from '../features/workshops/use-workshops';
import { useToast } from '../components/toast/toast-context';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SelectField, TextAreaField, TextField } from '../components/ui/Field';
import { ErrorState, FormError, LoadingState } from '../components/ui/States';
import { asApiError } from '../lib/api-error';
import { centreLocalToUtcIso, utcIsoToCentreLocal } from '../lib/dates';
import { NotFoundPage } from './NotFoundPage';

/**
 * Create and edit a workshop (MANAGER only).
 *
 * One component serves both: the fields are identical, and the only real differences are
 * the initial values and which mutation runs. Splitting them would duplicate the whole
 * form — and the validation with it.
 *
 * Datetime inputs are wall-clock in the centre's timezone and converted to UTC on submit,
 * so a manager types the time the workshop actually starts rather than doing timezone
 * arithmetic in their head.
 */

interface FormState {
  code: string;
  title: string;
  instructor: string;
  startsAt: string;
  endsAt: string;
  capacity: string;
  status: WorkshopStatus;
  location: WorkshopLocation;
  description: string;
}

const EMPTY_FORM: FormState = {
  code: '',
  title: '',
  instructor: '',
  startsAt: '',
  endsAt: '',
  capacity: '20',
  status: 'DRAFT',
  location: 'COLOMBO',
  description: '',
};

const STATUS_LABELS: Readonly<Record<WorkshopStatus, string>> = {
  DRAFT: 'Draft — not bookable yet',
  OPEN: 'Open — bookable',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
};

const LOCATION_LABELS: Readonly<Record<WorkshopLocation, string>> = {
  COLOMBO: 'Colombo',
  KALUTARA: 'Kalutara',
  GALLE: 'Galle',
};

function toFormState(workshop: WorkshopResponse): FormState {
  return {
    code: workshop.code,
    title: workshop.title,
    instructor: workshop.instructor,
    startsAt: utcIsoToCentreLocal(workshop.startsAt),
    endsAt: utcIsoToCentreLocal(workshop.endsAt),
    capacity: String(workshop.capacity),
    status: workshop.status,
    location: workshop.location,
    description: workshop.description ?? '',
  };
}

/**
 * Client-side checks that mirror the API's DTO rules. They exist to give immediate
 * feedback, not to be the enforcement point — the API validates everything again, and its
 * answer is the one that counts.
 */
function validate(form: FormState, isEdit: boolean): Readonly<Record<string, string>> {
  const errors: Record<string, string> = {};

  if (form.code.trim().length === 0) errors['code'] = 'Give the workshop a code.';
  if (form.title.trim().length === 0) errors['title'] = 'Give the workshop a title.';
  if (form.instructor.trim().length === 0) errors['instructor'] = 'Name the instructor.';
  if (form.startsAt.length === 0) errors['startsAt'] = 'Choose a start date and time.';
  if (form.endsAt.length === 0) errors['endsAt'] = 'Choose an end date and time.';

  const capacity = Number(form.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) {
    errors['capacity'] = 'Capacity must be a whole number between 1 and 1000.';
  }

  if (form.startsAt.length > 0 && form.endsAt.length > 0) {
    const starts = centreLocalToUtcIso(form.startsAt);
    const ends = centreLocalToUtcIso(form.endsAt);

    if (starts !== null && ends !== null) {
      if (new Date(ends).getTime() <= new Date(starts).getTime()) {
        errors['endsAt'] = 'The end time must be after the start time.';
      }
      // Only a NEW workshop may not start in the past — an existing one can be edited
      // after it has begun (to mark it completed, for instance).
      if (!isEdit && new Date(starts).getTime() < Date.now()) {
        errors['startsAt'] = 'A new workshop cannot start in the past.';
      }
    }
  }

  return errors;
}

export function WorkshopFormPage(): ReactElement {
  const { workshopId } = useParams<{ workshopId: string }>();
  const isEdit = workshopId !== undefined;
  const navigate = useNavigate();
  const { showToast } = useToast();

  const existing = useWorkshop(isEdit ? workshopId : '');
  const createMutation = useCreateWorkshop();
  const updateMutation = useUpdateWorkshop(workshopId ?? '');

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [localErrors, setLocalErrors] = useState<Readonly<Record<string, string>>>({});
  // Tracks whether the loaded workshop has been copied into the form yet, so a background
  // refetch cannot overwrite what the manager is currently typing.
  const [isHydrated, setIsHydrated] = useState(!isEdit);

  useEffect(() => {
    if (!isEdit || isHydrated || existing.data === undefined) return;
    setForm(toFormState(existing.data));
    setIsHydrated(true);
  }, [isEdit, isHydrated, existing.data]);

  const mutation = isEdit ? updateMutation : createMutation;
  const apiError = asApiError(mutation.error);
  const apiFieldErrors = apiError?.fieldErrors() ?? {};

  // A duplicate code is about one field, so it is shown there rather than as a banner.
  const codeError =
    apiError?.code === 'DUPLICATE_WORKSHOP_CODE' ? apiError.message : apiFieldErrors['code'];

  // The capacity guard the brief calls out: "Cannot reduce capacity to 15 — 18 people are
  // already registered." The API's message already names both numbers.
  const capacityError =
    apiError?.code === 'CAPACITY_BELOW_REGISTRATIONS'
      ? apiError.message
      : (localErrors['capacity'] ?? apiFieldErrors['capacity']);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]): void => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (mutation.isPending) return;

    const errors = validate(form, isEdit);
    setLocalErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const startsAtIso = centreLocalToUtcIso(form.startsAt);
    const endsAtIso = centreLocalToUtcIso(form.endsAt);
    if (startsAtIso === null || endsAtIso === null) {
      setLocalErrors({ startsAt: 'That date and time could not be read.' });
      return;
    }

    const description = form.description.trim();

    if (isEdit) {
      const body: UpdateWorkshopRequest = {
        code: form.code.trim(),
        title: form.title.trim(),
        instructor: form.instructor.trim(),
        startsAt: startsAtIso,
        endsAt: endsAtIso,
        capacity: Number(form.capacity),
        status: form.status,
        location: form.location,
        description: description.length > 0 ? description : null,
      };

      updateMutation.mutate(body, {
        onSuccess: (updated) => {
          showToast('success', `${updated.title} was saved.`);
          void navigate(`/workshops/${updated.id}`);
        },
      });
      return;
    }

    const body: CreateWorkshopRequest = {
      code: form.code.trim(),
      title: form.title.trim(),
      instructor: form.instructor.trim(),
      startsAt: startsAtIso,
      endsAt: endsAtIso,
      capacity: Number(form.capacity),
      status: form.status,
      location: form.location,
      description: description.length > 0 ? description : null,
    };

    createMutation.mutate(body, {
      onSuccess: (created) => {
        showToast('success', `${created.title} was created.`);
        void navigate(`/workshops/${created.id}`);
      },
    });
  };

  if (isEdit && existing.isLoading) {
    return <LoadingState label="Loading workshop…" />;
  }

  if (isEdit && existing.isError) {
    if (existing.error.code === 'NOT_FOUND') return <NotFoundPage />;
    return (
      <ErrorState
        error={existing.error}
        onRetry={() => void existing.refetch()}
        isRetrying={existing.isFetching}
      />
    );
  }

  const activeCount = existing.data?.activeCount ?? 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          to={isEdit && workshopId !== undefined ? `/workshops/${workshopId}` : '/workshops'}
          className="text-sm text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
        >
          ← {isEdit ? 'Back to workshop' : 'Back to workshops'}
        </Link>
      </div>

      <Card className="max-w-3xl">
        <CardHeader
          title={isEdit ? 'Edit workshop' : 'New workshop'}
          description={
            isEdit
              ? 'Changes take effect immediately. Capacity cannot go below the number already registered.'
              : 'A workshop starts as a draft. Set it to Open when it is ready for registrations.'
          }
        />
        <CardBody>
          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Code"
                value={form.code}
                required
                maxLength={60}
                placeholder="POT-2026-10-11"
                onChange={(event) => set('code', event.target.value)}
                error={localErrors['code'] ?? codeError}
                hint="Unique reference, e.g. POT-2026-10-11."
              />

              <TextField
                label="Title"
                value={form.title}
                required
                maxLength={200}
                placeholder="Beginner Pottery"
                onChange={(event) => set('title', event.target.value)}
                error={localErrors['title'] ?? apiFieldErrors['title']}
              />

              <TextField
                label="Instructor"
                value={form.instructor}
                required
                maxLength={200}
                onChange={(event) => set('instructor', event.target.value)}
                error={localErrors['instructor'] ?? apiFieldErrors['instructor']}
              />

              <TextField
                label="Capacity"
                type="number"
                min={1}
                max={1000}
                step={1}
                value={form.capacity}
                required
                onChange={(event) => set('capacity', event.target.value)}
                error={capacityError}
                hint={
                  isEdit && activeCount > 0
                    ? `${activeCount} ${activeCount === 1 ? 'person is' : 'people are'} already registered.`
                    : 'Between 1 and 1000 seats.'
                }
              />

              <TextField
                label="Starts at"
                type="datetime-local"
                value={form.startsAt}
                required
                onChange={(event) => set('startsAt', event.target.value)}
                error={localErrors['startsAt'] ?? apiFieldErrors['startsAt']}
              />

              <TextField
                label="Ends at"
                type="datetime-local"
                value={form.endsAt}
                required
                onChange={(event) => set('endsAt', event.target.value)}
                error={localErrors['endsAt'] ?? apiFieldErrors['endsAt']}
              />

              <SelectField
                label="Status"
                value={form.status}
                onChange={(event) => set('status', event.target.value as WorkshopStatus)}
                error={apiFieldErrors['status']}
              >
                {WORKSHOP_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </SelectField>

              <SelectField
                label="Location"
                value={form.location}
                onChange={(event) => set('location', event.target.value as WorkshopLocation)}
                error={apiFieldErrors['location']}
              >
                {WORKSHOP_LOCATIONS.map((location) => (
                  <option key={location} value={location}>
                    {LOCATION_LABELS[location]}
                  </option>
                ))}
              </SelectField>
            </div>

            <TextAreaField
              label="Description"
              rows={4}
              value={form.description}
              maxLength={2000}
              onChange={(event) => set('description', event.target.value)}
              error={apiFieldErrors['description']}
              hint="Optional. Shown to staff on the workshop page."
            />

            {/* Banner for failures that do not belong to a single field. */}
            {apiError !== null &&
            apiError.code !== 'VALIDATION_ERROR' &&
            apiError.code !== 'DUPLICATE_WORKSHOP_CODE' &&
            apiError.code !== 'CAPACITY_BELOW_REGISTRATIONS' ? (
              <FormError error={mutation.error} />
            ) : null}

            <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
              <Button
                variant="secondary"
                onClick={() =>
                  void navigate(
                    isEdit && workshopId !== undefined ? `/workshops/${workshopId}` : '/workshops',
                  )
                }
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" isLoading={mutation.isPending}>
                {mutation.isPending ? 'Saving…' : isEdit ? 'Save changes' : 'Create workshop'}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
