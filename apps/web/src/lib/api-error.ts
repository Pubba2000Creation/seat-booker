import { isApiError } from '@seat-booker/contracts';
import type { ApiError, ApiErrorDetail, ErrorCode } from '@seat-booker/contracts';

/**
 * An API failure as an `Error` subclass, so TanStack Query can carry it through
 * `error` without losing the `code` the UI branches on.
 *
 * The rule from the error-contract skill: branch on `code`, never on `message`. `message`
 * is already plain English written for non-technical staff, so it is safe to show in a
 * toast verbatim — but only when it came from the envelope. A transport failure or an
 * unparseable body gets a generic sentence instead, never raw JSON.
 */
export class ApiRequestError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details: readonly ApiErrorDetail[];

  constructor(envelope: ApiError) {
    super(envelope.message);
    this.name = 'ApiRequestError';
    this.statusCode = envelope.statusCode;
    this.code = envelope.code;
    this.details = envelope.details ?? [];
  }

  /** Field name -> first message, for attaching `VALIDATION_ERROR` details to inputs. */
  fieldErrors(): Readonly<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const detail of this.details) {
      if (!(detail.field in result)) {
        result[detail.field] = detail.message;
      }
    }
    return result;
  }
}

const GENERIC_MESSAGE = 'Something went wrong. Please try again.';

/**
 * Builds an error for a response whose body was not a usable envelope — a proxy error
 * page, an HTML 502, a truncated body. The status still tells us how to behave (a 401
 * must still log the user out), so it is mapped to the nearest code.
 */
export function unparseableResponseError(status: number): ApiRequestError {
  const code: ErrorCode =
    status === 401
      ? 'UNAUTHENTICATED'
      : status === 403
        ? 'FORBIDDEN'
        : status === 404
          ? 'NOT_FOUND'
          : 'INTERNAL_ERROR';

  return new ApiRequestError({
    statusCode: status,
    code,
    message: GENERIC_MESSAGE,
  });
}

/** The API could not be reached at all — offline, DNS, CORS, server down. */
export function networkError(): ApiRequestError {
  return new ApiRequestError({
    statusCode: 0,
    code: 'INTERNAL_ERROR',
    message: 'Cannot reach the server. Check your connection and try again.',
  });
}

/** Narrows an unknown thrown value from a query or mutation. */
export function asApiError(error: unknown): ApiRequestError | null {
  return error instanceof ApiRequestError ? error : null;
}

/**
 * The single place that turns any thrown value into a sentence for the user. Anything
 * unrecognised becomes the generic message — a raw `Error.message` from a bundler or a
 * driver must never reach the screen.
 */
export function errorMessage(error: unknown): string {
  const apiError = asApiError(error);
  if (apiError) return apiError.message;
  return GENERIC_MESSAGE;
}

/** Re-exported so callers can validate a parsed body without a second import. */
export { isApiError };
