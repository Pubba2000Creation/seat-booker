import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { Paginated, UserResponse } from '@seat-booker/contracts';
import { CurrentUser } from '../../../shared/auth/current-user.decorator';
import { Roles } from '../../../shared/auth/roles.decorator';
import type { AuthenticatedUser } from '../../../shared/auth/authenticated-user';
import { CreateUserUseCase } from '../application/create-user.usecase';
import { ListUsersUseCase } from '../application/list-users.usecase';
import { ResetPasswordUseCase } from '../application/reset-password.usecase';
import { UpdateUserUseCase } from '../application/update-user.usecase';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { toUserResponse } from './users.mapper';

/**
 * Account management — ADMIN only, per the brief's matrix (§2). MANAGER and STAFF get 403
 * on every route here.
 *
 * HTTP in, one use-case call, map the result out. The guard rails (no self-deactivation,
 * no self-demotion, never zero active admins) are enforced in the use-case and repository,
 * not here: a controller that checked them would leave them unenforced for any other
 * caller, and the last-admin rule needs a transaction a controller has no business holding.
 */
@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(
    private readonly listUsersUseCase: ListUsersUseCase,
    private readonly createUserUseCase: CreateUserUseCase,
    private readonly updateUserUseCase: UpdateUserUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
  ) {}

  @Get()
  async list(@Query() query: ListUsersQueryDto): Promise<Paginated<UserResponse>> {
    const result = await this.listUsersUseCase.execute({
      ...(query.role !== undefined ? { role: query.role } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.q !== undefined ? { q: query.q } : {}),
      ...(query.page !== undefined ? { page: query.page } : {}),
      ...(query.pageSize !== undefined ? { pageSize: query.pageSize } : {}),
    });

    return {
      items: result.items.map(toUserResponse),
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
    };
  }

  @Post()
  async create(@Body() dto: CreateUserDto): Promise<UserResponse> {
    const created = await this.createUserUseCase.execute({
      name: dto.name,
      email: dto.email,
      role: dto.role,
      password: dto.password,
    });

    return toUserResponse(created);
  }

  /**
   * The actor's id comes from the VERIFIED token via `@CurrentUser()`, never from the body
   * — that is what makes the self-modification guard rails trustworthy.
   */
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<UserResponse> {
    const updated = await this.updateUserUseCase.execute({
      targetUserId: id,
      actorUserId: actor.id,
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.role !== undefined ? { role: dto.role } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    });

    return toUserResponse(updated);
  }

  /**
   * 204: the new password is already known to the caller (they chose it) and the response
   * must not echo it back into a log or a browser history entry.
   */
  @Post(':id/reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetPasswordDto,
  ): Promise<void> {
    await this.resetPasswordUseCase.execute({
      targetUserId: id,
      newPassword: dto.password,
    });
  }
}
