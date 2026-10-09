import type { WorkshopLocation, WorkshopStatus } from '@seat-booker/contracts';
import type { Workshop } from './workshop.entity';

/**
 * Filters for the workshop list (§6.3). A plain domain shape — the `status` comma list
 * from the query string is already parsed into an array by the time it reaches here, and
 * the dates are already `Date` objects.
 */
export interface WorkshopQuery {
  /** Inclusive lower bound on `startsAt`. */
  readonly from?: Date;
  /** Inclusive upper bound on `startsAt`. */
  readonly to?: Date;
  readonly statuses?: readonly WorkshopStatus[];
  /** `true` keeps only workshops with `activeCount < capacity`. */
  readonly hasSeats?: boolean;
  readonly location?: WorkshopLocation;
  /** Free-text search across code, title and instructor. */
  readonly q?: string;
  readonly page: number;
  readonly pageSize: number;
}

export interface WorkshopPage {
  readonly items: readonly Workshop[];
  readonly total: number;
}

export interface CreateWorkshopInput {
  readonly code: string;
  readonly title: string;
  readonly instructor: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly capacity: number;
  readonly status: WorkshopStatus;
  readonly location: WorkshopLocation;
  readonly description: string | null;
  readonly createdBy: string;
}

/** The fields a manager may change. `undefined` means "leave as it is". */
export interface WorkshopChange {
  readonly code?: string;
  readonly title?: string;
  readonly instructor?: string;
  readonly startsAt?: Date;
  readonly endsAt?: Date;
  readonly capacity?: number;
  readonly status?: WorkshopStatus;
  readonly location?: WorkshopLocation;
  readonly description?: string | null;
}

/**
 * Outcome of an attempted update. `CAPACITY_BELOW_REGISTRATIONS` carries the current count
 * so the use-case can name it in the message — the repository reports what happened, the
 * use-case decides what the client is told.
 */
export type UpdateWorkshopResult =
  | { readonly outcome: 'UPDATED'; readonly workshop: Workshop }
  | { readonly outcome: 'NOT_FOUND' }
  | { readonly outcome: 'CAPACITY_BELOW_REGISTRATIONS'; readonly activeCount: number };

export interface WorkshopRepository {
  findPage(query: WorkshopQuery): Promise<WorkshopPage>;

  findById(id: string): Promise<Workshop | null>;

  /** Matches on the exact stored code. Used for the friendly duplicate pre-check. */
  findByCode(code: string): Promise<Workshop | null>;

  create(input: CreateWorkshopInput): Promise<Workshop>;

  /**
   * Applies the change, refusing a capacity reduction below the current active count.
   *
   * The guard is a condition on the UPDATE itself (`active_count <= :newCapacity`), not a
   * read-then-write in the use-case: a registration committing between a pre-check and the
   * write would otherwise leave `capacity < active_count`, which
   * `workshops_count_within_cap` would then reject as a 500 rather than a clear 409.
   */
  update(id: string, change: WorkshopChange, updatedBy: string): Promise<UpdateWorkshopResult>;
}

export const WORKSHOP_REPOSITORY = Symbol('WorkshopRepository');
