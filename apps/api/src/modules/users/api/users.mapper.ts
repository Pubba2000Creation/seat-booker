import type { UserResponse } from '@seat-booker/contracts';
import type { UserAccountSnapshot } from '../domain/user-account.entity';

/**
 * Domain snapshot -> wire shape. Fields are listed EXPLICITLY rather than spread, so
 * adding a field to the domain can never silently publish it.
 *
 * `UserAccountSnapshot` has no password field at all, which is the real guarantee that no
 * hash can leak from these endpoints; this explicit list is the second line of defence.
 */
export function toUserResponse(snapshot: UserAccountSnapshot): UserResponse {
  return {
    id: snapshot.id,
    name: snapshot.name,
    email: snapshot.email,
    role: snapshot.role,
    isActive: snapshot.isActive,
    // Timestamps cross the wire as ISO 8601 UTC; the frontend renders them in
    // CENTRE_TIMEZONE.
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}
