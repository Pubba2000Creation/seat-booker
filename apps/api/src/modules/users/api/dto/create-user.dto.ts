import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { ROLES, type Role } from '@seat-booker/contracts';

/**
 * Validated at the edge so `CreateUserUseCase` can trust its input.
 *
 * `ROLES` comes from `packages/contracts`, so adding a role is one edit in one place
 * rather than a literal list that silently drifts from the type.
 */
export class CreateUserDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'name must be provided' })
  @MinLength(1, { message: 'name must be provided' })
  @MaxLength(120, { message: 'name is too long' })
  readonly name!: string;

  // Trimmed and lower-cased BEFORE @IsEmail runs, so capitals and a trailing space are
  // corrected rather than rejected (§13).
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'email must be a valid email address' })
  @MaxLength(254, { message: 'email is too long' })
  readonly email!: string;

  @IsIn(ROLES as readonly string[], { message: 'role must be ADMIN, MANAGER or STAFF' })
  readonly role!: Role;

  /**
   * The initial password, chosen by the admin and handed to the member of staff. A minimum
   * of 8 is a floor, not a policy — there is no rotation or complexity rule in scope, and
   * the upper bound exists because bcrypt silently truncates past 72 bytes.
   */
  @IsString({ message: 'password must be provided' })
  @MinLength(8, { message: 'password must be at least 8 characters' })
  @MaxLength(72, { message: 'password must be 72 characters or fewer' })
  readonly password!: string;
}
