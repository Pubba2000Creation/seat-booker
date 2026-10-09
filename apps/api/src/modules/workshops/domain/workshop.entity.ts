import type { WorkshopLocation, WorkshopStatus } from '@seat-booker/contracts';

/**
 * The Workshop domain entity. Pure TS — imports nothing from Nest, Drizzle, or the schema.
 *
 * `activeCount` is held but never mutated here. The counter is only ever changed by the
 * seat-claim and seat-release SQL in the registrations module, through an expression
 * referencing the column itself. An entity method that incremented it in JS would be the
 * exact race the project exists to prevent, so there is deliberately no such method.
 */
export interface WorkshopSnapshot {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly instructor: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly capacity: number;
  readonly status: WorkshopStatus;
  readonly location: WorkshopLocation;
  readonly description: string | null;
  readonly activeCount: number;
  /** Derived: `capacity - activeCount`. */
  readonly seatsAvailable: number;
  /** Derived: `activeCount === capacity`. Never stored — see below. */
  readonly isFull: boolean;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/** Why a workshop cannot be booked right now. `null` when it can. */
export type NotBookableReason = 'NOT_OPEN' | 'ALREADY_STARTED' | 'FULL';

export class Workshop {
  private constructor(
    public readonly id: string,
    public readonly code: string,
    public readonly title: string,
    public readonly instructor: string,
    public readonly startsAt: Date,
    public readonly endsAt: Date,
    public readonly capacity: number,
    public readonly status: WorkshopStatus,
    public readonly location: WorkshopLocation,
    public readonly description: string | null,
    public readonly activeCount: number,
    public readonly createdBy: string | null,
    public readonly updatedBy: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
  ) {}

  /** Rehydrates from stored values. Called only from `infrastructure/`. */
  static rehydrate(props: {
    readonly id: string;
    readonly code: string;
    readonly title: string;
    readonly instructor: string;
    readonly startsAt: Date;
    readonly endsAt: Date;
    readonly capacity: number;
    readonly status: WorkshopStatus;
    readonly location: WorkshopLocation;
    readonly description: string | null;
    readonly activeCount: number;
    readonly createdBy: string | null;
    readonly updatedBy: string | null;
    readonly createdAt: Date;
    readonly updatedAt: Date;
  }): Workshop {
    return new Workshop(
      props.id,
      props.code,
      props.title,
      props.instructor,
      props.startsAt,
      props.endsAt,
      props.capacity,
      props.status,
      props.location,
      props.description,
      props.activeCount,
      props.createdBy,
      props.updatedBy,
      props.createdAt,
      props.updatedAt,
    );
  }

  /**
   * "Full" is DERIVED, never stored (§4.3). A stored `FULL` status would drift the moment
   * a cancellation freed a seat or a manager raised the capacity; computing it from the
   * counter means it cannot be wrong.
   */
  get isFull(): boolean {
    return this.activeCount >= this.capacity;
  }

  get seatsAvailable(): number {
    // `Math.max` guards the display only. `workshops_count_within_cap` is what actually
    // prevents a negative, so this can never fire in a sound database.
    return Math.max(0, this.capacity - this.activeCount);
  }

  get hasStarted(): boolean {
    return this.startsAt.getTime() <= Date.now();
  }

  /**
   * Explains why a registration would be refused, for the error message only.
   *
   * This is NOT the gate. The authoritative check is the `WHERE` clause of the atomic
   * seat-claim UPDATE, which re-evaluates all three conditions against committed data
   * while holding a row lock. This method runs afterwards, on a row read once the claim
   * has already failed, purely to turn "no seat" into a sentence staff can act on. Using
   * it as a pre-check instead would be the classic count-then-insert race.
   */
  notBookableReason(): NotBookableReason | null {
    if (this.status !== 'OPEN') return 'NOT_OPEN';
    if (this.hasStarted) return 'ALREADY_STARTED';
    if (this.isFull) return 'FULL';
    return null;
  }

  toSnapshot(): WorkshopSnapshot {
    return {
      id: this.id,
      code: this.code,
      title: this.title,
      instructor: this.instructor,
      startsAt: this.startsAt,
      endsAt: this.endsAt,
      capacity: this.capacity,
      status: this.status,
      location: this.location,
      description: this.description,
      activeCount: this.activeCount,
      seatsAvailable: this.seatsAvailable,
      isFull: this.isFull,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
