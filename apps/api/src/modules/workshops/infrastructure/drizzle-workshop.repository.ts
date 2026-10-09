import { Inject, Injectable } from '@nestjs/common';
import { and, asc, count, eq, gte, ilike, inArray, lt, lte, or, type SQL } from 'drizzle-orm';
import { DATABASE, type Database } from '../../../shared/database/database.module';
import { workshops, type WorkshopRow } from '../../../db/schema';
import { Workshop } from '../domain/workshop.entity';
import type {
  CreateWorkshopInput,
  UpdateWorkshopResult,
  WorkshopChange,
  WorkshopPage,
  WorkshopQuery,
  WorkshopRepository,
} from '../domain/workshop.repository';

/**
 * The only place in the workshops module where SQL and the Drizzle schema exist.
 * `WorkshopRow` never leaves this file — every method returns a domain `Workshop`.
 */
@Injectable()
export class DrizzleWorkshopRepository implements WorkshopRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findPage(query: WorkshopQuery): Promise<WorkshopPage> {
    const where = this.buildWhere(query);
    const offset = (query.page - 1) * query.pageSize;

    const [rows, totals] = await Promise.all([
      this.db
        .select()
        .from(workshops)
        // Default sort is `startsAt ASC` (§6.3) — staff want what is coming up next. The
        // `workshops_starts_at_idx` and `workshops_status_starts_at_idx` indexes exist for
        // exactly this ordering. `id` breaks ties so pagination is stable across pages
        // when two workshops start at the same moment.
        .orderBy(asc(workshops.startsAt), asc(workshops.id))
        .where(where)
        .limit(query.pageSize)
        .offset(offset),
      this.db.select({ value: count() }).from(workshops).where(where),
    ]);

    return {
      items: rows.map((row) => this.toDomain(row)),
      total: totals[0]?.value ?? 0,
    };
  }

  async findById(id: string): Promise<Workshop | null> {
    const rows = await this.db.select().from(workshops).where(eq(workshops.id, id)).limit(1);
    const row = rows[0];
    return row === undefined ? null : this.toDomain(row);
  }

  async findByCode(code: string): Promise<Workshop | null> {
    const rows = await this.db.select().from(workshops).where(eq(workshops.code, code)).limit(1);
    const row = rows[0];
    return row === undefined ? null : this.toDomain(row);
  }

  async create(input: CreateWorkshopInput): Promise<Workshop> {
    const inserted = await this.db
      .insert(workshops)
      .values({
        code: input.code,
        title: input.title,
        instructor: input.instructor,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        capacity: input.capacity,
        status: input.status,
        location: input.location,
        description: input.description,
        createdBy: input.createdBy,
        updatedBy: input.createdBy,
        // `activeCount` is not set — it defaults to 0 and is thereafter owned exclusively
        // by the register/cancel transactions.
      })
      .returning();

    const row = inserted[0];
    if (row === undefined) {
      throw new Error('Insert into workshops returned no row.');
    }

    return this.toDomain(row);
  }

  /**
   * Applies the change with the capacity guard as a CONDITION on the UPDATE.
   *
   * `active_count <= :newCapacity` in the WHERE clause means Postgres evaluates the guard
   * against committed data while holding the row lock, so a registration committing a
   * microsecond earlier is accounted for. A read-then-write in the use-case could not do
   * that: between its check and its write a seat could be claimed, leaving
   * `capacity < active_count` — which `workshops_count_within_cap` would reject as an
   * opaque 500 instead of a clear 409 naming the real count.
   *
   * Zero rows updated is therefore ambiguous — the workshop might not exist, or the guard
   * might have failed — so a follow-up read distinguishes the two to pick the right error.
   */
  async update(
    id: string,
    change: WorkshopChange,
    updatedBy: string,
  ): Promise<UpdateWorkshopResult> {
    const conditions: SQL[] = [eq(workshops.id, id)];

    if (change.capacity !== undefined) {
      // The guard. Raising capacity always passes; lowering it below the number of people
      // already registered matches no row.
      conditions.push(lte(workshops.activeCount, change.capacity));
    }

    const updated = await this.db
      .update(workshops)
      .set({
        ...(change.code !== undefined ? { code: change.code } : {}),
        ...(change.title !== undefined ? { title: change.title } : {}),
        ...(change.instructor !== undefined ? { instructor: change.instructor } : {}),
        ...(change.startsAt !== undefined ? { startsAt: change.startsAt } : {}),
        ...(change.endsAt !== undefined ? { endsAt: change.endsAt } : {}),
        ...(change.capacity !== undefined ? { capacity: change.capacity } : {}),
        ...(change.status !== undefined ? { status: change.status } : {}),
        ...(change.location !== undefined ? { location: change.location } : {}),
        ...(change.description !== undefined ? { description: change.description } : {}),
        updatedBy,
        updatedAt: new Date(),
      })
      .where(and(...conditions))
      .returning();

    const row = updated[0];
    if (row !== undefined) {
      return { outcome: 'UPDATED', workshop: this.toDomain(row) };
    }

    // Zero rows: work out which condition failed so the caller can say why.
    const current = await this.findById(id);
    if (current === null) {
      return { outcome: 'NOT_FOUND' };
    }

    // It exists, so the capacity guard is what blocked it. Report the count the database
    // actually holds rather than one read before the attempt.
    return { outcome: 'CAPACITY_BELOW_REGISTRATIONS', activeCount: current.activeCount };
  }

  private buildWhere(query: WorkshopQuery): SQL | undefined {
    const conditions: SQL[] = [];

    if (query.from !== undefined) {
      conditions.push(gte(workshops.startsAt, query.from));
    }

    if (query.to !== undefined) {
      conditions.push(lte(workshops.startsAt, query.to));
    }

    if (query.statuses !== undefined && query.statuses.length > 0) {
      conditions.push(inArray(workshops.status, [...query.statuses]));
    }

    if (query.hasSeats === true) {
      // Column-to-column comparison, which is also the race check in the seat claim. "Has
      // seats" is derived from the counter, never from a stored FULL status.
      conditions.push(lt(workshops.activeCount, workshops.capacity));
    }

    if (query.location !== undefined) {
      conditions.push(eq(workshops.location, query.location));
    }

    if (query.q !== undefined && query.q.trim().length > 0) {
      // Searches the three fields staff actually know a workshop by (§6.3). The term is
      // bound as a parameter by the driver — never concatenated into SQL.
      const term = `%${query.q.trim()}%`;
      const search = or(
        ilike(workshops.code, term),
        ilike(workshops.title, term),
        ilike(workshops.instructor, term),
      );
      if (search !== undefined) conditions.push(search);
    }

    if (conditions.length === 0) return undefined;
    return conditions.length === 1 ? conditions[0] : and(...conditions);
  }

  /** The layer boundary: a Drizzle row in, a domain entity out. */
  private toDomain(row: WorkshopRow): Workshop {
    return Workshop.rehydrate({
      id: row.id,
      code: row.code,
      title: row.title,
      instructor: row.instructor,
      startsAt: row.startsAt,
      endsAt: row.endsAt,
      capacity: row.capacity,
      status: row.status,
      location: row.location,
      description: row.description,
      activeCount: row.activeCount,
      createdBy: row.createdBy,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  }
}
