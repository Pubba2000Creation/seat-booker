import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import type { Paginated, RegistrationResponse } from '@seat-booker/contracts';
import { AppConfigService } from '../../../shared/config/app-config.service';
import { CurrentUser } from '../../../shared/auth/current-user.decorator';
import { Roles } from '../../../shared/auth/roles.decorator';
import type { AuthenticatedUser } from '../../../shared/auth/authenticated-user';
import { parseRangeBound } from '../../../shared/http/date-range';
import { CancelRegistrationUseCase } from '../application/cancel-registration.usecase';
import { ListRegistrationsUseCase } from '../application/list-registrations.usecase';
import { CancelRegistrationDto } from './dto/cancel-registration.dto';
import { ListRegistrationsQueryDto } from './dto/list-registrations-query.dto';
import { toRegistrationResponse } from './registrations.mapper';

/** Top-level registration routes: cancellation and the global attendee lookup (§6.4). */
@Controller('registrations')
export class RegistrationsController {
  constructor(
    private readonly cancelRegistrationUseCase: CancelRegistrationUseCase,
    private readonly listRegistrationsUseCase: ListRegistrationsUseCase,
    private readonly config: AppConfigService,
  ) {}

  /**
   * The global history / attendee lookup — "has this person booked with us before?".
   *
   * Declared BEFORE `:id/cancel` is irrelevant here (the paths cannot collide), but the
   * date bounds matter: `from`/`to` are calendar dates widened to cover the whole day in
   * the centre's timezone, same as the workshop filters.
   */
  @Roles('MANAGER', 'STAFF')
  @Get()
  async list(@Query() query: ListRegistrationsQueryDto): Promise<Paginated<RegistrationResponse>> {
    const from = parseRangeBound(query.from, 'START_OF_DAY', this.config.centreTimezone);
    const to = parseRangeBound(query.to, 'END_OF_DAY', this.config.centreTimezone);

    const result = await this.listRegistrationsUseCase.execute({
      ...(query.email !== undefined ? { email: query.email } : {}),
      ...(from !== null ? { from } : {}),
      ...(to !== null ? { to } : {}),
      ...(query.status !== undefined ? { status: query.status } : {}),
      ...(query.workshopId !== undefined ? { workshopId: query.workshopId } : {}),
      ...(query.page !== undefined ? { page: query.page } : {}),
      ...(query.pageSize !== undefined ? { pageSize: query.pageSize } : {}),
    });

    return {
      items: result.items.map(toRegistrationResponse),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    };
  }

  /**
   * Cancels a registration and frees the seat.
   *
   * POST, not DELETE: nothing is deleted. The row keeps who cancelled it and when, which
   * is what the History tab reads. 200 rather than 201 — no resource is created.
   *
   * Two staff cancelling at once: one gets 200, the other 409 `ALREADY_CANCELLED`, and the
   * seat is released exactly once.
   */
  @Roles('MANAGER', 'STAFF')
  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelRegistrationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<RegistrationResponse> {
    const cancelled = await this.cancelRegistrationUseCase.execute({
      registrationId: id,
      cancelledBy: actor.id,
      ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
    });

    return toRegistrationResponse(cancelled);
  }
}
