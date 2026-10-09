import type { ErrorCode } from '@seat-booker/contracts';
import { DomainError } from '../../../shared/errors/domain.error';

/**
 * Workshop domain errors. No HTTP status codes here — the filter derives the status from
 * the contract's `ERROR_CODE_STATUS` table using `code`.
 */

export class WorkshopNotFoundError extends DomainError {
  readonly code: ErrorCode = 'NOT_FOUND';

  constructor() {
    super('That workshop could not be found.');
  }
}

/** The `code` column is unique — it is the identifier staff read out over the phone. */
export class DuplicateWorkshopCodeError extends DomainError {
  readonly code: ErrorCode = 'DUPLICATE_WORKSHOP_CODE';

  constructor(code: string) {
    super(`A workshop with the code "${code}" already exists. Please choose a different code.`);
  }
}

/**
 * Capacity cannot be reduced below the number of people already registered — those are
 * real bookings that have been promised to real people.
 *
 * The message names the current count, because "refused" without a number leaves the
 * manager guessing what number would work.
 */
export class CapacityBelowRegistrationsError extends DomainError {
  readonly code: ErrorCode = 'CAPACITY_BELOW_REGISTRATIONS';

  constructor(requested: number, activeCount: number) {
    super(
      `Cannot reduce capacity to ${requested} — ${activeCount} ${
        activeCount === 1 ? 'person is' : 'people are'
      } already registered.`,
    );
  }
}

/**
 * Schedule validation that the DTO cannot do alone. On a PATCH only one of the two
 * timestamps may be supplied, so "ends after starts" has to be checked against the merged
 * result, which only the use-case knows. `workshops_ends_after_starts` is the DB-level
 * backstop.
 */
export class InvalidWorkshopScheduleError extends DomainError {
  readonly code: ErrorCode = 'VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
  }
}
