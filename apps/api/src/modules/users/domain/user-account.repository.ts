import type { Role } from '@seat-booker/contracts';
import type { UserAccount } from './user-account.entity';

/** Filters for the admin user list. Plain domain shape — no HTTP or Drizzle types. */
export interface UserAccountQuery {
  readonly role?: Role;
  readonly isActive?: boolean;
  /** Free-text match across name and email. */
  readonly q?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface UserAccountPage {
  readonly items: readonly UserAccount[];
  readonly total: number;
}

export interface CreateUserAccountInput {
  readonly name: string;
  /** Already trimmed and lower-cased by the `Email` value object. */
  readonly email: string;
  readonly passwordHash: string;
  readonly role: Role;
}

/** The fields an admin may change. `undefined` means "leave as it is". */
export interface UserAccountChange {
  readonly name?: string;
  readonly role?: Role;
  readonly isActive?: boolean;
}

/**
 * Outcome of an attempted update. The repository reports WHICH rule blocked the change
 * rather than throwing, so the use-case owns every message the client sees and the
 * infrastructure layer stays free of domain error classes.
 */
export type UpdateUserAccountResult =
  | { readonly outcome: 'UPDATED'; readonly user: UserAccount }
  | { readonly outcome: 'NOT_FOUND' }
  | { readonly outcome: 'LAST_ADMIN' };

export interface UserAccountRepository {
  findPage(query: UserAccountQuery): Promise<UserAccountPage>;

  findById(id: string): Promise<UserAccount | null>;

  /** Matches on `lower(email)` so the `users_email_lower_unique` index is used. */
  existsByEmail(email: string): Promise<boolean>;

  create(input: CreateUserAccountInput): Promise<UserAccount>;

  /**
   * Applies the change inside ONE transaction that also re-checks the last-active-admin
   * invariant.
   *
   * The check cannot live in the use-case: two admins demoting each other at the same
   * moment would both read "2 active admins", both pass, and both commit — leaving zero.
   * Holding the check and the write in one transaction is what makes that impossible, so
   * the rule belongs wherever the transaction does, which is here.
   */
  update(id: string, change: UserAccountChange): Promise<UpdateUserAccountResult>;

  /** Replaces the password hash. Returns false if no such user. */
  updatePasswordHash(id: string, passwordHash: string): Promise<boolean>;
}

export const USER_ACCOUNT_REPOSITORY = Symbol('UserAccountRepository');
