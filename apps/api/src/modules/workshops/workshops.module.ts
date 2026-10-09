import { Module } from '@nestjs/common';
import { WORKSHOP_REPOSITORY } from './domain/workshop.repository';
import { DrizzleWorkshopRepository } from './infrastructure/drizzle-workshop.repository';
import { CreateWorkshopUseCase } from './application/create-workshop.usecase';
import { GetWorkshopUseCase } from './application/get-workshop.usecase';
import { ListWorkshopsUseCase } from './application/list-workshops.usecase';
import { UpdateWorkshopUseCase } from './application/update-workshop.usecase';
import { WorkshopsController } from './api/workshops.controller';

/**
 * Workshops CRUD and filters (Phase 4).
 *
 * `WORKSHOP_REPOSITORY` is exported because the registrations module reads a workshop to
 * explain WHY a seat claim failed. It does not use this port to claim seats — that is one
 * transaction spanning two tables, so it lives in a single method on the registrations
 * repository (see the clean-architecture skill on units of work).
 */
@Module({
  controllers: [WorkshopsController],
  providers: [
    { provide: WORKSHOP_REPOSITORY, useClass: DrizzleWorkshopRepository },
    ListWorkshopsUseCase,
    GetWorkshopUseCase,
    CreateWorkshopUseCase,
    UpdateWorkshopUseCase,
  ],
  exports: [WORKSHOP_REPOSITORY],
})
export class WorkshopsModule {}
