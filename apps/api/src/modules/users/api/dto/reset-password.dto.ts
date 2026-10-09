import { IsString, MaxLength, MinLength } from 'class-validator';

/** The admin supplies the new password and passes it on out of band (no email service). */
export class ResetPasswordDto {
  @IsString({ message: 'password must be provided' })
  @MinLength(8, { message: 'password must be at least 8 characters' })
  // bcrypt silently truncates past 72 bytes, so a longer password would not mean what the
  // admin thinks it means.
  @MaxLength(72, { message: 'password must be 72 characters or fewer' })
  readonly password!: string;
}
