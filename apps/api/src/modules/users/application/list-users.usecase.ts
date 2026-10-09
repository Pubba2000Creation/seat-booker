import { Inject, Injectable } from '@nestjs/common';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, type Role } from '@seat-booker/contracts';
import type { UserAccountSnapshot } from '../domain/user-account.entity';
import {
  USER_ACCOUNT_REPOSITORY,
  type UserAccountRepository,
} from '../domain/user-account.repository';

export interface ListUsersQuery {
  readonly role?: Role;
  readonly isActive?: boolean;
  readonly q?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface ListUsersResult {
  readonly items: readonly UserAccountSnapshot[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

@Injectable()
export class ListUsersUseCase {
  constructor(@Inject(USER_ACCOUNT_REPOSITORY) private readonly users: UserAccountRepository) {}

  async execute(query: ListUsersQuery): Promise<ListUsersResult> {
    // Clamped here rather than trusted from the DTO: the pipe validates the range, but a
    // use-case called directly from a test must still produce a sane LIMIT.
    const page = Math.max(1, query.page ?? DEFAULT_PAGE);
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, query.pageSize ?? DEFAULT_PAGE_SIZE));

    const result = await this.users.findPage({
      ...(query.role !== undefined ? { role: query.role } : {}),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
      ...(query.q !== undefined ? { q: query.q } : {}),
      page,
      pageSize,
    });

    return {
      items: result.items.map((user) => user.toSnapshot()),
      page,
      pageSize,
      total: result.total,
    };
  }
}
