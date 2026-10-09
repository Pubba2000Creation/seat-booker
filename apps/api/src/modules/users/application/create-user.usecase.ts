import { Inject, Injectable } from '@nestjs/common';
import type { Role } from '@seat-booker/contracts';
import { Email } from '../../auth/domain/email.vo';
import { PASSWORD_HASHER, type PasswordHasher } from '../../auth/domain/user.repository';
import type { UserAccountSnapshot } from '../domain/user-account.entity';
import { EmailAlreadyInUseError } from '../domain/user-admin.errors';
import {
  USER_ACCOUNT_REPOSITORY,
  type UserAccountRepository,
} from '../domain/user-account.repository';

export interface CreateUserCommand {
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  readonly password: string;
}

/**
 * Creates an account. There is no public signup (§2) — an admin sets the initial password
 * and hands it over, so this use-case hashes whatever it is given rather than generating
 * one.
 */
@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_ACCOUNT_REPOSITORY) private readonly users: UserAccountRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  async execute(command: CreateUserCommand): Promise<UserAccountSnapshot> {
    // The `Email` VO is the single definition of "the same email" across login, user
    // creation, and attendee registration. Reusing it here is why `A@X.com ` cannot slip
    // in as a second account alongside `a@x.com`.
    const email = Email.create(command.email);

    // A friendly pre-check. It is NOT the guarantee — `users_email_lower_unique` is, and a
    // concurrent pair of creates will have one rejected by the index and mapped to the
    // same message by the exception filter.
    if (await this.users.existsByEmail(email.value)) {
      throw new EmailAlreadyInUseError();
    }

    const passwordHash = await this.hasher.hash(command.password);

    const created = await this.users.create({
      name: command.name.trim(),
      email: email.value,
      passwordHash,
      role: command.role,
    });

    return created.toSnapshot();
  }
}
