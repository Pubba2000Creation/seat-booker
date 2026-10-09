import { Inject, Injectable } from '@nestjs/common';
import type { WorkshopSnapshot } from '../domain/workshop.entity';
import { WorkshopNotFoundError } from '../domain/workshop.errors';
import { WORKSHOP_REPOSITORY, type WorkshopRepository } from '../domain/workshop.repository';

/**
 * A single workshop, including the computed `activeCount`, `seatsAvailable` and `isFull`
 * that the detail page's seat counter reads. The frontend never derives those itself — the
 * backend value wins.
 */
@Injectable()
export class GetWorkshopUseCase {
  constructor(@Inject(WORKSHOP_REPOSITORY) private readonly workshops: WorkshopRepository) {}

  async execute(id: string): Promise<WorkshopSnapshot> {
    const workshop = await this.workshops.findById(id);
    if (workshop === null) {
      throw new WorkshopNotFoundError();
    }

    return workshop.toSnapshot();
  }
}
