import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import type { Paginated, WorkshopResponse } from '@seat-booker/contracts';
import { AppConfigService } from '../../../shared/config/app-config.service';
import { CurrentUser } from '../../../shared/auth/current-user.decorator';
import { Roles } from '../../../shared/auth/roles.decorator';
import type { AuthenticatedUser } from '../../../shared/auth/authenticated-user';
import { parseRangeBound } from '../../../shared/http/date-range';
import { CreateWorkshopUseCase } from '../application/create-workshop.usecase';
import { GetWorkshopUseCase } from '../application/get-workshop.usecase';
import { ListWorkshopsUseCase } from '../application/list-workshops.usecase';
import { UpdateWorkshopUseCase } from '../application/update-workshop.usecase';
import { CreateWorkshopDto } from './dto/create-workshop.dto';
import { ListWorkshopsQueryDto, parseStatusList } from './dto/list-workshops-query.dto';
import { UpdateWorkshopDto } from './dto/update-workshop.dto';
import { toWorkshopResponse } from './workshops.mapper';

/**
 * Workshops (§6.3).
 *
 * ADMIN is deliberately absent from every route here. The brief's permission matrix marks
 * "Add & edit workshops" and "View workshops" as MANAGER/STAFF only, and that is followed
 * literally — an admin calling these endpoints gets 403, which is recorded in DESIGN.md
 * under Assumptions rather than quietly "fixed".
 */
@Controller('workshops')
export class WorkshopsController {
  constructor(
    private readonly listWorkshopsUseCase: ListWorkshopsUseCase,
    private readonly getWorkshopUseCase: GetWorkshopUseCase,
    private readonly createWorkshopUseCase: CreateWorkshopUseCase,
    private readonly updateWorkshopUseCase: UpdateWorkshopUseCase,
    private readonly config: AppConfigService,
  ) {}

  @Roles('MANAGER', 'STAFF')
  @Get()
  async list(@Query() query: ListWorkshopsQueryDto): Promise<Paginated<WorkshopResponse>> {
    // Date-only bounds are widened to cover the whole calendar day in the centre's
    // timezone — see `shared/http/date-range` for why that matters.
    const from = parseRangeBound(query.from, 'START_OF_DAY', this.config.centreTimezone);
    const to = parseRangeBound(query.to, 'END_OF_DAY', this.config.centreTimezone);
    const statuses = parseStatusList(query.status);

    const result = await this.listWorkshopsUseCase.execute({
      ...(from !== null ? { from } : {}),
      ...(to !== null ? { to } : {}),
      ...(statuses.length > 0 ? { statuses } : {}),
      ...(query.hasSeats !== undefined ? { hasSeats: query.hasSeats } : {}),
      ...(query.location !== undefined ? { location: query.location } : {}),
      ...(query.q !== undefined ? { q: query.q } : {}),
      ...(query.page !== undefined ? { page: query.page } : {}),
      ...(query.pageSize !== undefined ? { pageSize: query.pageSize } : {}),
    });

    return {
      items: result.items.map(toWorkshopResponse),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    };
  }

  @Roles('MANAGER', 'STAFF')
  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string): Promise<WorkshopResponse> {
    const workshop = await this.getWorkshopUseCase.execute(id);
    return toWorkshopResponse(workshop);
  }

  /**
   * MANAGER only — STAFF may register attendees but not create workshops (§2).
   *
   * The timestamps are parsed here rather than in the DTO so `@IsISO8601` validates the
   * original string; by this point the format is already known to be sound.
   */
  @Roles('MANAGER')
  @Post()
  async create(
    @Body() dto: CreateWorkshopDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<WorkshopResponse> {
    const created = await this.createWorkshopUseCase.execute({
      code: dto.code,
      title: dto.title,
      instructor: dto.instructor,
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      capacity: dto.capacity,
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      location: dto.location,
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      createdBy: actor.id,
    });

    return toWorkshopResponse(created);
  }

  @Roles('MANAGER')
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkshopDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<WorkshopResponse> {
    const updated = await this.updateWorkshopUseCase.execute({
      workshopId: id,
      updatedBy: actor.id,
      ...(dto.code !== undefined ? { code: dto.code } : {}),
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.instructor !== undefined ? { instructor: dto.instructor } : {}),
      ...(dto.startsAt !== undefined ? { startsAt: new Date(dto.startsAt) } : {}),
      ...(dto.endsAt !== undefined ? { endsAt: new Date(dto.endsAt) } : {}),
      ...(dto.capacity !== undefined ? { capacity: dto.capacity } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.location !== undefined ? { location: dto.location } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
    });

    return toWorkshopResponse(updated);
  }
}
