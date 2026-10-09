/**
 * Registrations are never deleted. Cancelling is a status change, which is what keeps
 * the History tab complete. `WAITLISTED` exists for the bonus waitlist feature.
 */
export type RegistrationStatus = 'ACTIVE' | 'CANCELLED' | 'WAITLISTED';

export const REGISTRATION_STATUSES: readonly RegistrationStatus[] = [
  'ACTIVE',
  'CANCELLED',
  'WAITLISTED',
] as const;

export function isRegistrationStatus(value: unknown): value is RegistrationStatus {
  return typeof value === 'string' && (REGISTRATION_STATUSES as readonly string[]).includes(value);
}

/** Query filter for registration history: a concrete status, or every row. */
export type RegistrationStatusFilter = RegistrationStatus | 'ALL';
