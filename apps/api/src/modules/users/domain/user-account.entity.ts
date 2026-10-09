import type { Role } from '@seat-booker/contracts';

/**
 * The administrative view of a user account. Pure TS — imports nothing from Nest, Drizzle,
 * or the schema.
 *
 * Deliberately separate from the auth module's `User` entity. That one exists to answer
 * "may this person sign in, and does this password match", so it holds a private
 * `passwordHash`. This one exists to be listed and edited by an admin, and has no password
 * field at all — which is what structurally guarantees a hash cannot reach a response from
 * the users endpoints.
 */
export interface UserAccountSnapshot {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export class UserAccount {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: string,
    public readonly role: Role,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  /** Rehydrates from stored values. Called only from `infrastructure/`. */
  static rehydrate(props: UserAccountSnapshot): UserAccount {
    return new UserAccount(
      props.id,
      props.name,
      props.email,
      props.role,
      props.isActive,
      props.createdAt,
      props.updatedAt,
    );
  }

  get isAdmin(): boolean {
    return this.role === 'ADMIN';
  }

  /**
   * True when the proposed change would strip this account of active-admin standing —
   * either by demoting it out of ADMIN or by deactivating it.
   *
   * This is the predicate the last-admin and self-modification rules are both expressed in
   * terms of, so "what counts as losing admin" is defined once rather than re-derived at
   * each call site.
   */
  losesAdminStanding(change: { readonly role?: Role; readonly isActive?: boolean }): boolean {
    if (!this.isAdmin || !this.isActive) return false;

    const demoted = change.role !== undefined && change.role !== 'ADMIN';
    const deactivated = change.isActive === false;

    return demoted || deactivated;
  }

  toSnapshot(): UserAccountSnapshot {
    return {
      id: this.id,
      name: this.name,
      email: this.email,
      role: this.role,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
