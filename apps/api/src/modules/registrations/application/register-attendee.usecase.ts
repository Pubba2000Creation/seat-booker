import { Inject, Injectable } from '@nestjs/common';
import { Email } from '../../auth/domain/email.vo';
import {
  WORKSHOP_REPOSITORY,
  type WorkshopRepository,
} from '../../workshops/domain/workshop.repository';
import { WorkshopNotFoundError } from '../../workshops/domain/workshop.errors';
import type { RegistrationSnapshot } from '../domain/registration.entity';
import {
  AlreadyRegisteredError,
  LastSeatTakenError,
  WorkshopFullError,
  WorkshopNotBookableError,
} from '../domain/registration.errors';
import {
  REGISTRATION_REPOSITORY,
  type RegistrationRepository,
} from '../domain/registration.repository';

export interface RegisterAttendeeCommand {
  readonly workshopId: string;
  readonly attendeeName: string;
  readonly attendeeEmail: string;
  readonly registeredBy: string;
}

/**
 * Registers an attendee — the core of the brief.
 *
 * Note what this use-case does NOT do: it does not check whether a seat is free before
 * asking for one. That check is the `WHERE` clause of the atomic claim inside the
 * repository's transaction, and it is the only place it can be correct. A pre-check here
 * would be the "24 people for 20 seats" bug: between reading the count and inserting, any
 * number of other requests can commit.
 *
 * So the flow is: ask for a seat, and only if the answer is no, read the workshop to work
 * out which condition failed so staff get a sentence they can act on.
 */
@Injectable()
export class RegisterAttendeeUseCase {
  constructor(
    @Inject(REGISTRATION_REPOSITORY) private readonly registrations: RegistrationRepository,
    @Inject(WORKSHOP_REPOSITORY) private readonly workshops: WorkshopRepository,
  ) {}

  async execute(command: RegisterAttendeeCommand): Promise<RegistrationSnapshot> {
    // The same `Email` VO used by login and user creation, so "the same attendee" means
    // one thing everywhere. The partial unique index depends on the stored value already
    // being trimmed and lower-cased (§13).
    const attendeeEmail = Email.create(command.attendeeEmail);

    const result = await this.registrations.register({
      workshopId: command.workshopId,
      attendeeName: command.attendeeName.trim(),
      attendeeEmail: attendeeEmail.value,
      registeredBy: command.registeredBy,
    });

    if (result.outcome === 'REGISTERED') {
      return result.registration.toSnapshot();
    }

    if (result.outcome === 'ALREADY_REGISTERED') {
      // The partial unique index refused it. Re-registering after a CANCELLATION is
      // allowed and would not reach here — the index only covers ACTIVE rows.
      throw new AlreadyRegisteredError();
    }

    // NO_SEAT. The claim failed as a whole; read the workshop to say which condition did
    // it. This read is on the failure path only, so the happy path stays one statement.
    throw await this.explainFailedClaim(command.workshopId);
  }

  /**
   * Turns a failed claim into the right error. Ordered to match the claim's own `WHERE`
   * conditions so the explanation matches what actually blocked it.
   *
   * By the time this runs the workshop may have changed again (a seat could even have been
   * freed), which is unavoidable and harmless: the claim definitively failed, and this
   * only decides the wording. The state is re-read rather than guessed so the message
   * reflects something that was true, not an assumption.
   */
  private async explainFailedClaim(workshopId: string): Promise<Error> {
    const workshop = await this.workshops.findById(workshopId);

    if (workshop === null) {
      return new WorkshopNotFoundError();
    }

    const reason = workshop.notBookableReason();

    if (reason === 'NOT_OPEN') {
      return new WorkshopNotBookableError(
        workshop.status === 'DRAFT'
          ? 'This workshop is not open for registration yet.'
          : workshop.status === 'CANCELLED'
            ? 'This workshop has been cancelled, so no new registrations can be taken.'
            : 'This workshop has already finished.',
      );
    }

    if (reason === 'ALREADY_STARTED') {
      return new WorkshopNotBookableError(
        'This workshop has already started, so no new registrations can be taken.',
      );
    }

    if (reason === 'FULL') {
      return new WorkshopFullError(workshop.capacity);
    }

    /*
     * The workshop now looks bookable even though the claim failed — someone cancelled in
     * the interval. The claim is still the authority, so this is a loss, not a success:
     * `LastSeatTakenError` carries the same WORKSHOP_FULL code, so the frontend refreshes
     * the seat count and the staff member can simply try again against a seat that is now
     * genuinely free.
     */
    return new LastSeatTakenError();
  }
}
