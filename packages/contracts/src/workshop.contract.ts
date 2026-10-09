import type { WorkshopLocation, WorkshopStatus } from './workshop-status.types';

/**
 * A workshop as the API returns it.
 *
 * `activeCount`, `seatsAvailable` and `isFull` are computed server-side and sent on every
 * response. The frontend must never derive capacity state itself — the backend value wins.
 */
export interface WorkshopResponse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly instructor: string;
  /** ISO 8601 UTC. */
  readonly startsAt: string;
  /** ISO 8601 UTC. Always later than `startsAt` (DB CHECK). */
  readonly endsAt: string;
  readonly capacity: number;
  readonly status: WorkshopStatus;
  readonly location: WorkshopLocation;
  readonly description: string | null;
  /** Authoritative denormalised count of ACTIVE registrations. */
  readonly activeCount: number;
  /** `capacity - activeCount`, never negative (DB CHECK). */
  readonly seatsAvailable: number;
  /** Derived, never stored: `activeCount === capacity`. */
  readonly isFull: boolean;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  /** ISO 8601 UTC. */
  readonly createdAt: string;
  /** ISO 8601 UTC. */
  readonly updatedAt: string;
}

export interface CreateWorkshopRequest {
  readonly code: string;
  readonly title: string;
  readonly instructor: string;
  /** ISO 8601. Must not be in the past. */
  readonly startsAt: string;
  /** ISO 8601. Must be later than `startsAt`. */
  readonly endsAt: string;
  /** Integer 1..1000. */
  readonly capacity: number;
  readonly status?: WorkshopStatus;
  readonly location: WorkshopLocation;
  readonly description?: string | null;
}

export interface UpdateWorkshopRequest {
  readonly code?: string;
  readonly title?: string;
  readonly instructor?: string;
  readonly startsAt?: string;
  readonly endsAt?: string;
  /**
   * Cannot be reduced below the current active count — the API answers
   * 409 `CAPACITY_BELOW_REGISTRATIONS`.
   */
  readonly capacity?: number;
  readonly status?: WorkshopStatus;
  readonly location?: WorkshopLocation;
  readonly description?: string | null;
}

/** Query shape for `GET /api/workshops`. Default sort is `startsAt` ascending. */
export interface WorkshopFilters {
  /** Inclusive lower bound on `startsAt`. ISO date or date-time. */
  readonly from?: string;
  /** Inclusive upper bound on `startsAt`. ISO date or date-time. */
  readonly to?: string;
  /** Comma-separated list, e.g. `OPEN,DRAFT`. */
  readonly status?: string;
  /** `true` keeps only workshops where `activeCount < capacity`. */
  readonly hasSeats?: boolean;
  readonly location?: WorkshopLocation;
  /** Free-text search across code, title and instructor. */
  readonly q?: string;
  readonly page?: number;
  readonly pageSize?: number;
}
