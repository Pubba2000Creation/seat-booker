import { Inject, Injectable } from '@nestjs/common';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type WorkshopLocation,
  type WorkshopStatus,
} from '@seat-booker/contracts';
import type { WorkshopSnapshot } from '../domain/workshop.entity';
import { WORKSHOP_REPOSITORY, type WorkshopRepository } from '../domain/workshop.repository';

export interface ListWorkshopsQuery {
  readonly from?: Date;
  readonly to?: Date;
  readonly statuses?: readonly WorkshopStatus[];
  readonly hasSeats?: boolean;
  readonly location?: WorkshopLocation;
  readonly q?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface ListWorkshopsResult {
  readonly items: readonly WorkshopSnapshot[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

/**
 * The workshop list (§6.3). Default sort is `startsAt` ascending — staff are looking for
 * what is coming up next, so that ordering is set in the repository rather than being a
 * client choice.
 */
@Injectable()
export class ListWorkshopsUseCase {
  constructor(@Inject(WORKSHOP_REPOSITORY) private readonly workshops: WorkshopRepository) {}

  async execute(query: ListWorkshopsQuery): Promise<ListWorkshopsResult> {
    // Clamped here as well as in the DTO, so a use-case called directly from a test still
    // produces a sane LIMIT.
    const page = Math.max(1, query.page ?? DEFAULT_PAGE);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));

    const result = await this.workshops.findPage({
      ...(query.from !== undefined ? { from: query.from } : {}),
      ...(query.to !== undefined ? { to: query.to } : {}),
      ...(query.statuses !== undefined && query.statuses.length > 0
        ? { statuses: query.statuses }
        : {}),
      ...(query.hasSeats !== undefined ? { hasSeats: query.hasSeats } : {}),
      ...(query.location !== undefined ? { location: query.location } : {}),
      ...(query.q !== undefined ? { q: query.q } : {}),
      page,
      pageSize,
    });

    return {
      items: result.items.map((workshop) => workshop.toSnapshot()),
      page,
      pageSize,
      total: result.total,
    };
  }
}
