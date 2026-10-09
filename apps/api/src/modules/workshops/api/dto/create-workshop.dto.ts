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
 * Validated at the edge so `CreateWorkshopUseCase` can trust its input.
 *
 * Timestamps are validated as ISO 8601 strings here and parsed to `Date` in the
 * controller. They are deliberately NOT transformed into `Date` by this DTO: `@IsISO8601`
 * must see the original string, and a failed `new Date(...)` would otherwise reach the
 * use-case as an `Invalid Date` that every downstream comparison silently answers `false`
 * to.
 */
export class CreateWorkshopDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'code must be provided' })
  @MinLength(1, { message: 'code must be provided' })
  @MaxLength(50, { message: 'code is too long' })
  readonly code!: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'title must be provided' })
  @MinLength(1, { message: 'title must be provided' })
  @MaxLength(200, { message: 'title is too long' })
  readonly title!: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'instructor must be provided' })
  @MinLength(1, { message: 'instructor must be provided' })
  @MaxLength(120, { message: 'instructor is too long' })
  readonly instructor!: string;

  @IsISO8601({ strict: true }, { message: 'startsAt must be a valid date and time' })
  readonly startsAt!: string;

  @IsISO8601({ strict: true }, { message: 'endsAt must be a valid date and time' })
  readonly endsAt!: string;

  /** 1..1000 per §6.7. The DB's `workshops_capacity_positive` is the backstop. */
  @IsInt({ message: 'capacity must be a whole number' })
  @Min(1, { message: 'capacity must be at least 1' })
  @Max(1000, { message: 'capacity must be 1000 or fewer' })
  readonly capacity!: number;

  @IsOptional()
  @IsIn(WORKSHOP_STATUSES as readonly string[], {
    message: 'status must be DRAFT, OPEN, CANCELLED or COMPLETED',
  })
  readonly status?: WorkshopStatus;

  @IsIn(WORKSHOP_LOCATIONS as readonly string[], {
    message: 'location must be COLOMBO, KALUTARA or GALLE',
  })
  readonly location!: WorkshopLocation;

  /**
   * `ValidateIf` rather than `IsOptional`, so an explicit `null` is accepted as "clear the
   * description" while `undefined` means "not supplied". `IsOptional` would skip both and
   * the distinction would be lost.
   */
  @ValidateIf((_object, value) => value !== null && value !== undefined)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'description must be text' })
  @MaxLength(2000, { message: 'description is too long' })
  readonly description?: string | null;
}
