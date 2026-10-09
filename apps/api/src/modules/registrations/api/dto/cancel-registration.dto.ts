import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * `POST /api/registrations/:id/cancel`. POST rather than DELETE because nothing is
 * deleted — cancelling is a status change that keeps the history row (§6.4).
 *
 * The reason is optional: staff cancelling a phone booking in a hurry should not be
 * blocked by a mandatory field.
 */
export class CancelRegistrationDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'reason must be text' })
  @MaxLength(500, { message: 'reason is too long' })
  readonly reason?: string;
}
