import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import { DATABASE, type Database } from '../../../shared/database/database.module';
import { users, type UserRow } from '../../../db/schema';
import { UserAccount } from '../domain/user-account.entity';
import type {
  CreateUserAccountInput,
  UpdateUserAccountResult,
  UserAccountChange,
  UserAccountPage,
  UserAccountQuery,
  UserAccountRepository,
} from '../domain/user-account.repository';

/**
 * Thrown inside the update transaction to abort it when the change would leave no active
 * admin, and caught by the same method. Private to this file: it exists only to make
 * Postgres roll back, and it is translated into a domain outcome before anything else can
 * see it. A domain error class would be wrong here — `infrastructure/` reports outcomes,
 * it does not decide what the client is told.
 */
class LastAdminRollback extends Error {
  constructor() {
    super('Rolled back: the change would leave no active administrator.');
    this.name = 'LastAdminRollback';
    Object.setPrototypeOf(this, LastAdminRollback.prototype);
  }
}

/**
 * The only place in the users module where SQL and the Drizzle schema exist. `UserRow`
 * never leaves this file — every method returns a domain `UserAccount`.
 */
@Injectable()
export class DrizzleUserAccountRepository implements UserAccountRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findPage(query: UserAccountQuery): Promise<UserAccountPage> {
    const where = this.buildWhere(query);
    const offset = (query.page - 1) * query.pageSize;

    // The count runs against the same predicate as the page so `total` describes the
    // filtered set, not the table. Two statements rather than a window function: at ~15
    // staff the clarity is worth more than the round trip.
    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(users)
        .where(where)
        .orderBy(asc(users.name), asc(users.id))
        .limit(query.pageSize)
        .offset(offset),
      this.db.select({ value: count() }).from(users).where(where),
    ]);

    return {
      items: rows.map((row) => this.toDomain(row)),
      total: totals[0]?.value ?? 0,
    };
  }

  async findById(id: string): Promise<UserAccount | null> {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    const row = rows[0];
    return row === undefined ? null : this.toDomain(row);
  }

  async existsByEmail(email: string): Promise<boolean> {
    // Compared on `lower(email)` — the same expression `users_email_lower_unique` is built
    // on, so the index is used and case variants resolve to the same account.
    const rows = await this.db
      .select({ id: users.id })
      .from(users)
      .where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`)
      .limit(1);

    return rows.length > 0;
  }

  async create(input: CreateUserAccountInput): Promise<UserAccount> {
    const inserted = await this.db
      .insert(users)
      .values({
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        role: input.role,
      })
      .returning();

    const row = inserted[0];
    if (row === undefined) {
      // An INSERT ... RETURNING that yields nothing is not a condition the application can
      // recover from or explain to staff; it means the driver contract was broken.
      throw new Error('Insert into users returned no row.');
    }

    return this.toDomain(row);
  }

  /**
   * Applies the change and re-checks the last-active-admin invariant in ONE transaction.
   *
   * The ordering is what makes it safe: the UPDATE runs first and takes a row lock on the
   * target, THEN the admin count is read. A concurrent transaction demoting a different
   * admin must either commit before this one starts (so its effect is visible in the
   * count) or wait (so it will see this one's effect). Either way the pair cannot both
   * observe a count that lets them both through, so the system cannot reach zero active
   * admins. Rolling back on a failed check undoes the UPDATE.
   *
   * Counting after the write also means the check needs no special cases — "is the target
   * the last admin" and "is anyone else still an admin" collapse into one question asked
   * of the post-change state.
   */
  async update(id: string, change: UserAccountChange): Promise<UpdateUserAccountResult> {
    try {
      return await this.db.transaction(async (tx) => {
        const updated = await tx
          .update(users)
          .set({
            ...(change.name !== undefined ? { name: change.name } : {}),
            ...(change.role !== undefined ? { role: change.role } : {}),
            ...(change.isActive !== undefined ? { isActive: change.isActive } : {}),
            updatedAt: new Date(),
          })
          .where(eq(users.id, id))
          .returning();

        const row = updated[0];
        if (row === undefined) {
          return { outcome: 'NOT_FOUND' };
        }

        // Only ask when the change could plausibly remove an admin. A rename never can,
        // and skipping the count keeps the common case to a single statement.
        const couldRemoveAdmin = change.role !== undefined || change.isActive === false;

        if (couldRemoveAdmin) {
          const admins = await tx
            .select({ value: count() })
            .from(users)
            .where(and(eq(users.role, 'ADMIN'), eq(users.isActive, true)));

          if ((admins[0]?.value ?? 0) === 0) {
            // Aborts the transaction, undoing the UPDATE above. Caught below and reported
            // as an outcome; the use-case turns it into 409 LAST_ADMIN.
            throw new LastAdminRollback();
          }
        }

        return { outcome: 'UPDATED', user: this.toDomain(row) };
      });
    } catch (error: unknown) {
      if (error instanceof LastAdminRollback) {
        return { outcome: 'LAST_ADMIN' };
      }
      // Anything else is a genuine failure — a driver error, a constraint violation — and
      // belongs to the exception filter, not to this method.
      throw error;
    }
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<boolean> {
    const updated = await this.db
      .update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning({ id: users.id });

    return updated.length > 0;
  }

  private buildWhere(query: UserAccountQuery): SQL | undefined {
    const conditions: SQL[] = [];

    if (query.role !== undefined) {
      conditions.push(eq(users.role, query.role));
    }

    if (query.isActive !== undefined) {
      conditions.push(eq(users.isActive, query.isActive));
    }

    if (query.q !== undefined && query.q.trim().length > 0) {
      // `ilike` with the term escaped by the driver's parameter binding — never string
      // concatenation. `%` and `_` typed by a user are matched literally only if escaped,
      // which is not worth doing here: a stray wildcard broadens a search, it does not
      // leak anything.
      const term = `%${query.q.trim()}%`;
      const search = or(ilike(users.name, term), ilike(users.email, term));
      if (search !== undefined) conditions.push(search);
    }

    if (conditions.length === 0) return undefined;
    return conditions.length === 1 ? conditions[0] : and(...conditions);
  }

  /** The layer boundary: a Drizzle row in, a domain entity out. No `passwordHash`. */
  private toDomain(row: UserRow): UserAccount {
    return UserAccount.rehydrate({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
