import type { WorkshopResponse } from '@seat-booker/contracts';
import type { WorkshopSnapshot } from '../domain/workshop.entity';

/**
 * Domain snapshot -> wire shape. Fields are listed explicitly rather than spread, so
 * adding a field to the domain can never silently publish it.
 *
 * `activeCount`, `seatsAvailable` and `isFull` are all sent on every response (§6.3). The
 * frontend must never compute capacity state itself — if it did, a cached page could show
 * "2 seats left" while the server knows better, which is precisely the bug the brief is
 * about.
 */
export function toWorkshopResponse(snapshot: WorkshopSnapshot): WorkshopResponse {
  return {
    id: snapshot.id,
    code: snapshot.code,
    title: snapshot.title,
    instructor: snapshot.instructor,
    // Timestamps cross the wire as ISO 8601 UTC; the frontend renders them in
    // CENTRE_TIMEZONE.
    startsAt: snapshot.startsAt.toISOString(),
    endsAt: snapshot.endsAt.toISOString(),
    capacity: snapshot.capacity,
    status: snapshot.status,
    location: snapshot.location,
    description: snapshot.description,
    activeCount: snapshot.activeCount,
    seatsAvailable: snapshot.seatsAvailable,
    isFull: snapshot.isFull,
    createdBy: snapshot.createdBy,
    updatedBy: snapshot.updatedBy,
    createdAt: snapshot.createdAt.toISOString(),
    updatedAt: snapshot.updatedAt.toISOString(),
  };
}
