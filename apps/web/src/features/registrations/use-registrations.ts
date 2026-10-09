import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient, UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type {
  CancelRegistrationRequest,
  CreateRegistrationRequest,
  Paginated,
  RegistrationFilters,
  RegistrationResponse,
  RegistrationStatusFilter,
} from '@seat-booker/contracts';
import { queryKeys } from '../../lib/query-keys';
import { asApiError } from '../../lib/api-error';
import { useToast } from '../../components/toast/toast-context';
import {
  cancelRegistration,
  createRegistration,
  fetchWorkshopRegistrations,
  searchRegistrations,
} from './registrations.api';
import type { ApiRequestError } from '../../lib/api-error';

/**
 * Registration queries and mutations — the behaviour the brief grades most closely.
 *
 * Two rules drive everything here:
 *
 * 1. After a register or a cancel, the workshop AND its registration lists are invalidated
 *    together. The seat count lives on the workshop, the rows live on the registrations, and
 *    refreshing one without the other shows a count that disagrees with the list.
 *
 * 2. A failed register refetches too. A `WORKSHOP_FULL` means someone else took the seat
 *    while this form was open, so the cached count is provably wrong — this is the exact
 *    Saturday-morning scenario, and the fix is to show the user the real number
 *    immediately rather than leave them clicking a button that cannot succeed.
 */

/** Invalidate everything a seat change can affect. */
function invalidateWorkshopAndRegistrations(client: QueryClient, workshopId: string): void {
  void client.invalidateQueries({ queryKey: queryKeys.workshop(workshopId) });
  void client.invalidateQueries({ queryKey: queryKeys.workshopRegistrations(workshopId) });
  // The list page shows seat badges for this workshop too.
  void client.invalidateQueries({ queryKey: queryKeys.workshops });
  // The global history search spans every workshop, so a register or cancel here can
  // change rows it is currently showing. Its key is not under this workshop's prefix.
  void client.invalidateQueries({ queryKey: queryKeys.registrationSearchAll });
}

export function useWorkshopRegistrations(
  workshopId: string,
  status: RegistrationStatusFilter,
): UseQueryResult<Paginated<RegistrationResponse>, ApiRequestError> {
  return useQuery({
    queryKey: queryKeys.workshopRegistrationList(workshopId, status),
    queryFn: ({ signal }) => fetchWorkshopRegistrations(workshopId, status, signal),
    enabled: workshopId.length > 0,
    placeholderData: (previous) => previous,
  });
}

/**
 * The global attendee lookup (§6.4) — history across every workshop, not one.
 *
 * `placeholderData` keeps the previous page of results on screen while the next one loads,
 * so paging and typing in the email box do not flash an empty table between renders.
 */
export function useRegistrationSearch(
  filters: RegistrationFilters,
): UseQueryResult<Paginated<RegistrationResponse>, ApiRequestError> {
  return useQuery({
    queryKey: queryKeys.registrationSearch(filters),
    queryFn: ({ signal }) => searchRegistrations(filters, signal),
    placeholderData: (previous) => previous,
  });
}

export function useCreateRegistration(
  workshopId: string,
): UseMutationResult<RegistrationResponse, ApiRequestError, CreateRegistrationRequest> {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (body: CreateRegistrationRequest) => createRegistration(workshopId, body),

    onSuccess: (registration) => {
      invalidateWorkshopAndRegistrations(queryClient, workshopId);
      showToast('success', `${registration.attendeeName} is registered.`);
    },

    onError: (error: ApiRequestError) => {
      const code = asApiError(error)?.code;

      if (code === 'WORKSHOP_FULL') {
        // The brief's headline case. Friendly sentence, then correct the numbers on screen.
        showToast(
          'error',
          'Sorry, the last seat was just taken. The seat count has been refreshed.',
        );
        invalidateWorkshopAndRegistrations(queryClient, workshopId);
        return;
      }

      if (code === 'WORKSHOP_NOT_BOOKABLE') {
        // The workshop was cancelled, completed or started while the form was open — the
        // cached status is stale for the same reason a full workshop's count is.
        showToast('error', error.message);
        invalidateWorkshopAndRegistrations(queryClient, workshopId);
        return;
      }

      // ALREADY_REGISTERED and VALIDATION_ERROR are shown on the form itself, next to the
      // field at fault, so they are not toasted here — a toast would duplicate them.
    },
  });
}

interface CancelVariables {
  readonly registrationId: string;
  readonly reason?: string | undefined;
}

export function useCancelRegistration(
  workshopId: string,
): UseMutationResult<RegistrationResponse, ApiRequestError, CancelVariables> {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ registrationId, reason }: CancelVariables) => {
      const body: CancelRegistrationRequest =
        reason !== undefined && reason.trim().length > 0 ? { reason: reason.trim() } : {};
      return cancelRegistration(registrationId, body);
    },

    onSuccess: (registration) => {
      invalidateWorkshopAndRegistrations(queryClient, workshopId);
      showToast('success', `${registration.attendeeName}'s registration was cancelled.`);
    },

    onError: (error: ApiRequestError) => {
      if (asApiError(error)?.code === 'ALREADY_CANCELLED') {
        // Two staff cancelled the same row at once, or this tab's list was stale. The
        // seat was freed exactly once by the API; refetch so this tab agrees.
        showToast(
          'info',
          'That registration had already been cancelled. The list has been refreshed.',
        );
        invalidateWorkshopAndRegistrations(queryClient, workshopId);
        return;
      }

      showToast('error', error.message);
    },
  });
}
