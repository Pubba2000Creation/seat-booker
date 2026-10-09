import type { RegistrationStatus, RegistrationStatusFilter } from './registration-status.types';

/** A user reduced to what the history view needs to show "who". */
export interface ActorSummary {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

/**
 * A registration as the API returns it. Carries who/when for both the register and the
 * cancel action, which is what makes the History tab answer "who cancelled this?".
 */
export interface RegistrationResponse {
  readonly id: string;
  readonly workshopId: string;
  readonly attendeeName: string;
  /** Always stored and returned lower-cased — the partial unique index relies on it. */
  readonly attendeeEmail: string;
  readonly status: RegistrationStatus;
  readonly registeredBy: ActorSummary | null;
  /** ISO 8601 UTC. */
  readonly registeredAt: string;
  readonly cancelledBy: ActorSummary | null;
  /** ISO 8601 UTC, or null while still ACTIVE. */
  readonly cancelledAt: string | null;
  readonly cancelReason: string | null;
}

export interface CreateRegistrationRequest {
  readonly attendeeName: string;
  readonly attendeeEmail: string;
}

export interface CancelRegistrationRequest {
  readonly reason?: string;
}

/** Query shape for `GET /api/workshops/:id/registrations`. */
export interface WorkshopRegistrationFilters {
  readonly status?: RegistrationStatusFilter;
  readonly page?: number;
  readonly pageSize?: number;
}

/** Query shape for the global history endpoint `GET /api/registrations`. */
export interface RegistrationFilters {
  /** Matched lower-cased. */
  readonly email?: string;
  /** Inclusive lower bound on `registeredAt`. */
  readonly from?: string;
  /** Inclusive upper bound on `registeredAt`. */
  readonly to?: string;
  readonly status?: RegistrationStatusFilter;
  readonly workshopId?: string;
  readonly page?: number;
  readonly pageSize?: number;
}
