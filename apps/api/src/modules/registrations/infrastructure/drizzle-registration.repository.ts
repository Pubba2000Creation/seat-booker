import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, desc, eq, gt, gte, lt, lte, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DATABASE, type Database } from '../../../shared/database/database.module';
import { asPostgresError } from '../../../shared/errors/postgres-error';
import { registrations, users, workshops } from '../../../db/schema';
import { Registration } from '../domain/registration.entity';
import type {
  CancelRegistrationInput,
  CancelResult,
  RegisterAttendeeInput,
  RegisterResult,
  RegistrationPage,
  RegistrationQuery,
  RegistrationRepository,
} from '../domain/registration.repository';

/** Joined aliases so one query can resolve both actors for the History tab. */
const registeredByUser = alias(users, 'registered_by_user');
const cancelledByUser = alias(users, 'cancelled_by_user');

/** SQLSTATE 23505 — the partial unique index rejected a duplicate ACTIVE registration. */
const UNIQUE_VIOLATION = '23505';

/**
 * The only place in the registrations module where SQL and the Drizzle schema exist.
 *
 * This file holds the capacity rule. Read `.claude/skills/capacity-safety/SKILL.md` before
 * changing anything in `register` or `cancel`.
 */
@Injectable()
export class DrizzleRegistrationRepository implements RegistrationRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * Claims a seat, then inserts the registration — one transaction, in that order.
   *
   * WHY THIS IS SAFE UNDER CONCURRENCY
   *
   * The `UPDATE` is a single statement whose `WHERE` re-checks `active_count < capacity`.
   * Postgres takes a row-level lock on the workshop to perform it, so simultaneous claims
   * for the same workshop queue on that lock and each one re-evaluates the condition
   * against the previous winner's COMMITTED value. Exactly `capacity` claims can ever
   * succeed, no matter how many arrive at once. The lock is held until COMMIT, which is why
   * the claim must come first: the insert then happens while no other request can read a
   * stale count.
   *
   * What makes it correct is that `active_count` is never read into JavaScript and written
   * back. The new value is computed by Postgres from the column itself
   * (`active_count + 1`), inside the locked statement.
   *
   * Three independent layers protect the invariant, and all three are required:
   *   1. this conditional UPDATE,
   *   2. `CHECK (active_count <= capacity)` — refuses overbooking even if this code is
   *      wrong,
   *   3. `one_active_registration_per_email` — one ACTIVE registration per email.
   */
  async register(input: RegisterAttendeeInput): Promise<RegisterResult> {
    try {
      return await this.db.transaction(async (tx) => {
        const claimed = await tx
          .update(workshops)
          .set({
            // A `sql` expression referencing the column, NOT a value read earlier and
            // incremented in JS. This is the whole race check.
            activeCount: sql`${workshops.activeCount} + 1`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(workshops.id, input.workshopId),
              // Only an OPEN workshop is bookable (§4.3) ...
              eq(workshops.status, 'OPEN'),
              // ... one that has not started ...
              gt(workshops.startsAt, new Date()),
              // ... and one with a free seat. Column-to-column, evaluated under the lock.
              lt(workshops.activeCount, workshops.capacity),
            ),
          )
          .returning({ id: workshops.id });

        // An empty array IS the authoritative "no seat available" answer. The use-case
        // reads the workshop afterwards to explain which condition failed.
        if (claimed.length === 0) {
          return { outcome: 'NO_SEAT' };
        }

        const inserted = await tx
          .insert(registrations)
          .values({
            workshopId: input.workshopId,
            attendeeName: input.attendeeName,
            // Already lower-cased by the Email VO — the partial unique index depends on it.
            attendeeEmail: input.attendeeEmail,
            status: 'ACTIVE',
            registeredBy: input.registeredBy,
          })
          .returning();

        const row = inserted[0];
        if (row === undefined) {
          throw new Error('Insert into registrations returned no row.');
        }

        // Read back with the actor joined, so the response carries "who registered this".
        // Inside the transaction, so it sees the row just inserted.
        const hydrated = await this.findByIdWithin(tx, row.id);
        if (hydrated === null) {
          throw new Error('Registration vanished within its own transaction.');
        }

        return { outcome: 'REGISTERED', registration: hydrated };
      });
    } catch (error: unknown) {
      /*
       * A unique violation means this email already holds an ACTIVE registration here.
       * The transaction has rolled back, so the seat claim above is undone too — there is
       * no phantom seat to clean up. That is precisely why the increment and the insert
       * are in one transaction.
       */
      const pgError = asPostgresError(error);
      if (
        pgError !== null &&
        pgError.code === UNIQUE_VIOLATION &&
        pgError.constraint_name === 'one_active_registration_per_email'
      ) {
        return { outcome: 'ALREADY_REGISTERED' };
      }

      // Anything else is a genuine failure and belongs to the exception filter. A
      // `CHECK (active_count <= capacity)` violation would land here too, which would mean
      // the conditional UPDATE had been broken — it is mapped to WORKSHOP_FULL by the
      // filter rather than silently swallowed.
      throw error;
    }
  }

  /**
   * Cancels the registration and releases the seat — one transaction.
   *
   * `AND status = 'ACTIVE'` on the UPDATE is what prevents a double decrement. When two
   * staff cancel the same registration simultaneously, the second transaction waits on the
   * first's row lock, then re-evaluates the predicate against the committed CANCELLED row,
   * matches nothing, and reports ALREADY_CANCELLED. The counter therefore drops exactly
   * once however many cancels arrive together.
   *
   * Nothing is deleted. The row keeps who cancelled it, when, and why (§4.4).
   */
  async cancel(input: CancelRegistrationInput): Promise<CancelResult> {
    return this.db.transaction(async (tx) => {
      const cancelled = await tx
        .update(registrations)
        .set({
          status: 'CANCELLED',
          cancelledBy: input.cancelledBy,
          cancelledAt: new Date(),
          cancelReason: input.reason,
        })
        .where(
          and(
            eq(registrations.id, input.registrationId),
            // The guard against a double decrement. Not a JS check on a prior read.
            eq(registrations.status, 'ACTIVE'),
          ),
        )
        .returning({ id: registrations.id, workshopId: registrations.workshopId });

      const row = cancelled[0];

      if (row === undefined) {
        // Either no such registration, or it was not ACTIVE. Distinguish for the message.
        const existing = await tx
          .select({ id: registrations.id })
          .from(registrations)
          .where(eq(registrations.id, input.registrationId))
          .limit(1);

        return existing.length === 0 ? { outcome: 'NOT_FOUND' } : { outcome: 'ALREADY_CANCELLED' };
      }

      // The seat is released in the same transaction as the status change, so the counter
      // and the rows can never disagree. Again a `sql` expression on the column itself.
      // `workshops_count_non_negative` is the backstop if this ever ran twice.
      await tx
        .update(workshops)
        .set({
          activeCount: sql`${workshops.activeCount} - 1`,
          updatedAt: new Date(),
        })
        .where(eq(workshops.id, row.workshopId));

      // Phase 9 note: waitlist promotion belongs HERE, in this transaction, after the
      // decrement — decrement, promote, increment — so `active_count <= capacity` cannot
      // trip mid-transaction.

      const hydrated = await this.findByIdWithin(tx, row.id);
      if (hydrated === null) {
        throw new Error('Registration vanished within its own transaction.');
      }

      return { outcome: 'CANCELLED', registration: hydrated };
    });
  }

  async findById(id: string): Promise<Registration | null> {
    return this.findByIdWithin(this.db, id);
  }

  async findPage(query: RegistrationQuery): Promise<RegistrationPage> {
    const where = this.buildWhere(query);
    const offset = (query.page - 1) * query.pageSize;

    const [rows, totals] = await Promise.all([
      this.baseSelect(this.db)
        .where(where)
        // Newest first: the History tab is read to find out what just happened. `id`
        // breaks ties so pagination is stable.
        .orderBy(desc(registrations.registeredAt), asc(registrations.id))
        .limit(query.pageSize)
        .offset(offset),
      this.db.select({ value: count() }).from(registrations).where(where),
    ]);

    return {
      items: rows.map((row) => this.toDomain(row)),
      total: totals[0]?.value ?? 0,
    };
  }

  /**
   * Shared projection with both actors joined. LEFT joins because `registered_by` and
   * `cancelled_by` are nullable (`ON DELETE SET NULL`) — a registration must still be
   * readable if the staff member's row ever goes, which is also why users are deactivated
   * rather than deleted.
   */
  private baseSelect(db: Database | TransactionHandle) {
    return db
      .select({
        id: registrations.id,
        workshopId: registrations.workshopId,
        attendeeName: registrations.attendeeName,
        attendeeEmail: registrations.attendeeEmail,
        status: registrations.status,
        registeredAt: registrations.registeredAt,
        cancelledAt: registrations.cancelledAt,
        cancelReason: registrations.cancelReason,
        registeredById: registeredByUser.id,
        registeredByName: registeredByUser.name,
        registeredByEmail: registeredByUser.email,
        cancelledById: cancelledByUser.id,
        cancelledByName: cancelledByUser.name,
        cancelledByEmail: cancelledByUser.email,
      })
      .from(registrations)
      .leftJoin(registeredByUser, eq(registrations.registeredBy, registeredByUser.id))
      .leftJoin(cancelledByUser, eq(registrations.cancelledBy, cancelledByUser.id));
  }

  private async findByIdWithin(
    db: Database | TransactionHandle,
    id: string,
  ): Promise<Registration | null> {
    const rows = await this.baseSelect(db).where(eq(registrations.id, id)).limit(1);
    const row = rows[0];
    return row === undefined ? null : this.toDomain(row);
  }

  private buildWhere(query: RegistrationQuery): SQL | undefined {
    const conditions: SQL[] = [];

    if (query.workshopId !== undefined) {
      conditions.push(eq(registrations.workshopId, query.workshopId));
    }

    if (query.email !== undefined && query.email.trim().length > 0) {
      // Exact match on the already-lower-cased column, so `registrations_email_idx` is
      // used. `A@X.com ` and `a@x.com` resolve to the same attendee because the Email VO
      // normalised both before they ever reached the database (§13).
      conditions.push(eq(registrations.attendeeEmail, query.email.trim().toLowerCase()));
    }

    if (query.from !== undefined) {
      conditions.push(gte(registrations.registeredAt, query.from));
    }

    if (query.to !== undefined) {
      conditions.push(lte(registrations.registeredAt, query.to));
    }

    // 'ALL' and undefined both mean every status — the History tab's default.
    if (query.status !== undefined && query.status !== 'ALL') {
      conditions.push(eq(registrations.status, query.status));
    }

    if (conditions.length === 0) return undefined;
    return conditions.length === 1 ? conditions[0] : and(...conditions);
  }

  /** The layer boundary: a joined row in, a domain entity out. */
  private toDomain(row: RegistrationJoinedRow): Registration {
    return Registration.rehydrate({
      id: row.id,
      workshopId: row.workshopId,
      attendeeName: row.attendeeName,
      attendeeEmail: row.attendeeEmail,
      status: row.status,
      // An actor is present only if the join resolved — see `baseSelect` on why it may not.
      registeredBy:
        row.registeredById !== null &&
        row.registeredByName !== null &&
        row.registeredByEmail !== null
          ? {
              id: row.registeredById,
              name: row.registeredByName,
              email: row.registeredByEmail,
            }
          : null,
      registeredAt: row.registeredAt,
      cancelledBy:
        row.cancelledById !== null && row.cancelledByName !== null && row.cancelledByEmail !== null
          ? {
              id: row.cancelledById,
              name: row.cancelledByName,
              email: row.cancelledByEmail,
            }
          : null,
      cancelledAt: row.cancelledAt,
      cancelReason: row.cancelReason,
    });
  }
}

/** The handle Drizzle hands to a `transaction` callback. */
type TransactionHandle = Parameters<Parameters<Database['transaction']>[0]>[0];

/** The shape `baseSelect` produces. Never leaves this file. */
interface RegistrationJoinedRow {
  readonly id: string;
  readonly workshopId: string;
  readonly attendeeName: string;
  readonly attendeeEmail: string;
  readonly status: 'ACTIVE' | 'CANCELLED' | 'WAITLISTED';
  readonly registeredAt: Date;
  readonly cancelledAt: Date | null;
  readonly cancelReason: string | null;
  readonly registeredById: string | null;
  readonly registeredByName: string | null;
  readonly registeredByEmail: string | null;
  readonly cancelledById: string | null;
  readonly cancelledByName: string | null;
  readonly cancelledByEmail: string | null;
}
