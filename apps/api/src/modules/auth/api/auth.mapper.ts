import type { UserResponse } from '@seat-booker/contracts';
import type { UserSnapshot } from '../domain/user.entity';

/**
 * Domain snapshot -> wire shape. A plain function rather than a mapper class, per the
 * pragmatism boundary in the clean-architecture skill.
 *
 * Fields are listed EXPLICITLY rather than spread, so adding a field to the domain can
 * never silently publish it. `passwordHash` is not on `UserSnapshot` at all, which is the
 * real guarantee — this is the second line of defence.
 */
export function toUserResponse(snapshot: UserSnapshot): UserResponse {
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
