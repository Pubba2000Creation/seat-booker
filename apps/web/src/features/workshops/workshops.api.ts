import type {
  CreateWorkshopRequest,
  Paginated,
  UpdateWorkshopRequest,
  WorkshopFilters,
  WorkshopResponse,
} from '@seat-booker/contracts';
import { request } from '../../lib/api-client';
import type { QueryParams } from '../../lib/api-client';

/**
 * Thin transport functions for the workshop endpoints. No caching decisions here — those
 * belong to the hooks — and no types of their own: every shape comes from
 * `@seat-booker/contracts`, which is the single source of truth shared with the API.
 */

function toQueryParams(filters: WorkshopFilters): QueryParams {
  return {
    from: filters.from,
    to: filters.to,
    status: filters.status,
    // `hasSeats=false` is dropped rather than sent: the filter means "only with seats", so
    // the off state is the absence of the filter, not a request for full workshops.
    hasSeats: filters.hasSeats === true ? true : undefined,
    location: filters.location,
    q: filters.q,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

export function fetchWorkshops(
  filters: WorkshopFilters,
  signal?: AbortSignal,
): Promise<Paginated<WorkshopResponse>> {
  return request<Paginated<WorkshopResponse>>('/workshops', {
    query: toQueryParams(filters),
    ...(signal ? { signal } : {}),
  });
}

export function fetchWorkshop(id: string, signal?: AbortSignal): Promise<WorkshopResponse> {
  return request<WorkshopResponse>(`/workshops/${id}`, {
    ...(signal ? { signal } : {}),
  });
}

export function createWorkshop(body: CreateWorkshopRequest): Promise<WorkshopResponse> {
  return request<WorkshopResponse>('/workshops', { method: 'POST', body });
}

export function updateWorkshop(id: string, body: UpdateWorkshopRequest): Promise<WorkshopResponse> {
  return request<WorkshopResponse>(`/workshops/${id}`, { method: 'PATCH', body });
}
