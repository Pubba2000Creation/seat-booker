import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'seat-booker:isPublic';

/**
 * The explicit opt-out of authentication. Only `POST /api/auth/login` carries it.
 * Both global guards check for it, so a public route needs no `@Roles(...)`.
 */
export function Public(): CustomDecorator<string> {
  return SetMetadata(IS_PUBLIC_KEY, true);
}
