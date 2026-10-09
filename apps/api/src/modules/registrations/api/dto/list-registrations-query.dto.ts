import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { REGISTRATION_STATUSES, type RegistrationStatusFilter } from '@seat-booker/contracts';
import { PaginationQueryDto } from '../../../../shared/http/pagination-query.dto';
import { toOptionalEmail, toOptionalTrimmed } from '../../../../shared/http/query-transforms';

/** `ALL` is accepted alongside the real statuses and means "every status". */
const STATUS_FILTER_VALUES: readonly string[] = [...REGISTRATION_STATUSES, 'ALL'];

const DATE_OR_DATETIME =
  /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/** Query shape for `GET /api/workshops/:id/registrations` — the attendee list and History tab. */
export class WorkshopRegistrationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(STATUS_FILTER_VALUES, {
    message: 'status must be ACTIVE, CANCELLED, WAITLISTED or ALL',
  })
  readonly status?: RegistrationStatusFilter;
}

/** Query shape for `GET /api/registrations` — the global attendee lookup (§6.4). */
export class ListRegistrationsQueryDto extends PaginationQueryDto {
  /**
   * Trimmed and lower-cased so a lookup for `A@X.com ` finds the attendee stored as
   * `a@x.com`. Not `@IsEmail`-checked: a partial or malformed value should return no
   * results rather than a validation error on a search box.
   */
  @IsOptional()
  @Transform(toOptionalEmail)
  @IsString({ message: 'email must be text' })
  @MaxLength(254, { message: 'email is too long' })
  readonly email?: string;

  @IsOptional()
  @Transform(toOptionalTrimmed)
  @Matches(DATE_OR_DATETIME, { message: 'from must be a date like 2026-10-06' })
  readonly from?: string;

  @IsOptional()
  @Transform(toOptionalTrimmed)
  @Matches(DATE_OR_DATETIME, { message: 'to must be a date like 2026-10-18' })
  readonly to?: string;

  @IsOptional()
  @IsIn(STATUS_FILTER_VALUES, {
    message: 'status must be ACTIVE, CANCELLED, WAITLISTED or ALL',
  })
  readonly status?: RegistrationStatusFilter;

  @IsOptional()
  @IsUUID('4', { message: 'workshopId must be a valid id' })
  readonly workshopId?: string;
}
