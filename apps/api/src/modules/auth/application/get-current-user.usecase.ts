import { Inject, Injectable } from '@nestjs/common';
import { InvalidTokenError } from '../domain/auth.errors';
import { USER_REPOSITORY, type UserRepository } from '../domain/user.repository';
import type { UserSnapshot } from '../domain/user.entity';

/**
 * Resolves the full profile for an already-authenticated user id.
 *
 * `JwtAuthGuard` has normally just loaded the same row, so this looks redundant — it is
 * kept as a use-case because `GET /auth/me` is a real application operation and the
 * controller must not reach into a repository itself. The extra read is one indexed
 * primary-key lookup on a route the frontend calls once at bootstrap.
 *
 * It also re-filters on active status, so the deactivation rule holds even if this
 * use-case is ever called from somewhere without the guard in front of it.
 */
@Injectable()
export class GetCurrentUserUseCase {
  constructor(@Inject(USER_REPOSITORY) private readonly users: UserRepository) {}

  async execute(userId: string): Promise<UserSnapshot> {
    const user = await this.users.findActiveById(userId);
    if (user === null) {
      throw new InvalidTokenError();
    }
    return user.toSnapshot();
  }
}
