import { Inject, Injectable } from '@nestjs/common';
import type { WorkshopLocation, WorkshopStatus } from '@seat-booker/contracts';
import type { WorkshopSnapshot } from '../domain/workshop.entity';
import {
  DuplicateWorkshopCodeError,
  InvalidWorkshopScheduleError,
} from '../domain/workshop.errors';
import { WORKSHOP_REPOSITORY, type WorkshopRepository } from '../domain/workshop.repository';

export interface CreateWorkshopCommand {
  readonly code: string;
  readonly title: string;
  readonly instructor: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly capacity: number;
  readonly status?: WorkshopStatus;
  readonly location: WorkshopLocation;
  readonly description?: string | null;
  readonly createdBy: string;
}

@Injectable()
export class CreateWorkshopUseCase {
  constructor(@Inject(WORKSHOP_REPOSITORY) private readonly workshops: WorkshopRepository) {}

  async execute(command: CreateWorkshopCommand): Promise<WorkshopSnapshot> {
    const code = command.code.trim();

    if (command.endsAt.getTime() <= command.startsAt.getTime()) {
      throw new InvalidWorkshopScheduleError('The end time must be after the start time.');
    }

    // A NEW workshop cannot start in the past (§6.7). Note this is not applied on update:
    // an existing workshop's start legitimately becomes "past" as time passes, and a
    // manager must still be able to correct its title or mark it COMPLETED afterwards.
    if (command.startsAt.getTime() <= Date.now()) {
      throw new InvalidWorkshopScheduleError(
        'A new workshop cannot start in the past. Please choose a future date and time.',
      );
    }

    // A friendly pre-check so the manager sees the code they typed named back at them.
    // The unique index on `code` is the actual guarantee; a concurrent duplicate is caught
    // there and mapped to the same error code by the exception filter.
    const existing = await this.workshops.findByCode(code);
    if (existing !== null) {
      throw new DuplicateWorkshopCodeError(code);
    }

    const created = await this.workshops.create({
      code,
      title: command.title.trim(),
      instructor: command.instructor.trim(),
      startsAt: command.startsAt,
      endsAt: command.endsAt,
      capacity: command.capacity,
      // DRAFT by default: a workshop should not become bookable the instant it is saved,
      // before the manager has checked the details. They publish it explicitly.
      status: command.status ?? 'DRAFT',
      location: command.location,
      description: command.description ?? null,
      createdBy: command.createdBy,
    });

    return created.toSnapshot();
  }
}
