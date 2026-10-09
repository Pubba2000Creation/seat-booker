import { Inject, Injectable } from '@nestjs/common';
import {
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type RegistrationStatusFilter,
} from '@seat-booker/contracts';
import type { RegistrationSnapshot } from '../domain/registration.entity';
import {
  REGISTRATION_REPOSITORY,
  type RegistrationRepository,
} from '../domain/registration.repository';

export interface ListRegistrationsQuery {
  readonly workshopId?: string;
  readonly email?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly status?: RegistrationStatusFilter;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface ListRegistrationsResult {
  readonly items: readonly RegistrationSnapshot[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

/**
 * Serves both registration list endpoints: a workshop's attendee list and history
 * (`GET /workshops/:id/registrations`) and the global attendee lookup
 * (`GET /registrations`). The only difference is whether `workshopId` is set, so one
 * use-case covers both rather than duplicating the filter and pagination logic.
 *
 * Every row carries who registered and who cancelled, with timestamps — that is what makes
 * the History tab answer the question the brief opens with: "nobody knows who cancelled".
 */
@Injectable()
export class ListRegistrationsUseCase {
  constructor(
    @Inject(REGISTRATION_REPOSITORY) private readonly registrations: RegistrationRepository,
  ) {}

  async execute(query: ListRegistrationsQuery): Promise<ListRegistrationsResult> {
    const page = Math.max(1, query.page ?? DEFAULT_PAGE);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));

    const result = await this.registrations.findPage({
      ...(query.workshopId !== undefined ? { workshopId: query.workshopId } : {}),
      ...(query.email !== undefined ? { email: query.email } : {}),
      ...(query.from !== undefined ? { from: query.from } : {}),
      ...(query.to !== undefined ? { to: query.to } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
      page,
      pageSize,
    });

    return {
      items: result.items.map((registration) => registration.toSnapshot()),
      page,
      pageSize,
      total: result.total,
    };
  }
}
