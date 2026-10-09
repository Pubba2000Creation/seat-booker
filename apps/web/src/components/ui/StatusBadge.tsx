import type { ReactElement } from 'react';
import type { RegistrationStatus, Role, WorkshopStatus } from '@seat-booker/contracts';

/**
 * Status pills. Colours are chosen so the two "not bookable but not a problem" states
 * (DRAFT, COMPLETED) read as neutral, and only CANCELLED reads as negative — a staff
 * member scanning the list should not see a wall of red for finished workshops.
 */

const WORKSHOP_TONES: Readonly<Record<WorkshopStatus, string>> = {
  DRAFT: 'border-slate-200 bg-slate-100 text-slate-600',
  OPEN: 'border-sky-200 bg-sky-50 text-sky-700',
  CANCELLED: 'border-rose-200 bg-rose-50 text-rose-700',
  COMPLETED: 'border-violet-200 bg-violet-50 text-violet-700',
};

const WORKSHOP_LABELS: Readonly<Record<WorkshopStatus, string>> = {
  DRAFT: 'Draft',
  OPEN: 'Open',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
};

const REGISTRATION_TONES: Readonly<Record<RegistrationStatus, string>> = {
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  CANCELLED: 'border-slate-200 bg-slate-100 text-slate-600',
  WAITLISTED: 'border-amber-200 bg-amber-50 text-amber-800',
};

const REGISTRATION_LABELS: Readonly<Record<RegistrationStatus, string>> = {
  ACTIVE: 'Active',
  CANCELLED: 'Cancelled',
  WAITLISTED: 'Waitlisted',
};

const ROLE_TONES: Readonly<Record<Role, string>> = {
  ADMIN: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  MANAGER: 'border-teal-200 bg-teal-50 text-teal-700',
  STAFF: 'border-slate-200 bg-slate-100 text-slate-700',
};

const ROLE_LABELS: Readonly<Record<Role, string>> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'Staff',
};

const PILL =
  'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap';

export function WorkshopStatusBadge({ status }: { readonly status: WorkshopStatus }): ReactElement {
  return <span className={`${PILL} ${WORKSHOP_TONES[status]}`}>{WORKSHOP_LABELS[status]}</span>;
}

export function RegistrationStatusBadge({
  status,
}: {
  readonly status: RegistrationStatus;
}): ReactElement {
  return (
    <span className={`${PILL} ${REGISTRATION_TONES[status]}`}>{REGISTRATION_LABELS[status]}</span>
  );
}

export function RoleBadge({ status }: { readonly status: Role }): ReactElement {
  return <span className={`${PILL} ${ROLE_TONES[status]}`}>{ROLE_LABELS[status]}</span>;
}

/** Active / deactivated, for the users table. Nothing is deleted, so this matters. */
export function ActiveBadge({ isActive }: { readonly isActive: boolean }): ReactElement {
  return (
    <span
      className={`${PILL} ${
        isActive
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
          : 'border-slate-300 bg-slate-100 text-slate-500'
      }`}
    >
      {isActive ? 'Active' : 'Deactivated'}
    </span>
  );
}
