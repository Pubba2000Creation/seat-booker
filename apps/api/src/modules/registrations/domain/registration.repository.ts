import type { RegistrationStatus, RegistrationStatusFilter } from '@seat-booker/contracts';
import type { Registration } from './registration.entity';

/**
 * Why the seat claim is ONE repository method rather than several.
 *
 * Claiming a seat and inserting the registration row must be a single transaction: the
 * atomic `UPDATE ... WHERE active_count < capacity` takes a row lock on the workshop and
 * holds it until commit, which is exactly what stops a concurrent request reading a stale
 * count. Splitting it across two calls would mean sharing a `tx` handle with the
 * application layer — leaking Drizzle into a layer that must not know SQL exists — and
 * would reopen the race the project exists to close.
 *
 * So the unit of work is named for its intent (`register`, `cancel`) and the use-case
 * orchestrates outcomes without knowing a transaction is involved.
 */

export interface RegisterAttendeeInput {
  readonly workshopId: string;
  readonly attendeeName: string;
  /** Already trimmed and lower-cased by the `Email` value object. */
  readonly attendeeEmail: string;
  readonly registeredBy: string;
}

/**
 * Outcome of a seat claim. The repository reports WHAT HAPPENED; the use-case decides what
 * the client is told, so no error class and no HTTP concept appears in `infrastructure/`.
 *
 * `NO_SEAT` deliberately does not distinguish "full" from "not open" from "already
 * started": the claim's `WHERE` clause fails as a whole, and working out which condition
 * was responsible needs a follow-up read. The use-case does that read only on the failure
 * path, so the happy path stays a single statement.
 */
export type RegisterResult =
  | { readonly outcome: 'REGISTERED'; readonly registration: Registration }
  | { readonly outcome: 'NO_SEAT' }
  | { readonly outcome: 'ALREADY_REGISTERED' };

export interface CancelRegistrationInput {
  readonly registrationId: string;
  readonly cancelledBy: string;
  readonly reason: string | null;
}

/**
 * `ALREADY_CANCELLED` covers "not ACTIVE any more" — which is also what a concurrent
 * second cancel sees, because the cancel UPDATE carries `AND status = 'ACTIVE'`. Exactly
 * one of two simultaneous cancels matches a row, so the seat is released exactly once.
 */
export type CancelResult =
  | { readonly outcome: 'CANCELLED'; readonly registration: Registration }
  | { readonly outcome: 'NOT_FOUND' }
  | { readonly outcome: 'ALREADY_CANCELLED' };

export interface RegistrationQuery {
  readonly workshopId?: string;
  /** Matched lower-cased. */
  readonly email?: string;
  /** Inclusive lower bound on `registeredAt`. */
  readonly from?: Date;
  /** Inclusive upper bound on `registeredAt`. */
  readonly to?: Date;
  /** `'ALL'` and `undefined` both mean "every status". */
  readonly status?: RegistrationStatusFilter;
  readonly page: number;
  readonly pageSize: number;
}

export interface RegistrationPage {
  readonly items: readonly Registration[];
  readonly total: number;
}

export interface RegistrationRepository {
  /**
   * Claims a seat and inserts the registration in ONE transaction, in that order.
   *
   * Claim-before-insert is deliberate (see the capacity-safety skill): the claim holds the
   * workshop's row lock for the whole transaction. Inserting first would leave a window in
   * which the rows and the counter disagree, and a failed claim would need a compensating
   * delete — which would also destroy history.
   */
  register(input: RegisterAttendeeInput): Promise<RegisterResult>;

  /**
   * Marks the registration CANCELLED and releases the seat in ONE transaction.
   *
   * Nothing is deleted: the row keeps who cancelled it, when, and why.
   */
  cancel(input: CancelRegistrationInput): Promise<CancelResult>;

  findById(id: string): Promise<Registration | null>;

  findPage(query: RegistrationQuery): Promise<RegistrationPage>;
}

export const REGISTRATION_REPOSITORY = Symbol('RegistrationRepository');

/** Statuses that occupy a seat. ACTIVE only — WAITLISTED entries do not hold one. */
export const SEAT_OCCUPYING_STATUSES: readonly RegistrationStatus[] = ['ACTIVE'] as const;
