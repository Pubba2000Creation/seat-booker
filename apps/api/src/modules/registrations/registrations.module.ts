import { Module } from '@nestjs/common';
import { WorkshopsModule } from '../workshops/workshops.module';
import { REGISTRATION_REPOSITORY } from './domain/registration.repository';
import { DrizzleRegistrationRepository } from './infrastructure/drizzle-registration.repository';
import { CancelRegistrationUseCase } from './application/cancel-registration.usecase';
import { ListRegistrationsUseCase } from './application/list-registrations.usecase';
import { RegisterAttendeeUseCase } from './application/register-attendee.usecase';
import { RegistrationsController } from './api/registrations.controller';
import { WorkshopRegistrationsController } from './api/workshop-registrations.controller';

/**
 * Registrations and the capacity rule (Phase 5).
 *
 * `WorkshopsModule` is imported for `WORKSHOP_REPOSITORY`, which `RegisterAttendeeUseCase`
 * uses to explain WHY a seat claim failed. It is never used to claim a seat: that is one
 * transaction over two tables, so it lives in a single method on this module's own
 * repository.
 */
@Module({
  imports: [WorkshopsModule],
  controllers: [WorkshopRegistrationsController, RegistrationsController],
  providers: [
    { provide: REGISTRATION_REPOSITORY, useClass: DrizzleRegistrationRepository },
    RegisterAttendeeUseCase,
    CancelRegistrationUseCase,
    ListRegistrationsUseCase,
  ],
})
export class RegistrationsModule {}
