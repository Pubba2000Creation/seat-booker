import { Inject, Injectable } from '@nestjs/common';
import type { Role } from '@seat-booker/contracts';
import type { UserAccountSnapshot } from '../domain/user-account.entity';
import {
  LastAdminError,
  SelfModificationError,
  UserNotFoundError,
} from '../domain/user-admin.errors';
import {
  USER_ACCOUNT_REPOSITORY,
  type UserAccountRepository,
} from '../domain/user-account.repository';

export interface UpdateUserCommand {
  readonly targetUserId: string;
  /** The admin making the change — needed for the self-modification guard rails. */
  readonly actorUserId: string;
  readonly name?: string;
  readonly role?: Role;
  readonly isActive?: boolean;
}

/**
 * Edits a user's name, role, or active flag, subject to the three guard rails in §2.
 *
 * Users are deactivated, never deleted, so that `registrations.registered_by` and
 * `cancelled_by` keep pointing at a real row and the History tab can still answer "who
 * cancelled this?" years later.
 */
@Injectable()
export class UpdateUserUseCase {
  constructor(@Inject(USER_ACCOUNT_REPOSITORY) private readonly users: UserAccountRepository) {}

  async execute(command: UpdateUserCommand): Promise<UserAccountSnapshot> {
    const target = await this.users.findById(command.targetUserId);
    if (target === null) {
      throw new UserNotFoundError();
    }

    const change = {
      ...(command.name !== undefined ? { name: command.name.trim() } : {}),
      ...(command.role !== undefined ? { role: command.role } : {}),
      ...(command.isActive !== undefined ? { isActive: command.isActive } : {}),
    };

    /*
     * Guard rail 1 and 2 — self-deactivation and self-demotion (§2).
     *
     * Checked before the write and outside the transaction, which is safe: the actor's own
     * id cannot change concurrently, so unlike the last-admin rule there is no race to
     * lose. Separate messages because the two mistakes need different corrections.
     */
    if (command.targetUserId === command.actorUserId) {
      if (change.isActive === false) {
        throw new SelfModificationError(
          'You cannot deactivate your own account. Ask another administrator to do it.',
        );
      }
      if (change.role !== undefined && change.role !== target.role) {
        throw new SelfModificationError(
          'You cannot change your own role. Ask another administrator to do it.',
        );
      }
    }

    // Nothing to do. Returning the current state keeps the endpoint idempotent rather than
    // issuing an UPDATE with an empty SET, which Drizzle would reject anyway.
    if (Object.keys(change).length === 0) {
      return target.toSnapshot();
    }

    /*
     * Guard rail 3 — never zero active admins.
     *
     * The use-case does NOT pre-check the admin count. It delegates to a repository method
     * that re-counts and writes in one transaction, because a pre-check here would be a
     * race: two concurrent demotions would both read "2 active admins", both pass, and
     * both commit. `losesAdminStanding` is only used to decide whether the question is
     * even worth asking.
     */
    const result = await this.users.update(command.targetUserId, change);

    if (result.outcome === 'NOT_FOUND') {
      // Deleted between the read above and the write. Nothing hard-deletes today, so this
      // is defensive rather than reachable.
      throw new UserNotFoundError();
    }

    if (result.outcome === 'LAST_ADMIN') {
      throw new LastAdminError();
    }

    return result.user.toSnapshot();
  }
}
