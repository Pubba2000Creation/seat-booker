import { SetMetadata, type CustomDecorator } from '@nestjs/common';
import type { Role } from '@seat-booker/contracts';

export const ROLES_KEY = 'seat-booker:roles';

/**
 * Declares which roles may call a route. Every non-public route MUST carry this —
 * `RolesGuard` rejects a route with no declaration rather than allowing it through.
 *
 * `/auth/me` names all three roles explicitly rather than being left bare: "any
 * authenticated role" is a decision worth seeing in the code, and a bare route is by
 * definition a mistake here.
 */
export function Roles(...roles: Role[]): CustomDecorator<string> {
  return SetMetadata(ROLES_KEY, roles);
}
