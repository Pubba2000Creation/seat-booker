import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { MAX_PAGE_SIZE } from '@seat-booker/contracts';
import { toOptionalInteger } from './query-transforms';

/**
 * Pagination fields shared by every list endpoint. Extended rather than copied, so the
 * bounds are defined once — `MAX_PAGE_SIZE` is capped here AND clamped again in each
 * use-case, because a use-case called directly from a test bypasses this pipe.
 */
export class PaginationQueryDto {
  @IsOptional()
  @Transform(toOptionalInteger)
  @IsInt({ message: 'page must be a whole number' })
  @Min(1, { message: 'page must be 1 or more' })
  readonly page?: number;

  @IsOptional()
  @Transform(toOptionalInteger)
  @IsInt({ message: 'pageSize must be a whole number' })
  @Min(1, { message: 'pageSize must be 1 or more' })
  @Max(MAX_PAGE_SIZE, { message: `pageSize must be ${MAX_PAGE_SIZE} or fewer` })
  readonly pageSize?: number;
}
