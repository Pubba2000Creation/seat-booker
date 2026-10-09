import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/*
 * ---------------------------------------------------------------------------
 * Enums
 * ---------------------------------------------------------------------------
 * pgEnum definitions stay inside the API. `packages/contracts` mirrors these as
 * union literals so the frontend needs no runtime import from the backend.
 * The two must be kept in step — a new value means a change in both places.
 */

export const roleEnum = pgEnum('role', ['ADMIN', 'MANAGER', 'STAFF']);

export const workshopStatusEnum = pgEnum('workshop_status', [
  'DRAFT',
  'OPEN',
  'CANCELLED',
  'COMPLETED',
]);

export const registrationStatusEnum = pgEnum('registration_status', [
  'ACTIVE',
  'CANCELLED',
  'WAITLISTED',
]);

export const workshopLocationEnum = pgEnum('workshop_location', ['COLOMBO', 'KALUTARA', 'GALLE']);

/*
 * ---------------------------------------------------------------------------
 * users
 * ---------------------------------------------------------------------------
 * DESIGN DECISION — case-insensitive email uniqueness.
 *
 * Chosen: a plain `text` column plus a UNIQUE index on `lower(email)`, combined with
 * application-level trimming and lower-casing before any storage or comparison.
 *
 * Rejected: the `citext` extension. Reasons:
 *   1. `citext` needs `CREATE EXTENSION`, which requires superuser on many managed
 *      Postgres hosts (Neon/RDS vary). A unique functional index needs no extension,
 *      so the schema stays portable and a reviewer's `docker compose up` is enough.
 *   2. drizzle-kit has no first-class `citext` column type, so it would need a custom
 *      type plus a hand-written extension migration — more moving parts to get wrong.
 *   3. Lower-casing in the application is required anyway: the brief (§13) wants
 *      `A@x.com ` and `a@x.com` treated as the same person, and attendee emails on
 *      `registrations` depend on it for the partial unique index. Doing it in one place
 *      for both tables is more consistent than citext for users and app-level for
 *      registrations.
 *
 * Consequence: every read path must compare with `lower(email)` (or against an already
 * lower-cased value) so the index is actually used. Login does exactly that.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    /** Stored trimmed and lower-cased. Uniqueness is enforced on `lower(email)`. */
    email: text('email').notNull(),
    /** bcrypt hash. Never returned in an API response, log, or audit payload. */
    passwordHash: text('password_hash').notNull(),
    role: roleEnum('role').notNull(),
    /** Users are deactivated, never deleted, so history references stay valid. */
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_email_lower_unique').on(sql`lower(${t.email})`),
    index('users_role_idx').on(t.role),
  ],
);

/*
 * ---------------------------------------------------------------------------
 * workshops
 * ---------------------------------------------------------------------------
 * `activeCount` is a denormalised counter of ACTIVE registrations and is the heart of
 * the capacity rule. It is written ONLY by the register and cancel transactions, and
 * only ever through a `sql` expression referencing the column itself
 * (`active_count + 1` / `active_count - 1`) — never read into JS, incremented, and
 * written back, which would reintroduce the race.
 *
 * The four CHECK constraints below are the last line of defence: even if application
 * code has a bug, Postgres refuses to store an overbooked row.
 */
export const workshops = pgTable(
  'workshops',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Human-facing identifier, e.g. `POT-2026-10-11`. */
    code: text('code').notNull().unique(),
    title: text('title').notNull(),
    instructor: text('instructor').notNull(),
    startsAt: timestamp('starts_at', { withTimezone: true, mode: 'date' }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true, mode: 'date' }).notNull(),
    capacity: integer('capacity').notNull(),
    status: workshopStatusEnum('status').notNull().default('DRAFT'),
    location: workshopLocationEnum('location').notNull(),
    description: text('description'),
    /** Authoritative count of ACTIVE registrations. See the note above. */
    activeCount: integer('active_count').notNull().default(0),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    check('workshops_capacity_positive', sql`${t.capacity} > 0`),
    check('workshops_count_non_negative', sql`${t.activeCount} >= 0`),
    // The constraint that makes overbooking physically impossible.
    check('workshops_count_within_cap', sql`${t.activeCount} <= ${t.capacity}`),
    check('workshops_ends_after_starts', sql`${t.endsAt} > ${t.startsAt}`),
    // Default list sort is `starts_at ASC`; the status filter is the common companion.
    index('workshops_starts_at_idx').on(t.startsAt),
    index('workshops_status_starts_at_idx').on(t.status, t.startsAt),
  ],
);

/*
 * ---------------------------------------------------------------------------
 * registrations
 * ---------------------------------------------------------------------------
 * Never deleted. Cancelling is a status change, which is what keeps the History tab
 * able to answer "who cancelled this, and when".
 *
 * Re-registering after a cancellation is allowed and creates a NEW row — hence the
 * uniqueness rule is partial (`WHERE status = 'ACTIVE'`) rather than total.
 */
export const registrations = pgTable(
  'registrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workshopId: uuid('workshop_id')
      .notNull()
      .references(() => workshops.id, { onDelete: 'restrict' }),
    /** Attendees have no user accounts — name and email are captured per registration. */
    attendeeName: text('attendee_name').notNull(),
    /** Stored trimmed and lower-cased. The partial unique index below depends on it. */
    attendeeEmail: text('attendee_email').notNull(),
    status: registrationStatusEnum('status').notNull().default('ACTIVE'),
    registeredBy: uuid('registered_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    registeredAt: timestamp('registered_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    cancelledBy: uuid('cancelled_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' }),
    cancelReason: text('cancel_reason'),
  },
  (t) => [
    // One ACTIVE registration per email per workshop. Partial, so cancelled rows
    // accumulate freely and a re-registration is permitted.
    uniqueIndex('one_active_registration_per_email')
      .on(t.workshopId, t.attendeeEmail)
      .where(sql`status = 'ACTIVE'`),
    index('registrations_workshop_status_idx').on(t.workshopId, t.status),
    index('registrations_email_idx').on(t.attendeeEmail),
  ],
);

/*
 * ---------------------------------------------------------------------------
 * audit_logs (bonus — Phase 9)
 * ---------------------------------------------------------------------------
 * Rows are written inside the SAME transaction as the change they describe, so the log
 * can never disagree with the data. `before`/`after` must never contain `passwordHash`.
 */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id').notNull(),
    before: jsonb('before'),
    after: jsonb('after'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_logs_entity_idx').on(t.entityType, t.entityId),
    index('audit_logs_actor_idx').on(t.actorId),
    index('audit_logs_created_at_idx').on(t.createdAt),
  ],
);

/* Row types for the infrastructure layer. These must never leak past `infrastructure/`. */
export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
export type WorkshopRow = typeof workshops.$inferSelect;
export type NewWorkshopRow = typeof workshops.$inferInsert;
export type RegistrationRow = typeof registrations.$inferSelect;
export type NewRegistrationRow = typeof registrations.$inferInsert;
export type AuditLogRow = typeof auditLogs.$inferSelect;
export type NewAuditLogRow = typeof auditLogs.$inferInsert;
