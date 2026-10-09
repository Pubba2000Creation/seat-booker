import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ROLES, type Role } from '@seat-booker/contracts';
import { PaginationQueryDto } from '../../../../shared/http/pagination-query.dto';
import { toOptionalBoolean, toOptionalTrimmed } from '../../../../shared/http/query-transforms';

/** Query shape for `GET /api/users`. Mirrors `UserFilters` in `packages/contracts`. */
export class ListUsersQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(ROLES as readonly string[], { message: 'role must be ADMIN, MANAGER or STAFF' })
  readonly role?: Role;

  /**
   * Three meaningful states: active only, deactivated only, or either. An absent parameter
   * must therefore stay `undefined` rather than becoming `false` — see `toOptionalBoolean`
   * for why the coercion is explicit.
   */
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean({ message: 'isActive must be true or false' })
  readonly isActive?: boolean;

  @IsOptional()
  @Transform(toOptionalTrimmed)
  @IsString({ message: 'q must be text' })
  @MaxLength(120, { message: 'q is too long' })
  readonly q?: string;
}
