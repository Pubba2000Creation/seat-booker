/**
 * The canonical error-code table. This union, the `error-contract` skill table, and the
 * API's exception filter map must always agree — a new failure mode means a new entry here
 * in the same commit as the code that throws it.
 *
 * The frontend branches on `code`, never on `message`.
 */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'WORKSHOP_FULL'
  | 'ALREADY_REGISTERED'
  | 'ALREADY_CANCELLED'
  | 'WORKSHOP_NOT_BOOKABLE'
  | 'CAPACITY_BELOW_REGISTRATIONS'
  | 'DUPLICATE_WORKSHOP_CODE'
  | 'LAST_ADMIN'
  | 'SELF_MODIFICATION'
  | 'INTERNAL_ERROR';

export const ERROR_CODES: readonly ErrorCode[] = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'WORKSHOP_FULL',
  'ALREADY_REGISTERED',
  'ALREADY_CANCELLED',
  'WORKSHOP_NOT_BOOKABLE',
  'CAPACITY_BELOW_REGISTRATIONS',
  'DUPLICATE_WORKSHOP_CODE',
  'LAST_ADMIN',
  'SELF_MODIFICATION',
  'INTERNAL_ERROR',
] as const;

/** The HTTP status each code is returned with. */
export const ERROR_CODE_STATUS: Readonly<Record<ErrorCode, number>> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  WORKSHOP_FULL: 409,
  ALREADY_REGISTERED: 409,
  ALREADY_CANCELLED: 409,
  WORKSHOP_NOT_BOOKABLE: 409,
  CAPACITY_BELOW_REGISTRATIONS: 409,
  DUPLICATE_WORKSHOP_CODE: 409,
  LAST_ADMIN: 409,
  SELF_MODIFICATION: 409,
  INTERNAL_ERROR: 500,
} as const;

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}

/** One failed field, attached to `VALIDATION_ERROR` responses only. */
export interface ApiErrorDetail {
  readonly field: string;
  readonly message: string;
}

/**
 * The single error envelope every failing response uses. `message` is plain English and
 * safe to show verbatim in a toast — it never contains SQL, a stack trace, or a code.
 */
export interface ApiError {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly message: string;
  readonly details?: readonly ApiErrorDetail[];
}

export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['statusCode'] === 'number' &&
    isErrorCode(candidate['code']) &&
    typeof candidate['message'] === 'string'
  );
}
