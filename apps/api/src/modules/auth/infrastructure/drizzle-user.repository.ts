import { Inject, Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../../../shared/database/database.module';
import { users, type UserRow } from '../../../db/schema';
import { User } from '../domain/user.entity';
import type { UserRepository } from '../domain/user.repository';

/**
 * The only place in the auth module where SQL and the Drizzle schema exist. `UserRow`
 * never leaves this file — every method returns a domain `User`.
 */
@Injectable()
export class DrizzleUserRepository implements UserRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async findByEmail(email: string): Promise<User | null> {
    // Compared against `lower(email)` so the `users_email_lower_unique` functional index
    // is actually used. The caller has already normalised, but comparing on the same
    // expression the index is built on is what makes case variants resolve here too.
    const rows = await this.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${email.trim().toLowerCase()}`)
      .limit(1);

    return this.toDomain(rows[0]);
  }

  async findActiveById(id: string): Promise<User | null> {
    // The active filter is in the WHERE clause, not a JS check on the result, so a
    // deactivated user is simply not found. Called once per authenticated request.
    const rows = await this.db
      .select()
      .from(users)
      .where(and(eq(users.id, id), eq(users.isActive, true)))
      .limit(1);

    return this.toDomain(rows[0]);
  }

  /** The layer boundary: a Drizzle row in, a domain entity out. */
  private toDomain(row: UserRow | undefined): User | null {
    if (row === undefined) return null;

    return User.rehydrate({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      passwordHash: row.passwordHash,
    });
  }
}
