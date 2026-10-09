import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { AppConfigModule } from './shared/config/config.module';
import { DatabaseModule } from './shared/database/database.module';
import { AllExceptionsFilter } from './shared/errors/all-exceptions.filter';
import { JwtAuthGuard } from './shared/auth/jwt-auth.guard';
import { RolesGuard } from './shared/auth/roles.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WorkshopsModule } from './modules/workshops/workshops.module';
import { RegistrationsModule } from './modules/registrations/registrations.module';
import { DenyByDefaultProbeController } from './shared/auth/deny-by-default.controller';

/**
 * The deny-by-default proof route is registered in development and test only. Reading
 * NODE_ENV directly here is the one place the app does so: controller registration is a
 * compile-time decision made before the DI container (and therefore AppConfigService)
 * exists, so it cannot go through the config service.
 */
const probeControllers =
  process.env['NODE_ENV'] === 'production' ? [] : [DenyByDefaultProbeController];

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
    WorkshopsModule,
    RegistrationsModule,
  ],
  controllers: [...probeControllers],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },

    /*
     * GUARD ORDER IS LOAD-BEARING. Nest runs APP_GUARD providers in registration order, so
     * JwtAuthGuard runs first and an unauthenticated request gets 401 before RolesGuard
     * ever asks about roles. Swapping these two turns every no-token request into a 403 and
     * breaks the permission-matrix test's 401-vs-403 distinction.
     *
     * Registering them globally is the other half of deny-by-default: a controller added in
     * a later phase is protected the moment it exists, with no decorator to remember.
     */
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
