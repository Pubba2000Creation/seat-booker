import type {
  CreateUserRequest,
  Paginated,
  UpdateUserRequest,
  UserFilters,
  UserResponse,
} from '@seat-booker/contracts';
import { request } from '../../lib/api-client';

/** Transport for the admin-only user endpoints. */

export function fetchUsers(
  filters: UserFilters,
  signal?: AbortSignal,
): Promise<Paginated<UserResponse>> {
  return request<Paginated<UserResponse>>('/users', {
    query: {
      role: filters.role,
      // Sent only when the filter is actually set — `isActive` has three meaningful
      // states here (active, deactivated, either), so `undefined` must not become `false`.
      isActive: filters.isActive,
      q: filters.q,
      page: filters.page,
      pageSize: filters.pageSize,
    },
    ...(signal ? { signal } : {}),
  });
}

export function createUser(body: CreateUserRequest): Promise<UserResponse> {
  return request<UserResponse>('/users', { method: 'POST', body });
}

export function updateUser(id: string, body: UpdateUserRequest): Promise<UserResponse> {
  return request<UserResponse>(`/users/${id}`, { method: 'PATCH', body });
}
