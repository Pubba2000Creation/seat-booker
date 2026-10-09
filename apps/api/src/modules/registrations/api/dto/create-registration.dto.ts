import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/** `POST /api/workshops/:id/registrations`. Attendees have no accounts (§4.4). */
export class CreateRegistrationDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'attendeeName must be provided' })
  @MinLength(1, { message: 'attendeeName must be provided' })
  @MaxLength(120, { message: 'attendeeName is too long' })
  readonly attendeeName!: string;

  /**
   * Trimmed and lower-cased BEFORE `@IsEmail` runs, so `A@x.com ` and `a@x.com` are the
   * same attendee (§13) rather than one being rejected. The partial unique index
   * `one_active_registration_per_email` depends on the stored value being normalised.
   */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'attendeeEmail must be a valid email address' })
  @MaxLength(254, { message: 'attendeeEmail is too long' })
  readonly attendeeEmail!: string;
}
