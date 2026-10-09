import { Transform } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  WORKSHOP_LOCATIONS,
  WORKSHOP_STATUSES,
  type WorkshopLocation,
  type WorkshopStatus,
} from '@seat-booker/contracts';

/**
 * Every field optional — this is a PATCH, so an absent field means "leave as it is".
 *
 * `endsAt > startsAt` is NOT checked here: a PATCH may move only one of the two, so the
 * rule can only be judged against the merged result, which the use-case does.
 *
 * Capacity may be raised freely. Lowering it below the current active count is refused by
 * the repository's conditional UPDATE with 409 `CAPACITY_BELOW_REGISTRATIONS` — a bound a
 * DTO cannot know, since it depends on live registration data.
 */
export class UpdateWorkshopDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'code must be text' })
  @MinLength(1, { message: 'code must not be empty' })
  @MaxLength(50, { message: 'code is too long' })
  readonly code?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'title must be text' })
  @MinLength(1, { message: 'title must not be empty' })
  @MaxLength(200, { message: 'title is too long' })
  readonly title?: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'instructor must be text' })
  @MinLength(1, { message: 'instructor must not be empty' })
  @MaxLength(120, { message: 'instructor is too long' })
  readonly instructor?: string;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'startsAt must be a valid date and time' })
  readonly startsAt?: string;

  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'endsAt must be a valid date and time' })
  readonly endsAt?: string;

  @IsOptional()
  @IsInt({ message: 'capacity must be a whole number' })
  @Min(1, { message: 'capacity must be at least 1' })
  @Max(1000, { message: 'capacity must be 1000 or fewer' })
  readonly capacity?: number;

  @IsOptional()
  @IsIn(WORKSHOP_STATUSES as readonly string[], {
    message: 'status must be DRAFT, OPEN, CANCELLED or COMPLETED',
  })
  readonly status?: WorkshopStatus;

  @IsOptional()
  @IsIn(WORKSHOP_LOCATIONS as readonly string[], {
    message: 'location must be COLOMBO, KALUTARA or GALLE',
  })
  readonly location?: WorkshopLocation;

  /** An explicit `null` clears the description; `undefined` leaves it untouched. */
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'description must be text' })
  @MaxLength(2000, { message: 'description is too long' })
  readonly description?: string | null;
}
