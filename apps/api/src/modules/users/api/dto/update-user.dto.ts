import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ROLES, type Role } from '@seat-booker/contracts';

/**
 * Every field optional — this is a PATCH, so an absent field means "leave as it is".
 *
 * Email is deliberately NOT editable. It is the login identifier and the key history is
 * read by; changing it would silently reassign which account a past action belongs to.
 * An admin deactivates the old account and creates a new one instead.
 */
export class UpdateUserDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'name must be text' })
  @MinLength(1, { message: 'name must not be empty' })
  @MaxLength(120, { message: 'name is too long' })
  readonly name?: string;

  @IsOptional()
  @IsIn(ROLES as readonly string[], { message: 'role must be ADMIN, MANAGER or STAFF' })
  readonly role?: Role;

  /**
   * Deactivate or reactivate. There is no delete: history rows reference this account via
   * `registered_by` / `cancelled_by` and must stay resolvable.
   *
   * `@IsBoolean` with no transform, so `"false"` as a string is a validation error rather
   * than being coerced to `true` — a silent coercion here would deactivate the wrong way
   * round. The global pipe has `enableImplicitConversion: false`, which is what makes that
   * the actual behaviour.
   */
  @IsOptional()
  @IsBoolean({ message: 'isActive must be true or false' })
  readonly isActive?: boolean;
}
