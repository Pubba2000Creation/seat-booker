import type { ReactElement } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { WorkshopResponse } from '@seat-booker/contracts';
import { useAuth } from '../features/auth/auth-context';
import { useWorkshopFilters } from '../features/workshops/use-workshop-filters';
import { useWorkshops } from '../features/workshops/use-workshops';
import { WorkshopFilterBar } from '../features/workshops/WorkshopFilterBar';
import { Card, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SeatBadge } from '../components/ui/SeatBadge';
import { WorkshopStatusBadge } from '../components/ui/StatusBadge';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { formatDateRange } from '../lib/dates';

const LOCATION_LABELS: Readonly<Record<string, string>> = {
  COLOMBO: 'Colombo',
  KALUTARA: 'Kalutara',
  GALLE: 'Galle',
};

/**
 * The workshops list — the landing page for MANAGER and STAFF.
 *
 * A table on wide screens and cards on narrow ones: the staff take registrations at a desk
 * but also on a phone at the door, and a horizontally scrolling table is unusable there.
 *
 * "New workshop" appears for MANAGER only. STAFF can register attendees but not create
 * workshops, per the matrix — and the API refuses them either way.
 */
export function WorkshopsPage(): ReactElement {
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const { filters, setFilters, resetFilters } = useWorkshopFilters();
  const query = useWorkshops(filters);

  const canManage = hasRole('MANAGER');
  const items = query.data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Workshops</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Find a workshop and register attendees. Seat counts are live.
          </p>
        </div>
        {canManage ? (
          <Button onClick={() => navigate('/workshops/new')}>New workshop</Button>
        ) : null}
      </div>

      <Card>
        <CardHeader
          title="All workshops"
          description={
            query.data !== undefined
              ? `${query.data.total} ${query.data.total === 1 ? 'workshop' : 'workshops'} match these filters`
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

        <WorkshopFilterBar filters={filters} onChange={setFilters} onReset={resetFilters} />

        {query.isLoading ? (
          <LoadingState label="Loading workshops…" />
        ) : query.isError ? (
          <ErrorState
            error={query.error}
            onRetry={() => void query.refetch()}
            isRetrying={query.isFetching}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="No workshops match these filters"
            description="Try clearing the date range or the status filter."
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
                      Workshop
                    </th>
                    <th scope="col" className="px-5 py-2.5">
                      Instructor
                    </th>
                    <th scope="col" className="px-5 py-2.5">
                      When
                    </th>
                    <th scope="col" className="px-5 py-2.5">
                      Location
                    </th>
                    <th scope="col" className="px-5 py-2.5">
                      Status
                    </th>
                    <th scope="col" className="px-5 py-2.5">
                      Seats
                    </th>
                    <th scope="col" className="px-5 py-2.5">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((workshop) => (
                    <WorkshopRow key={workshop.id} workshop={workshop} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Narrow screens: cards. */}
            <ul className="divide-y divide-slate-200 lg:hidden">
              {items.map((workshop) => (
                <li key={workshop.id}>
                  <WorkshopCardRow workshop={workshop} />
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

function WorkshopRow({ workshop }: { readonly workshop: WorkshopResponse }): ReactElement {
  return (
    <tr className="border-b border-slate-100 transition hover:bg-slate-50">
      <td className="px-5 py-3">
        <Link
          to={`/workshops/${workshop.id}`}
          className="font-medium text-slate-900 underline-offset-2 hover:underline"
        >
          {workshop.title}
        </Link>
        <p className="font-mono text-xs text-slate-500">{workshop.code}</p>
      </td>
      <td className="px-5 py-3 text-slate-700">{workshop.instructor}</td>
      <td className="px-5 py-3 text-slate-700">
        {formatDateRange(workshop.startsAt, workshop.endsAt)}
      </td>
      <td className="px-5 py-3 text-slate-700">
        {LOCATION_LABELS[workshop.location] ?? workshop.location}
      </td>
      <td className="px-5 py-3">
        <WorkshopStatusBadge status={workshop.status} />
      </td>
      <td className="px-5 py-3">
        <SeatBadge workshop={workshop} />
      </td>
      <td className="px-5 py-3 text-right">
        <Link
          to={`/workshops/${workshop.id}`}
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
        >
          Open
        </Link>
      </td>
    </tr>
  );
}

function WorkshopCardRow({ workshop }: { readonly workshop: WorkshopResponse }): ReactElement {
  return (
    <Link to={`/workshops/${workshop.id}`} className="block px-5 py-4 transition hover:bg-slate-50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium text-slate-900">{workshop.title}</p>
          <p className="font-mono text-xs text-slate-500">{workshop.code}</p>
        </div>
        <SeatBadge workshop={workshop} />
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
        <div className="col-span-2">
          <dt className="sr-only">When</dt>
          <dd>{formatDateRange(workshop.startsAt, workshop.endsAt)}</dd>
        </div>
        <div>
          <dt className="sr-only">Instructor</dt>
          <dd>{workshop.instructor}</dd>
        </div>
        <div>
          <dt className="sr-only">Location</dt>
          <dd>{LOCATION_LABELS[workshop.location] ?? workshop.location}</dd>
        </div>
      </dl>
      <div className="mt-2">
        <WorkshopStatusBadge status={workshop.status} />
      </div>
    </Link>
  );
}
