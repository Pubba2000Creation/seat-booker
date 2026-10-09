import type { ApiErrorDetail, ErrorCode } from '@seat-booker/contracts';

/**
 * Base class for every domain error in the application. It carries a stable `code` from
 * `packages/contracts` and a plain-English `message` — and deliberately NO HTTP status.
 * The single exception filter looks the status up from `ERROR_CODE_STATUS`, which keeps
 * HTTP knowledge out of `domain/` entirely.
 *
 * This file lives in `shared/` rather than a feature's `domain/` because every feature's
 * domain extends it, and it imports nothing but contract types.
 */
export abstract class DomainError extends Error {
  abstract readonly code: ErrorCode;
  readonly details?: readonly ApiErrorDetail[];

  protected constructor(message: string, details?: readonly ApiErrorDetail[]) {
    super(message);
    this.name = new.target.name;
    if (details !== undefined) this.details = details;
    // Required so `instanceof DomainError` survives the ES2022 downlevel of extended
    // built-ins under CommonJS.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isDomainError(value: unknown): value is DomainError {
  return value instanceof DomainError;
}

/** 404 for any entity. The message must never reveal whether an email/account exists. */
export class NotFoundError extends DomainError {
  readonly code: ErrorCode = 'NOT_FOUND';

  constructor(message: string) {
    super(message);
  }
}

/**
 * Missing, invalid, or expired token — and a token belonging to a user who has since been
 * deactivated or removed. One message for all of them, so a probe learns nothing.
 */
export class UnauthenticatedError extends DomainError {
  readonly code: ErrorCode = 'UNAUTHENTICATED';

  constructor(message = 'You need to sign in to do that.') {
    super(message);
  }
}

/** Authenticated, but the role is not permitted on this route — including a bare route. */
export class ForbiddenError extends DomainError {
  readonly code: ErrorCode = 'FORBIDDEN';

  constructor(message = 'You do not have permission to do that.') {
    super(message);
  }
}

/** Raised by the application layer, not the ValidationPipe (which throws HttpException). */
export class ValidationError extends DomainError {
  readonly code: ErrorCode = 'VALIDATION_ERROR';

  constructor(message: string, details?: readonly ApiErrorDetail[]) {
    super(message, details);
  }
}
