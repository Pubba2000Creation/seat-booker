import type { Role } from '@seat-booker/contracts';
import { Email } from './email.vo';

/**
 * The User domain entity. Pure TS — imports nothing from Nest, Drizzle, or the schema.
 *
 * `passwordHash` is held here because the login invariant ("may this person sign in, and
 * does this password match") belongs to the domain. It is `private` and there is no getter:
 * the only way to use it is `verifyPassword`, which hands it to a hasher port. That makes
 * it impossible to accidentally serialise — `toSnapshot()` has no such field.
 */
export interface UserSnapshot {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  readonly isActive: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Port for password comparison, so the entity never knows bcrypt exists. */
export interface PasswordVerifier {
  compare(plain: string, hash: string): Promise<boolean>;
}

export class User {
  private constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly email: Email,
    public readonly role: Role,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    private readonly passwordHash: string,
  ) {}

  /**
   * Rehydrates an entity from stored values. Called only from `infrastructure/`, which is
   * the one layer allowed to know what a database row looks like.
   */
  static rehydrate(props: {
    readonly id: string;
    readonly name: string;
    readonly email: string;
    readonly role: Role;
    readonly isActive: boolean;
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly passwordHash: string;
  }): User {
    return new User(
      props.id,
      props.name,
      Email.create(props.email),
      props.role,
      props.isActive,
      props.createdAt,
      props.updatedAt,
      props.passwordHash,
    );
  }

  /**
   * The password check, delegated to an injected hasher. Returns a boolean rather than
   * throwing so the use-case keeps control of the single generic failure message.
   */
  async verifyPassword(plain: string, verifier: PasswordVerifier): Promise<boolean> {
    if (plain.length === 0) return false;
    return verifier.compare(plain, this.passwordHash);
  }

  /** True only if this account may sign in. Deactivated users cannot (§2). */
  get canSignIn(): boolean {
    return this.isActive;
  }

  /**
   * Everything safe to expose. `passwordHash` is structurally absent, not merely omitted
   * by convention, so no response, log line, or audit payload can leak it.
   */
  toSnapshot(): UserSnapshot {
    return {
      id: this.id,
      name: this.name,
      email: this.email.value,
      role: this.role,
      isActive: this.isActive,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
