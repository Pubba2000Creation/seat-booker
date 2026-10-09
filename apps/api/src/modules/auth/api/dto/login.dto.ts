import { Transform } from 'class-transformer';
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Validated at the edge so `LoginUseCase` can trust its input.
 *
 * Note the email is trimmed and lower-cased by the transform BEFORE `@IsEmail` runs, so a
 * trailing space or capitals are corrected rather than rejected (§13 wants `A@x.com ` and
 * `a@x.com` treated as the same person). The use-case normalises again — it must stay
 * correct when called from a test that bypasses the pipe.
 */
export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254, { message: 'email is too long' })
  readonly email!: string;

  /**
   * Only length-bounded, never format-checked: a password policy on the LOGIN form would
   * reject existing valid passwords, and the lower bound of 1 keeps an empty submission a
   * validation error rather than a bcrypt call. The upper bound exists because bcrypt
   * silently truncates past 72 bytes.
   */
  @IsString({ message: 'password must be provided' })
  @MinLength(1, { message: 'password must be provided' })
  @MaxLength(200, { message: 'password is too long' })
  readonly password!: string;
}
