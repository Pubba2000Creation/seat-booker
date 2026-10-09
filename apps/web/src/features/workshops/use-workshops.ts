import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type {
  CreateWorkshopRequest,
  Paginated,
  UpdateWorkshopRequest,
  WorkshopFilters,
  WorkshopResponse,
} from '@seat-booker/contracts';
import { queryKeys } from '../../lib/query-keys';
import { createWorkshop, fetchWorkshop, fetchWorkshops, updateWorkshop } from './workshops.api';
import type { ApiRequestError } from '../../lib/api-error';

/**
 * Workshop queries and mutations.
 *
 * Seat counts change under the user's feet during the Saturday rush, so lists and details
 * are treated as short-lived: `staleTime` is 0 and both refetch when the window regains
 * focus. Showing a stale "4 seats left" is worse than a brief loading state.
 */

export function useWorkshops(
  filters: WorkshopFilters,
): UseQueryResult<Paginated<WorkshopResponse>, ApiRequestError> {
  return useQuery({
    queryKey: queryKeys.workshopList(filters),
    queryFn: ({ signal }) => fetchWorkshops(filters, signal),
    // Keeps the previous page's rows on screen while the next one loads, so the table
    // does not collapse to a spinner on every filter change.
    placeholderData: (previous) => previous,
  });
}

export function useWorkshop(id: string): UseQueryResult<WorkshopResponse, ApiRequestError> {
  return useQuery({
    queryKey: queryKeys.workshop(id),
    queryFn: ({ signal }) => fetchWorkshop(id, signal),
    enabled: id.length > 0,
  });
}

export function useCreateWorkshop(): UseMutationResult<
  WorkshopResponse,
  ApiRequestError,
  CreateWorkshopRequest
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: CreateWorkshopRequest) => createWorkshop(body),
    onSuccess: (created) => {
      // Every filtered list may now include this workshop.
      void queryClient.invalidateQueries({ queryKey: queryKeys.workshops });
      // Seed the detail cache so navigating straight to the new workshop paints instantly.
      queryClient.setQueryData(queryKeys.workshop(created.id), created);
    },
  });
}

export function useUpdateWorkshop(
  id: string,
): UseMutationResult<WorkshopResponse, ApiRequestError, UpdateWorkshopRequest> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdateWorkshopRequest) => updateWorkshop(id, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.workshop(id), updated);
      void queryClient.invalidateQueries({ queryKey: queryKeys.workshops });
    },
  });
}
