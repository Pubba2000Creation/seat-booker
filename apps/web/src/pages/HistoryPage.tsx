import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { REGISTRATION_STATUSES } from '@seat-booker/contracts';
import type { RegistrationFilters, RegistrationResponse } from '@seat-booker/contracts';
import { useRegistrationFilters } from '../features/registrations/use-registration-filters';
import { useRegistrationSearch } from '../features/registrations/use-registrations';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SelectField, TextField } from '../components/ui/Field';
import { RegistrationStatusBadge } from '../components/ui/StatusBadge';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { formatDateTime, thisWeekRange } from '../lib/dates';

/**
 * Registration history across every workshop (§6.4) — the question staff actually get
 * asked at the desk: "has this person booked with us before?".
 *
 * This is the only view onto `GET /api/registrations`; the workshop detail page's History
 * tab is scoped to one workshop. Cancelling is deliberately NOT offered here: a row is
 * cancelled from the workshop it belongs to, where the seat count is on screen to confirm
 * the effect. The workshop link in each row leads there.
 */

const STATUS_LABELS: Readonly<Record<string, string>> = {
  ACTIVE: 'Active',
  CANCELLED: 'Cancelled',
  WAITLISTED: 'Waitlisted',
};

export function HistoryPage(): ReactElement {
  const { filters, setFilters, resetFilters } = useRegistrationFilters();
  const query = useRegistrationSearch(filters);

  const items = query.data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Registration history</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Look up an attendee across every workshop, including cancellations.
        </p>
      </div>

      <Card>
        <CardHeader
          title="All registrations"
          description={
            query.data !== undefined
              ? `${query.data.total} ${
                  query.data.total === 1 ? 'registration' : 'registrations'
                } match these filters`
              : undefined
          }
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void query.refetch()}
              isLoading={query.isFetching && !query.isLoading}
            >
              Refresh
            </Button>
          }
        />

        <HistoryFilterBar filters={filters} onChange={setFilters} onReset={resetFilters} />

        {query.isLoading ? (
          <LoadingState label="Searching registrations…" />
        ) : query.isError ? (
          <ErrorState
            error={query.error}
            onRetry={() => void query.refetch()}
            isRetrying={query.isFetching}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="No registrations match these filters"
            description="Check the email address is complete and correct, or widen the date range."
            action={
              <Button variant="secondary" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            {/* Wide screens: table. */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-5 py-2.5">
                      Attendee
                    </th>
                    <th scope="col" className="px-5 py-2.5">
                      Workshop
                    </th>
                    <th scope="col" className="px-5 py-2.5">
                      Status
                    </th>
                    <th scope="col" className="px-5 py-2.5">
                      Registered
                    </th>
                    <th scope="col" className="px-5 py-2.5">
                      Cancelled
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((registration) => (
                    <HistoryRow key={registration.id} registration={registration} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Narrow screens: cards. Staff also use this on a phone at the door. */}
            <ul className="divide-y divide-slate-200 lg:hidden">
              {items.map((registration) => (
                <li key={registration.id}>
                  <HistoryCardRow registration={registration} />
                </li>
              ))}
            </ul>

            <Pagination
              page={query.data?.page ?? 1}
              pageSize={query.data?.pageSize ?? 20}
              total={query.data?.total ?? 0}
              onPageChange={(page) => setFilters({ page })}
              isLoading={query.isFetching}
            />
          </>
        )}
      </Card>
    </div>
  );
}

interface HistoryFilterBarProps {
  readonly filters: RegistrationFilters;
  readonly onChange: (patch: Partial<RegistrationFilters>) => void;
  readonly onReset: () => void;
}

function HistoryFilterBar({ filters, onChange, onReset }: HistoryFilterBarProps): ReactElement {
  const week = thisWeekRange();
  const isThisWeek = filters.from === week.from && filters.to === week.to;

  const hasAnyFilter =
    (filters.email !== undefined && filters.email.length > 0) ||
    filters.from !== undefined ||
    filters.to !== undefined ||
    filters.status !== undefined ||
    filters.workshopId !== undefined;

  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/60 px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={isThisWeek ? 'primary' : 'secondary'}
          size="sm"
          // Toggles, matching the workshops filter bar: pressing again clears the range.
          onClick={() =>
            onChange(
              isThisWeek
                ? { from: undefined, to: undefined, page: 1 }
                : { from: week.from, to: week.to, page: 1 },
            )
          }
          aria-pressed={isThisWeek}
        >
          This week
        </Button>

        <Button
          variant={filters.status === 'CANCELLED' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() =>
            onChange({
              status: filters.status === 'CANCELLED' ? undefined : 'CANCELLED',
              page: 1,
            })
          }
          aria-pressed={filters.status === 'CANCELLED'}
        >
          Cancellations only
        </Button>

        {hasAnyFilter ? (
          <Button variant="ghost" size="sm" onClick={onReset}>
            Clear filters
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* The API matches this column exactly, to keep `registrations_email_idx` usable —
            so the hint says "full address" rather than promising partial search. */}
        <TextField
          label="Attendee email"
          type="search"
          placeholder="name@example.com"
          hint="Enter the full address."
          value={filters.email ?? ''}
          onChange={(event) => onChange({ email: event.target.value, page: 1 })}
        />

        <TextField
          label="Registered from"
          type="date"
          value={filters.from ?? ''}
          onChange={(event) => onChange({ from: event.target.value || undefined, page: 1 })}
        />

        <TextField
          label="Registered to"
          type="date"
          value={filters.to ?? ''}
          onChange={(event) => onChange({ to: event.target.value || undefined, page: 1 })}
        />

        <SelectField
          label="Status"
          value={filters.status ?? ''}
          onChange={(event) =>
            onChange({
              // The option values come from the contract's status union, so this narrows a
              // known-good string rather than trusting arbitrary input.
              status:
                event.target.value === ''
                  ? undefined
                  : (event.target.value as RegistrationFilters['status']),
              page: 1,
            })
          }
        >
          <option value="">Any status</option>
          {REGISTRATION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status] ?? status}
            </option>
          ))}
        </SelectField>
      </div>

      {filters.workshopId !== undefined ? (
        <div className="flex items-center gap-2 text-xs text-slate-600">
          <span>Filtered to a single workshop.</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ workshopId: undefined, page: 1 })}
          >
            Show all workshops
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function HistoryRow({
  registration,
}: {
  readonly registration: RegistrationResponse;
}): ReactElement {
  return (
    <tr className="border-b border-slate-100 transition hover:bg-slate-50">
      <td className="px-5 py-3">
        <p className="font-medium text-slate-900">{registration.attendeeName}</p>
        <p className="text-xs text-slate-500">{registration.attendeeEmail}</p>
      </td>
      <td className="px-5 py-3">
        {/* The workshop title is not on this payload — the link is what matters, so staff
            can jump to the workshop to cancel or see the seat count. */}
        <Link
          to={`/workshops/${registration.workshopId}`}
          className="text-sm text-slate-700 underline-offset-2 hover:underline"
        >
          Open workshop
        </Link>
      </td>
      <td className="px-5 py-3">
        <RegistrationStatusBadge status={registration.status} />
      </td>
      <td className="px-5 py-3 text-xs text-slate-600">
        <p>{formatDateTime(registration.registeredAt)}</p>
        <p className="text-slate-500">by {registration.registeredBy?.name ?? 'Unknown'}</p>
      </td>
      <td className="px-5 py-3 text-xs text-slate-600">
        {registration.cancelledAt !== null ? (
          <>
            <p>{formatDateTime(registration.cancelledAt)}</p>
            <p className="text-slate-500">by {registration.cancelledBy?.name ?? 'Unknown'}</p>
            {registration.cancelReason !== null ? (
              <p className="mt-0.5 italic text-slate-500">“{registration.cancelReason}”</p>
            ) : null}
          </>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </td>
    </tr>
  );
}

function HistoryCardRow({
  registration,
}: {
  readonly registration: RegistrationResponse;
}): ReactElement {
  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{registration.attendeeName}</p>
          <p className="truncate text-xs text-slate-500">{registration.attendeeEmail}</p>
        </div>
        <RegistrationStatusBadge status={registration.status} />
      </div>

      <dl className="mt-2 flex flex-col gap-1 text-xs text-slate-600">
        <div>
          <dt className="sr-only">Registered</dt>
          <dd>
            Registered {formatDateTime(registration.registeredAt)} by{' '}
            {registration.registeredBy?.name ?? 'Unknown'}
          </dd>
        </div>
        {registration.cancelledAt !== null ? (
          <div>
            <dt className="sr-only">Cancelled</dt>
            <dd>
              Cancelled {formatDateTime(registration.cancelledAt)} by{' '}
              {registration.cancelledBy?.name ?? 'Unknown'}
              {registration.cancelReason !== null ? ` — “${registration.cancelReason}”` : ''}
            </dd>
          </div>
        ) : null}
      </dl>

      <div className="mt-2">
        <Link
          to={`/workshops/${registration.workshopId}`}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Open workshop
        </Link>
      </div>
    </div>
  );
}
