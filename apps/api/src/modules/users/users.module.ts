import { Module } from '@nestjs/common';
import { USER_ACCOUNT_REPOSITORY } from './domain/user-account.repository';
import { DrizzleUserAccountRepository } from './infrastructure/drizzle-user-account.repository';
import { CreateUserUseCase } from './application/create-user.usecase';
import { ListUsersUseCase } from './application/list-users.usecase';
import { ResetPasswordUseCase } from './application/reset-password.usecase';
import { UpdateUserUseCase } from './application/update-user.usecase';
import { UsersController } from './api/users.controller';

/**
 * Admin account management (Phase 3).
 *
 * `PASSWORD_HASHER` is not provided here — it comes from the `@Global()` AuthModule, so
 * there is exactly one bcrypt configuration in the application and a cost change cannot
 * apply to login but miss user creation.
 */
@Module({
  controllers: [UsersController],
  providers: [
    { provide: USER_ACCOUNT_REPOSITORY, useClass: DrizzleUserAccountRepository },
    ListUsersUseCase,
    CreateUserUseCase,
    UpdateUserUseCase,
    ResetPasswordUseCase,
  ],
})
export class UsersModule {}
