import type { RegistrationStatus } from '@seat-booker/contracts';

/**
 * A user reduced to what the history view needs to answer "who". Pure domain shape; the
 * api layer maps it to `ActorSummary` from the contracts.
 */
export interface Actor {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

/**
 * The Registration domain entity. Pure TS — imports nothing from Nest, Drizzle, or the
 * schema.
 *
 * Registrations are NEVER deleted (§4.4). Cancelling is a status change, which is what
 * lets the History tab still answer "who cancelled this, and when" long afterwards. There
 * is deliberately no `delete` anywhere in this module.
 */
export interface RegistrationSnapshot {
  readonly id: string;
  readonly workshopId: string;
  readonly attendeeName: string;
  /** Always stored and returned lower-cased — the partial unique index relies on it. */
  readonly attendeeEmail: string;
  readonly status: RegistrationStatus;
  readonly registeredBy: Actor | null;
  readonly registeredAt: Date;
  readonly cancelledBy: Actor | null;
  readonly cancelledAt: Date | null;
  readonly cancelReason: string | null;
}

export class Registration {
  private constructor(
    public readonly id: string,
    public readonly workshopId: string,
    public readonly attendeeName: string,
    public readonly attendeeEmail: string,
    public readonly status: RegistrationStatus,
    public readonly registeredBy: Actor | null,
    public readonly registeredAt: Date,
    public readonly cancelledBy: Actor | null,
    public readonly cancelledAt: Date | null,
    public readonly cancelReason: string | null,
  ) {}

  /** Rehydrates from stored values. Called only from `infrastructure/`. */
  static rehydrate(props: RegistrationSnapshot): Registration {
    return new Registration(
      props.id,
      props.workshopId,
      props.attendeeName,
      props.attendeeEmail,
      props.status,
      props.registeredBy,
      props.registeredAt,
      props.cancelledBy,
      props.cancelledAt,
      props.cancelReason,
    );
  }

  /** Only an ACTIVE registration occupies a seat. */
  get occupiesSeat(): boolean {
    return this.status === 'ACTIVE';
  }

  get isCancelled(): boolean {
    return this.status === 'CANCELLED';
  }

  toSnapshot(): RegistrationSnapshot {
    return {
      id: this.id,
      workshopId: this.workshopId,
      attendeeName: this.attendeeName,
      attendeeEmail: this.attendeeEmail,
      status: this.status,
      registeredBy: this.registeredBy,
      registeredAt: this.registeredAt,
      cancelledBy: this.cancelledBy,
      cancelledAt: this.cancelledAt,
      cancelReason: this.cancelReason,
    };
  }
}
