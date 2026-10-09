import { Global, Module } from '@nestjs/common';
import { JwtModule, type JwtModuleOptions } from '@nestjs/jwt';
import { AppConfigService } from '../../shared/config/app-config.service';
import { PASSWORD_HASHER, TOKEN_ISSUER, USER_REPOSITORY } from './domain/user.repository';
import { BcryptPasswordHasher } from './infrastructure/bcrypt-password.hasher';
import { DrizzleUserRepository } from './infrastructure/drizzle-user.repository';
import { JwtTokenIssuer } from './infrastructure/jwt-token.issuer';
import { GetCurrentUserUseCase } from './application/get-current-user.usecase';
import { LoginUseCase } from './application/login.usecase';
import { AuthController } from './api/auth.controller';

/**
 * Every port is wired to its implementation BY TOKEN here. No use-case names a concrete
 * class, which is what lets `LoginUseCase` be unit-tested against in-memory fakes with no
 * database and no bcrypt.
 *
 * `@Global()` because the application-wide `JwtAuthGuard` injects `USER_REPOSITORY` for its
 * per-request active-user lookup. The alternative — importing AuthModule into every feature
 * module purely to satisfy a global guard — is noise that every future module would have to
 * remember, and forgetting it would be a boot failure rather than a security hole.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: (config: AppConfigService): JwtModuleOptions => ({
        secret: config.jwtSecret,
        // Seconds, not the raw "8h" string — see the note on AppConfig.jwtExpiresInSeconds.
        signOptions: { expiresIn: config.jwtExpiresInSeconds },
      }),
      inject: [AppConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    { provide: USER_REPOSITORY, useClass: DrizzleUserRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: TOKEN_ISSUER, useClass: JwtTokenIssuer },
    LoginUseCase,
    GetCurrentUserUseCase,
  ],
  // USER_REPOSITORY and JwtModule are exported for the global guards. PASSWORD_HASHER is
  // exported because Phase 3's Users module needs it to hash new passwords.
  exports: [USER_REPOSITORY, PASSWORD_HASHER, JwtModule],
})
export class AuthModule {}
