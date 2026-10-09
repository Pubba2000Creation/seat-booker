import type { ErrorCode } from '@seat-booker/contracts';
import { DomainError } from '../../../shared/errors/domain.error';

/**
 * Auth domain errors. No HTTP status codes here — the filter derives the status from the
 * contract's `ERROR_CODE_STATUS` table using `code`.
 */

/**
 * ONE message for every login failure: unknown email, wrong password, and a deactivated
 * account alike. Distinguishing them would turn the login form into an account-enumeration
 * oracle ("User not found" tells an attacker which addresses are real).
 *
 * The deactivated case folding in here is deliberate and matches §2: "Deactivated users
 * cannot log in."
 */
export class InvalidCredentialsError extends DomainError {
  readonly code: ErrorCode = 'UNAUTHENTICATED';

  constructor() {
    super('Email or password is incorrect.');
  }
}

/**
 * The token was absent, malformed, expired, or belongs to a user who no longer exists or
 * has been deactivated. Same message for all of them for the same reason as above.
 */
export class InvalidTokenError extends DomainError {
  readonly code: ErrorCode = 'UNAUTHENTICATED';

  constructor(message = 'Your session has expired. Please sign in again.') {
    super(message);
  }
}
