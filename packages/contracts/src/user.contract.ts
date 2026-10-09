import type { Role } from './role.types';

/**
 * A user as the API returns it. `passwordHash` is deliberately absent and must never be
 * added — it may not appear in a response, a log, or an audit payload.
 */
export interface UserResponse {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  readonly isActive: boolean;
  /** ISO 8601 UTC. */
  readonly createdAt: string;
  /** ISO 8601 UTC. */
  readonly updatedAt: string;
}

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
}

export interface LoginResponse {
  readonly accessToken: string;
  readonly user: UserResponse;
}

export interface CreateUserRequest {
  readonly name: string;
  readonly email: string;
  readonly role: Role;
  readonly password: string;
}

export interface UpdateUserRequest {
  readonly name?: string;
  readonly role?: Role;
  readonly isActive?: boolean;
}

export interface UserFilters {
  readonly role?: Role;
  readonly isActive?: boolean;
  readonly q?: string;
  readonly page?: number;
  readonly pageSize?: number;
}
