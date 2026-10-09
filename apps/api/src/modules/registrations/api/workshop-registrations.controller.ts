import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import type { Paginated, RegistrationResponse } from '@seat-booker/contracts';
import { CurrentUser } from '../../../shared/auth/current-user.decorator';
import { Roles } from '../../../shared/auth/roles.decorator';
import type { AuthenticatedUser } from '../../../shared/auth/authenticated-user';
import { ListRegistrationsUseCase } from '../application/list-registrations.usecase';
import { RegisterAttendeeUseCase } from '../application/register-attendee.usecase';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { WorkshopRegistrationsQueryDto } from './dto/list-registrations-query.dto';
import { toRegistrationResponse } from './registrations.mapper';

/**
 * Registrations nested under a workshop (§6.4).
 *
 * MANAGER and STAFF both register and cancel attendees. ADMIN is deliberately denied here
 * too, per the brief's matrix — recorded in DESIGN.md under Assumptions.
 */
@Controller('workshops/:workshopId/registrations')
export class WorkshopRegistrationsController {
  constructor(
    private readonly registerAttendeeUseCase: RegisterAttendeeUseCase,
    private readonly listRegistrationsUseCase: ListRegistrationsUseCase,
  ) {}

  /**
   * The Saturday-morning endpoint. Returns 201 on success; on a lost race it returns
   * 409 `WORKSHOP_FULL`, which the frontend turns into a friendly toast plus a refetch.
   *
   * `registeredBy` comes from the VERIFIED token, never the body — the history must record
   * who actually did it.
   */
  @Roles('MANAGER', 'STAFF')
  @Post()
  async register(
    @Param('workshopId', ParseUUIDPipe) workshopId: string,
    @Body() dto: CreateRegistrationDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<RegistrationResponse> {
    const registration = await this.registerAttendeeUseCase.execute({
      workshopId,
      attendeeName: dto.attendeeName,
      attendeeEmail: dto.attendeeEmail,
      registeredBy: actor.id,
    });

    return toRegistrationResponse(registration);
  }

  /**
   * The attendee list and the History tab, distinguished only by `?status=`:
   * `ACTIVE` for the current list, `ALL` for the full history including cancellations.
   */
  @Roles('MANAGER', 'STAFF')
  @Get()
  async list(
    @Param('workshopId', ParseUUIDPipe) workshopId: string,
    @Query() query: WorkshopRegistrationsQueryDto,
  ): Promise<Paginated<RegistrationResponse>> {
    const result = await this.listRegistrationsUseCase.execute({
      workshopId,
      ...(query.status !== undefined ? { status: query.status } : {}),
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
}
