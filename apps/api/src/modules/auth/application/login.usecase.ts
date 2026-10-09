import { Inject, Injectable } from '@nestjs/common';
import { Email } from '../domain/email.vo';
import { InvalidCredentialsError } from '../domain/auth.errors';
import {
  PASSWORD_HASHER,
  TOKEN_ISSUER,
  USER_REPOSITORY,
  type PasswordHasher,
  type TokenIssuer,
  type UserRepository,
} from '../domain/user.repository';
import type { UserSnapshot } from '../domain/user.entity';

export interface LoginCommand {
  readonly email: string;
  readonly password: string;
}

export interface LoginResult {
  readonly accessToken: string;
  readonly user: UserSnapshot;
}

/**
 * Exchanges email + password for an access token.
 *
 * Every failure path throws the SAME `InvalidCredentialsError` — unknown email, wrong
 * password, and deactivated account are indistinguishable from outside. The password is
 * still compared even when no user was found (see below) so response timing does not leak
 * which emails exist either.
 */
@Injectable()
export class LoginUseCase {
  /**
   * A bcrypt hash of a value no one can supply, compared against when the email is unknown.
   * Without this, a request for a non-existent address returns in microseconds while a real
   * one takes ~100ms of bcrypt — a reliable account-enumeration signal.
   */
  private static readonly DUMMY_HASH =
    '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

  constructor(
    @Inject(USER_REPOSITORY) private readonly users: UserRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(TOKEN_ISSUER) private readonly tokens: TokenIssuer,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    // Normalise without throwing: a malformed address must produce the same generic
    // failure as a wrong password, not a validation error that confirms the format.
    const email = Email.normalise(command.email);

    const user = await this.users.findByEmail(email);

    if (user === null) {
      await this.hasher.compare(command.password, LoginUseCase.DUMMY_HASH);
      throw new InvalidCredentialsError();
    }

    const passwordMatches = await user.verifyPassword(command.password, this.hasher);
    if (!passwordMatches) {
      throw new InvalidCredentialsError();
    }

    // Checked AFTER the password so a deactivated account behaves identically to a wrong
    // password from the caller's point of view (§2: deactivated users cannot log in).
    if (!user.canSignIn) {
      throw new InvalidCredentialsError();
    }

    const accessToken = await this.tokens.issue(user.id, user.role);

    return { accessToken, user: user.toSnapshot() };
  }
}
