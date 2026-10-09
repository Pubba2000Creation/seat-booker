import type { ErrorCode } from '@seat-booker/contracts';
import { DomainError } from '../../../shared/errors/domain.error';

/**
 * Admin guard-rail errors (§2). No HTTP status codes here — the filter derives the status
 * from the contract's `ERROR_CODE_STATUS` table using `code`.
 */

/**
 * An admin tried to deactivate or demote their own account. Refused because an admin who
 * locks themselves out cannot undo it: there is no public signup and only an admin can
 * create or restore an account.
 */
export class SelfModificationError extends DomainError {
  readonly code: ErrorCode = 'SELF_MODIFICATION';

  constructor(message: string) {
    super(message);
  }
}

/**
 * The change would leave the system with zero active admins — nobody could then create
 * users or restore access. Checked inside the same transaction as the update, so two
 * concurrent demotions cannot both pass the check and lock everyone out together.
 */
export class LastAdminError extends DomainError {
  readonly code: ErrorCode = 'LAST_ADMIN';

  constructor(
    message = 'This would leave the system with no active administrator. Promote another administrator first.',
  ) {
    super(message);
  }
}

/** The email is already taken by another account. */
export class EmailAlreadyInUseError extends DomainError {
  readonly code: ErrorCode = 'VALIDATION_ERROR';

  constructor() {
    super('An account with that email address already exists.');
  }
}

/** No account with that id. The message does not reveal whether the id ever existed. */
export class UserNotFoundError extends DomainError {
  readonly code: ErrorCode = 'NOT_FOUND';

  constructor() {
    super('That user account could not be found.');
  }
}
