import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import type { LoginResponse, UserResponse } from '@seat-booker/contracts';
import { CurrentUser } from '../../../shared/auth/current-user.decorator';
import { Public } from '../../../shared/auth/public.decorator';
import { Roles } from '../../../shared/auth/roles.decorator';
import type { AuthenticatedUser } from '../../../shared/auth/authenticated-user';
import { GetCurrentUserUseCase } from '../application/get-current-user.usecase';
import { LoginUseCase } from '../application/login.usecase';
import { toUserResponse } from './auth.mapper';
import { LoginDto } from './dto/login.dto';

/**
 * HTTP in, one use-case call, map the result out. No business rule lives here — the
 * generic-credentials-message rule, the active check, and the token contents are all
 * decided in `application/` and `domain/`.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
  ) {}

  /**
   * The only public route in the application. There is no signup: the first admin is
   * seeded and admins create every other account (§2).
   */
  @Public()
  @Post('login')
  // 200 rather than Nest's default 201 for POST — logging in creates no resource.
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto): Promise<LoginResponse> {
    const result = await this.loginUseCase.execute({
      email: dto.email,
      password: dto.password,
    });

    return {
      accessToken: result.accessToken,
      user: toUserResponse(result.user),
    };
  }

  /**
   * Roles are declared explicitly as all three rather than left bare. A bare route is
   * rejected by `RolesGuard` by design, so "any authenticated role" has to be stated —
   * and stating it means the permission matrix can be read straight off the controllers.
   *
   * The frontend calls this at bootstrap to decide navigation (ADMIN -> Users,
   * MANAGER/STAFF -> Workshops).
   */
  @Roles('ADMIN', 'MANAGER', 'STAFF')
  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser): Promise<UserResponse> {
    const snapshot = await this.getCurrentUserUseCase.execute(user.id);
    return toUserResponse(snapshot);
  }
}
