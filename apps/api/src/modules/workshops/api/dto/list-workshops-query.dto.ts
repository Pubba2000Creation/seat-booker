import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import {
  WORKSHOP_LOCATIONS,
  WORKSHOP_STATUSES,
  isWorkshopStatus,
  type WorkshopLocation,
  type WorkshopStatus,
} from '@seat-booker/contracts';
import { PaginationQueryDto } from '../../../../shared/http/pagination-query.dto';
import { toOptionalBoolean, toOptionalTrimmed } from '../../../../shared/http/query-transforms';

/** Accepts `2026-10-06` or a full ISO instant. Interpreted in `shared/http/date-range`. */
const DATE_OR_DATETIME =
  /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/** Query shape for `GET /api/workshops` (§6.3). Mirrors `WorkshopFilters` in contracts. */
export class ListWorkshopsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(toOptionalTrimmed)
  @Matches(DATE_OR_DATETIME, { message: 'from must be a date like 2026-10-06' })
  readonly from?: string;

  @IsOptional()
  @Transform(toOptionalTrimmed)
  @Matches(DATE_OR_DATETIME, { message: 'to must be a date like 2026-10-18' })
  readonly to?: string;

  /**
   * A comma-separated list, e.g. `OPEN,DRAFT` (§6.3). Validated as a whole string rather
   * than split into an array by the DTO: `forbidNonWhitelisted` would reject a repeated
   * `?status=` parameter, and a single string keeps the contract's `status?: string`
   * honest. `statuses` below does the parsing.
   */
  @IsOptional()
  @Transform(toOptionalTrimmed)
  @IsString({ message: 'status must be text' })
  @MaxLength(200, { message: 'status is too long' })
  readonly status?: string;

  /**
   * "Only with seats" — `activeCount < capacity`. `false` is dropped by the frontend
   * rather than sent, so the off state is the absence of the filter.
   */
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean({ message: 'hasSeats must be true or false' })
  readonly hasSeats?: boolean;

  @IsOptional()
  @IsIn(WORKSHOP_LOCATIONS as readonly string[], {
    message: 'location must be COLOMBO, KALUTARA or GALLE',
  })
  readonly location?: WorkshopLocation;

  @IsOptional()
  @Transform(toOptionalTrimmed)
  @IsString({ message: 'q must be text' })
  @MaxLength(120, { message: 'q is too long' })
  readonly q?: string;
}

/**
 * Parses the comma-separated `status` list into validated statuses, dropping anything
 * unrecognised.
 *
 * A free function rather than a getter on the DTO: the `ValidationPipe` rebuilds the DTO
 * through `plainToInstance` with `whitelist: true`, and relying on accessors surviving
 * that round trip is a subtlety the next reader should not have to verify.
 *
 * Dropping rather than rejecting is deliberate: an unknown status cannot match any row, so
 * the only honest outcomes are "ignore it" or "400". Ignoring keeps a stale bookmark or a
 * renamed status from breaking the page for a non-technical user, and the recognised part
 * of their filter still applies. An all-unrecognised list yields an empty array, which the
 * use-case treats as no status filter at all.
 */
export function parseStatusList(raw: string | undefined): readonly WorkshopStatus[] {
  if (raw === undefined) return [];

  const parsed = raw
    .split(',')
    .map((entry) => entry.trim().toUpperCase())
    .filter(isWorkshopStatus);

  // De-duplicated so `?status=OPEN,OPEN` does not widen the generated IN list.
  return [...new Set(parsed)];
}
