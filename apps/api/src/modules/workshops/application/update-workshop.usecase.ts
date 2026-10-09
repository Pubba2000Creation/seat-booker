import { Inject, Injectable } from '@nestjs/common';
import type { WorkshopLocation, WorkshopStatus } from '@seat-booker/contracts';
import type { WorkshopSnapshot } from '../domain/workshop.entity';
import {
  CapacityBelowRegistrationsError,
  DuplicateWorkshopCodeError,
  InvalidWorkshopScheduleError,
  WorkshopNotFoundError,
} from '../domain/workshop.errors';
import { WORKSHOP_REPOSITORY, type WorkshopRepository } from '../domain/workshop.repository';

export interface UpdateWorkshopCommand {
  readonly workshopId: string;
  readonly updatedBy: string;
  readonly code?: string;
  readonly title?: string;
  readonly instructor?: string;
  readonly startsAt?: Date;
  readonly endsAt?: Date;
  readonly capacity?: number;
  readonly status?: WorkshopStatus;
  readonly location?: WorkshopLocation;
  readonly description?: string | null;
}

/**
 * Edits a workshop (MANAGER only). The capacity reduction guard is the interesting part —
 * see the repository for why it is a condition on the UPDATE rather than a check here.
 */
@Injectable()
export class UpdateWorkshopUseCase {
  constructor(@Inject(WORKSHOP_REPOSITORY) private readonly workshops: WorkshopRepository) {}

  async execute(command: UpdateWorkshopCommand): Promise<WorkshopSnapshot> {
    const existing = await this.workshops.findById(command.workshopId);
    if (existing === null) {
      throw new WorkshopNotFoundError();
    }

    const code = command.code?.trim();

    /*
     * Schedule validation against the MERGED result, not the request.
     *
     * A PATCH may move only `startsAt` or only `endsAt`, so "ends after starts" can only
     * be judged by combining the change with what is already stored — a DTO looking at the
     * body alone cannot see the other half. `workshops_ends_after_starts` remains the
     * backstop if this is ever bypassed.
     */
    const startsAt = command.startsAt ?? existing.startsAt;
    const endsAt = command.endsAt ?? existing.endsAt;

    if (endsAt.getTime() <= startsAt.getTime()) {
      throw new InvalidWorkshopScheduleError('The end time must be after the start time.');
    }

    // Deliberately NOT re-checking "must not start in the past" on update: an existing
    // workshop's start time slides into the past simply as time passes, and a manager must
    // still be able to fix a typo or mark it COMPLETED. The past-start rule guards
    // creation only (§6.7).

    if (code !== undefined && code !== existing.code) {
      const clash = await this.workshops.findByCode(code);
      if (clash !== null) {
        throw new DuplicateWorkshopCodeError(code);
      }
    }

    const change = {
      ...(code !== undefined ? { code } : {}),
      ...(command.title !== undefined ? { title: command.title.trim() } : {}),
      ...(command.instructor !== undefined ? { instructor: command.instructor.trim() } : {}),
      ...(command.startsAt !== undefined ? { startsAt: command.startsAt } : {}),
      ...(command.endsAt !== undefined ? { endsAt: command.endsAt } : {}),
      ...(command.capacity !== undefined ? { capacity: command.capacity } : {}),
      ...(command.status !== undefined ? { status: command.status } : {}),
      ...(command.location !== undefined ? { location: command.location } : {}),
      ...(command.description !== undefined ? { description: command.description } : {}),
    };

    // Nothing to change. Returning current state keeps the endpoint idempotent rather than
    // issuing an UPDATE with an empty SET, which Drizzle rejects.
    if (Object.keys(change).length === 0) {
      return existing.toSnapshot();
    }

    const result = await this.workshops.update(command.workshopId, change, command.updatedBy);

    if (result.outcome === 'NOT_FOUND') {
      throw new WorkshopNotFoundError();
    }

    if (result.outcome === 'CAPACITY_BELOW_REGISTRATIONS') {
      // `capacity` is necessarily defined on this branch — the repository only reports
      // this outcome when a capacity reduction was requested — but the count comes from
      // the repository's own read so the number is the one the DB saw, not a stale one.
      throw new CapacityBelowRegistrationsError(
        command.capacity ?? existing.capacity,
        result.activeCount,
      );
    }

    return result.workshop.toSnapshot();
  }
}
