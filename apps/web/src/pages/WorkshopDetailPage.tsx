import { useState } from 'react';
import type { ReactElement } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { RegistrationStatusFilter } from '@seat-booker/contracts';
import { useAuth } from '../features/auth/auth-context';
import { useWorkshop } from '../features/workshops/use-workshops';
import { RegisterAttendeeForm } from '../features/registrations/RegisterAttendeeForm';
import { RegistrationList } from '../features/registrations/RegistrationList';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { SeatCounter } from '../components/ui/SeatBadge';
import { WorkshopStatusBadge } from '../components/ui/StatusBadge';
import { ErrorState, LoadingState } from '../components/ui/States';
import { formatDateRange } from '../lib/dates';
import { NotFoundPage } from './NotFoundPage';

const LOCATION_LABELS: Readonly<Record<string, string>> = {
  COLOMBO: 'Colombo',
  KALUTARA: 'Kalutara',
  GALLE: 'Galle',
};

type Tab = 'attendees' | 'history';

/**
 * Workshop detail: the information, the live seat counter, the register form, the active
 * attendee list, and the History tab showing every registration including cancelled ones
 * with who did what and when.
 *
 * The seat counter and the lists come from separate queries but are invalidated together
 * by the registration mutations, so they cannot disagree after a register or a cancel.
 */
export function WorkshopDetailPage(): ReactElement {
  const { workshopId } = useParams<{ workshopId: string }>();
  const { hasRole } = useAuth();
  const [tab, setTab] = useState<Tab>('attendees');

  const id = workshopId ?? '';
  const query = useWorkshop(id);

  const canManage = hasRole('MANAGER');
  // Both MANAGER and STAFF register and cancel, per the matrix.
  const canRegister = hasRole('MANAGER', 'STAFF');

  if (query.isLoading) {
    return <LoadingState label="Loading workshop…" />;
  }

  if (query.isError) {
    // A 404 gets the dedicated page; anything else keeps the retry affordance.
    if (query.error.code === 'NOT_FOUND') {
      return <NotFoundPage />;
    }
    return (
      <ErrorState
        error={query.error}
        onRetry={() => void query.refetch()}
        isRetrying={query.isFetching}
      />
    );
  }

  const workshop = query.data;
  if (workshop === undefined) {
    return <NotFoundPage />;
  }

  const listStatus: RegistrationStatusFilter = tab === 'attendees' ? 'ACTIVE' : 'ALL';

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link
          to="/workshops"
          className="text-sm text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
        >
          ← Back to workshops
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Workshop information */}
        <Card className="lg:col-span-2">
          <CardHeader
            title={workshop.title}
            description={workshop.code}
            actions={
              canManage ? (
                <Link
                  to={`/workshops/${workshop.id}/edit`}
                  className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Edit workshop
                </Link>
              ) : undefined
            }
          />
          <CardBody className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <WorkshopStatusBadge status={workshop.status} />
              <span className="text-xs text-slate-500">
                {LOCATION_LABELS[workshop.location] ?? workshop.location}
              </span>
            </div>

            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  When
                </dt>
                <dd className="mt-0.5 text-sm text-slate-800">
                  {formatDateRange(workshop.startsAt, workshop.endsAt)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Instructor
                </dt>
                <dd className="mt-0.5 text-sm text-slate-800">{workshop.instructor}</dd>
              </div>
            </dl>

            {workshop.description !== null && workshop.description.length > 0 ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  About
                </dt>
                <p className="mt-1 text-sm whitespace-pre-line text-slate-700">
                  {workshop.description}
                </p>
              </div>
            ) : null}

            <div className="border-t border-slate-200 pt-4">
              <SeatCounter workshop={workshop} />
            </div>
          </CardBody>
        </Card>

        {/* Register form — only for the roles that may take registrations. */}
        {canRegister ? (
          <Card>
            <CardHeader
              title="Register an attendee"
              description="Attendees do not need an account."
            />
            <CardBody>
              <RegisterAttendeeForm workshop={workshop} />
            </CardBody>
          </Card>
        ) : null}
      </div>

      {/* Attendees / History */}
      <Card>
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div
            role="tablist"
            aria-label="Registration views"
            className="flex gap-1 rounded-lg bg-slate-100 p-1"
          >
            <TabButton
              isActive={tab === 'attendees'}
              onClick={() => setTab('attendees')}
              label={`Attendees (${workshop.activeCount})`}
              controls="registration-panel"
            />
            <TabButton
              isActive={tab === 'history'}
              onClick={() => setTab('history')}
              label="History"
              controls="registration-panel"
            />
          </div>
          <p className="hidden text-xs text-slate-500 sm:block">
            {tab === 'attendees'
              ? 'Everyone currently holding a seat.'
              : 'Every registration, including cancelled ones.'}
          </p>
        </div>

        <div id="registration-panel" role="tabpanel">
          <RegistrationList workshopId={workshop.id} status={listStatus} canCancel={canRegister} />
        </div>
      </Card>
    </div>
  );
}

function TabButton({
  isActive,
  onClick,
  label,
  controls,
}: {
  readonly isActive: boolean;
  readonly onClick: () => void;
  readonly label: string;
  readonly controls: string;
}): ReactElement {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      aria-controls={controls}
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
        isActive ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
      }`}
    >
      {label}
    </button>
  );
}
