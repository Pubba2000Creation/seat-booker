import type { Role } from '@seat-booker/contracts';

/**
 * The request-scoped identity, built by `JwtAuthGuard` from the VERIFIED token plus a
 * fresh read of the user row. Note what is absent: no `passwordHash`, and the `role` here
 * is the one on the database row, not whatever the token claimed — see the guard.
 */
export interface AuthenticatedUser {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
}

/**
 * The JWT payload — exactly `{ sub, role, iat, exp }` and nothing else. `isActive` is
 * deliberately NOT in here: it goes stale the instant an admin deactivates someone, and a
 * token cannot be revoked. Active status is resolved per request instead.
 */
export interface JwtPayload {
  readonly sub: string;
  readonly role: Role;
  readonly iat: number;
  readonly exp: number;
}

/** Shape the guard attaches to the Express request. */
export interface RequestWithUser {
  user?: AuthenticatedUser;
}
