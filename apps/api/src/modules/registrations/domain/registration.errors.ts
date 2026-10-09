import type { ErrorCode } from '@seat-booker/contracts';
import { DomainError } from '../../../shared/errors/domain.error';

/**
 * Registration domain errors. No HTTP status codes here — the filter derives the status
 * from the contract's `ERROR_CODE_STATUS` table using `code`.
 */

export class RegistrationNotFoundError extends DomainError {
  readonly code: ErrorCode = 'NOT_FOUND';

  constructor() {
    super('That registration could not be found.');
  }
}

/**
 * The seat claim found no free seat. This is the Saturday-morning case from the brief: two
 * staff promise the last seat at the same instant and exactly one of them loses.
 *
 * The message names the numbers because "it is full" invites the receptionist to retry,
 * while "20 of 20 seats taken" tells them to offer a different workshop.
 */
export class WorkshopFullError extends DomainError {
  readonly code: ErrorCode = 'WORKSHOP_FULL';

  constructor(capacity: number) {
    super(`This workshop is full (${capacity} of ${capacity} seats taken).`);
  }
}

/**
 * Lost the race specifically — the seat was free when the page was rendered and gone by
 * the time Register was pressed. Separated from `WorkshopFullError` only in wording: the
 * frontend branches on the same `WORKSHOP_FULL` code and refreshes the seat count either
 * way, which is what §7.2 asks for.
 */
export class LastSeatTakenError extends DomainError {
  readonly code: ErrorCode = 'WORKSHOP_FULL';

  constructor() {
    super('Sorry, the last seat was just taken. The list has been refreshed.');
  }
}

/** DRAFT, CANCELLED, COMPLETED, or already started (§4.3). */
export class WorkshopNotBookableError extends DomainError {
  readonly code: ErrorCode = 'WORKSHOP_NOT_BOOKABLE';

  constructor(message: string) {
    super(message);
  }
}

/**
 * This email already holds an ACTIVE registration for this workshop. Enforced by the
 * `one_active_registration_per_email` partial unique index, so a concurrent duplicate is
 * caught by Postgres and mapped here rather than slipping through.
 *
 * Re-registering AFTER a cancellation is allowed — the index is partial for that reason.
 */
export class AlreadyRegisteredError extends DomainError {
  readonly code: ErrorCode = 'ALREADY_REGISTERED';

  constructor() {
    super('This email address is already registered for this workshop.');
  }
}

/**
 * The registration is no longer ACTIVE. This is what stops a double decrement when two
 * staff cancel the same registration at the same moment: the cancel UPDATE carries
 * `AND status = 'ACTIVE'`, so exactly one of them matches a row and the other lands here.
 */
export class AlreadyCancelledError extends DomainError {
  readonly code: ErrorCode = 'ALREADY_CANCELLED';

  constructor() {
    super('That registration has already been cancelled.');
  }
}
