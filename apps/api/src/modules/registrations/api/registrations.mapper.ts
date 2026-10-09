import type { ActorSummary, RegistrationResponse } from '@seat-booker/contracts';
import type { Actor, RegistrationSnapshot } from '../domain/registration.entity';

function toActorSummary(actor: Actor | null): ActorSummary | null {
  if (actor === null) return null;
  return { id: actor.id, name: actor.name, email: actor.email };
}

/**
 * Domain snapshot -> wire shape. Fields listed explicitly so adding a domain field cannot
 * silently publish it.
 *
 * Both actors are included: "who registered this" and "who cancelled it, and when" are the
 * questions the brief says nobody can currently answer.
 */
export function toRegistrationResponse(snapshot: RegistrationSnapshot): RegistrationResponse {
  return {
    id: snapshot.id,
    workshopId: snapshot.workshopId,
    attendeeName: snapshot.attendeeName,
    attendeeEmail: snapshot.attendeeEmail,
    status: snapshot.status,
    registeredBy: toActorSummary(snapshot.registeredBy),
    // Timestamps cross the wire as ISO 8601 UTC; the frontend renders them in
    // CENTRE_TIMEZONE.
    registeredAt: snapshot.registeredAt.toISOString(),
    cancelledBy: toActorSummary(snapshot.cancelledBy),
    cancelledAt: snapshot.cancelledAt === null ? null : snapshot.cancelledAt.toISOString(),
    cancelReason: snapshot.cancelReason,
  };
}
