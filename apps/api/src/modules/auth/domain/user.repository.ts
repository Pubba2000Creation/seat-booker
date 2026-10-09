import type { Role } from '@seat-booker/contracts';
import type { User } from './user.entity';

/**
 * The repository port. Interface and DI token live together in `domain/` so no consumer
 * ever needs to import a concrete class to inject one.
 *
 * `findActiveById` is a separate method from a general `findById` on purpose: the per-request
 * guard lookup must filter on `is_active` in SQL, not read a row and check a flag in JS.
 * Making the active filter part of the method name means a caller cannot forget it.
 */
export interface UserRepository {
  /**
   * Looks a user up for login. Matches on `lower(email)` so the
   * `users_email_lower_unique` index is used and case/whitespace variants resolve to the
   * same account. Returns inactive users too — the use-case folds "deactivated" into the
   * same generic credentials failure rather than revealing it.
   */
  findByEmail(email: string): Promise<User | null>;

  /** Returns the user only if the account is still active. Used on every request. */
  findActiveById(id: string): Promise<User | null>;
}

export const USER_REPOSITORY = Symbol('UserRepository');

/**
 * Password hashing port. Lives in `domain/` so `application/` depends on the interface and
 * `infrastructure/` supplies bcrypt. Cost comes from config, in the implementation.
 */
export interface PasswordHasher {
  hash(plain: string): Promise<string>;
  compare(plain: string, hash: string): Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol('PasswordHasher');

/**
 * Token issuing port. The use-case must not know that `@nestjs/jwt` exists, nor what the
 * signing algorithm or expiry is — it asks for a token for a user and gets one back.
 */
export interface TokenIssuer {
  /** Signs `{ sub, role }`; `iat`/`exp` are added by the implementation. */
  issue(userId: string, role: Role): Promise<string>;
}

export const TOKEN_ISSUER = Symbol('TokenIssuer');
