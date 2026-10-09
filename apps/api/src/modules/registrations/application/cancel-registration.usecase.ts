import { Inject, Injectable } from '@nestjs/common';
import type { RegistrationSnapshot } from '../domain/registration.entity';
import { AlreadyCancelledError, RegistrationNotFoundError } from '../domain/registration.errors';
import {
  REGISTRATION_REPOSITORY,
  type RegistrationRepository,
} from '../domain/registration.repository';

export interface CancelRegistrationCommand {
  readonly registrationId: string;
  readonly cancelledBy: string;
  readonly reason?: string;
}

/**
 * Cancels a registration and frees the seat.
 *
 * As with registering, this use-case does not pre-check the status. The repository's
 * UPDATE carries `AND status = 'ACTIVE'`, which is what makes two simultaneous cancels
 * release the seat exactly once — a read-then-write here would let both pass and
 * decrement the counter twice.
 */
@Injectable()
export class CancelRegistrationUseCase {
  constructor(
    @Inject(REGISTRATION_REPOSITORY) private readonly registrations: RegistrationRepository,
  ) {}

  async execute(command: CancelRegistrationCommand): Promise<RegistrationSnapshot> {
    const reason = command.reason?.trim();

    const result = await this.registrations.cancel({
      registrationId: command.registrationId,
      cancelledBy: command.cancelledBy,
      // An empty reason is stored as NULL rather than an empty string, so "no reason
      // given" is one value in the database instead of two.
      reason: reason !== undefined && reason.length > 0 ? reason : null,
    });

    if (result.outcome === 'NOT_FOUND') {
      throw new RegistrationNotFoundError();
    }

    if (result.outcome === 'ALREADY_CANCELLED') {
      // Also the outcome for the loser of two concurrent cancels — which is the correct
      // answer: the seat was freed, just not by this request.
      throw new AlreadyCancelledError();
    }

    return result.registration.toSnapshot();
  }
}
