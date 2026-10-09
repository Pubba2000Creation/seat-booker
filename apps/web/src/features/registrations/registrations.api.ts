import type {
  CancelRegistrationRequest,
  CreateRegistrationRequest,
  Paginated,
  RegistrationFilters,
  RegistrationResponse,
  RegistrationStatusFilter,
} from '@seat-booker/contracts';
import { request } from '../../lib/api-client';

/**
 * Transport for the registration endpoints.
 *
 * Note `cancelRegistration` is a POST, not a DELETE — nothing in this system is ever
 * deleted, and the verb says so. Cancelling is a status change that keeps the history row
 * intact along with who cancelled it and when.
 */

export function fetchWorkshopRegistrations(
  workshopId: string,
  status: RegistrationStatusFilter,
  signal?: AbortSignal,
): Promise<Paginated<RegistrationResponse>> {
  return request<Paginated<RegistrationResponse>>(`/workshops/${workshopId}/registrations`, {
    query: { status, pageSize: 100 },
    ...(signal ? { signal } : {}),
  });
}

export function createRegistration(
  workshopId: string,
  body: CreateRegistrationRequest,
): Promise<RegistrationResponse> {
  return request<RegistrationResponse>(`/workshops/${workshopId}/registrations`, {
    method: 'POST',
    body,
  });
}

export function cancelRegistration(
  registrationId: string,
  body: CancelRegistrationRequest,
): Promise<RegistrationResponse> {
  return request<RegistrationResponse>(`/registrations/${registrationId}/cancel`, {
    method: 'POST',
    body,
  });
}

export function searchRegistrations(
  filters: RegistrationFilters,
  signal?: AbortSignal,
): Promise<Paginated<RegistrationResponse>> {
  return request<Paginated<RegistrationResponse>>('/registrations', {
    query: {
      email: filters.email,
      from: filters.from,
      to: filters.to,
      status: filters.status,
      workshopId: filters.workshopId,
      page: filters.page,
      pageSize: filters.pageSize,
    },
    ...(signal ? { signal } : {}),
  });
}
