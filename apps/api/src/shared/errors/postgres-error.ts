import type { ErrorCode } from '@seat-booker/contracts';

/**
 * Narrowing for the `postgres` driver's error shape. We never import the driver's error
 * class — duck-typing on `code` keeps this file free of a driver dependency and works
 * whether the error arrives from `postgres`, Drizzle, or a wrapped rejection.
 */
interface PostgresDriverError {
  readonly code: string;
  readonly constraint_name?: string;
  readonly table_name?: string;
  readonly detail?: string;
  readonly message?: string;
}

/** SQLSTATE classes we translate into a domain-level conflict. */
const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';
const FOREIGN_KEY_VIOLATION = '23503';
const NOT_NULL_VIOLATION = '23502';

const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/;

export function asPostgresError(value: unknown): PostgresDriverError | null {
  if (typeof value !== 'object' || value === null) return null;
  const candidate = value as Record<string, unknown>;
  const code = candidate['code'];
  if (typeof code !== 'string' || !SQLSTATE_PATTERN.test(code)) return null;

  const result: { code: string; constraint_name?: string; table_name?: string } = { code };
  if (typeof candidate['constraint_name'] === 'string') {
    result.constraint_name = candidate['constraint_name'];
  }
  if (typeof candidate['table_name'] === 'string') {
    result.table_name = candidate['table_name'];
  }
  return result;
}

export interface MappedPostgresError {
  readonly code: ErrorCode;
  readonly message: string;
}

/**
 * Maps a constraint violation to the error contract. The constraint NAME is the signal —
 * it is the only part of a driver error that is stable and meaningful — but it never
 * reaches the client: only the mapped plain-English message does.
 *
 * These are a safety net. In normal operation the use-cases detect each of these
 * conditions first and throw the domain error themselves with a specific message
 * (naming the seat count, for instance). Reaching this map means a race got past the
 * application check and Postgres caught it — which is exactly the design.
 */
export function mapPostgresError(error: PostgresDriverError): MappedPostgresError | null {
  const constraint = error.constraint_name ?? '';

  if (error.code === UNIQUE_VIOLATION) {
    if (constraint === 'one_active_registration_per_email') {
      return {
        code: 'ALREADY_REGISTERED',
        message: 'This email address is already registered for this workshop.',
      };
    }
    if (constraint === 'workshops_code_unique' || constraint.includes('code')) {
      return {
        code: 'DUPLICATE_WORKSHOP_CODE',
        message: 'A workshop with that code already exists. Please choose a different code.',
      };
    }
    if (constraint === 'users_email_lower_unique') {
      return {
        code: 'VALIDATION_ERROR',
        message: 'An account with that email address already exists.',
      };
    }
    return {
      code: 'VALIDATION_ERROR',
      message: 'That record already exists.',
    };
  }

  if (error.code === CHECK_VIOLATION) {
    if (constraint === 'workshops_count_within_cap') {
      return {
        code: 'WORKSHOP_FULL',
        message: 'This workshop is full — the last seat was just taken.',
      };
    }
    if (constraint === 'workshops_count_non_negative') {
      return {
        code: 'ALREADY_CANCELLED',
        message: 'That registration has already been cancelled.',
      };
    }
    if (constraint === 'workshops_capacity_positive') {
      return { code: 'VALIDATION_ERROR', message: 'Capacity must be at least 1.' };
    }
    if (constraint === 'workshops_ends_after_starts') {
      return { code: 'VALIDATION_ERROR', message: 'The end time must be after the start time.' };
    }
    return { code: 'VALIDATION_ERROR', message: 'That change is not allowed.' };
  }

  if (error.code === FOREIGN_KEY_VIOLATION) {
    return { code: 'NOT_FOUND', message: 'One of the records referenced could not be found.' };
  }

  if (error.code === NOT_NULL_VIOLATION) {
    return { code: 'VALIDATION_ERROR', message: 'A required field was missing.' };
  }

  // Unrecognised SQLSTATE: let the filter fall through to a generic 500 rather than
  // guessing. The full driver error is logged server-side either way.
  return null;
}
