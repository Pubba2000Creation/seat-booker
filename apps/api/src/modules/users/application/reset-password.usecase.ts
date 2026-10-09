import { Inject, Injectable } from '@nestjs/common';
import { PASSWORD_HASHER, type PasswordHasher } from '../../auth/domain/user.repository';
import { UserNotFoundError } from '../domain/user-admin.errors';
import {
  USER_ACCOUNT_REPOSITORY,
  type UserAccountRepository,
} from '../domain/user-account.repository';

export interface ResetPasswordCommand {
  readonly targetUserId: string;
  readonly newPassword: string;
}

/**
 * Admin-set password reset (§2, optional). The admin chooses the new password and tells
 * the member of staff — there is no email service in scope, so a self-service reset link
 * is not possible.
 *
 * Existing tokens are deliberately NOT invalidated: they are stateless JWTs with no
 * revocation list. A reset therefore changes what the user signs in with next time, not
 * what their current session can do. To cut a session off immediately an admin deactivates
 * the account, which the per-request active-user lookup in `JwtAuthGuard` enforces on the
 * very next call.
 */
@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(USER_ACCOUNT_REPOSITORY) private readonly users: UserAccountRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    const passwordHash = await this.hasher.hash(command.newPassword);

    const updated = await this.users.updatePasswordHash(command.targetUserId, passwordHash);
    if (!updated) {
      throw new UserNotFoundError();
    }
  }
}
