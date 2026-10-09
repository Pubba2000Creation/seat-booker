import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import type {
  CreateUserRequest,
  Paginated,
  UpdateUserRequest,
  UserFilters,
  UserResponse,
} from '@seat-booker/contracts';
import { queryKeys } from '../../lib/query-keys';
import { useToast } from '../../components/toast/toast-context';
import { createUser, fetchUsers, updateUser } from './users.api';
import type { ApiRequestError } from '../../lib/api-error';

/**
 * Admin user management.
 *
 * The guard rails (an admin cannot demote or deactivate themselves; the system must keep at
 * least one active admin) are enforced in the API's use-cases and arrive as 409
 * `SELF_MODIFICATION` / `LAST_ADMIN`. They are surfaced here as plain-English toasts. The
 * UI also disables those controls for the current user, but that is a courtesy — the
 * backend is the enforcement point.
 */

export function useUsers(
  filters: UserFilters,
): UseQueryResult<Paginated<UserResponse>, ApiRequestError> {
  return useQuery({
    queryKey: queryKeys.userList(filters),
    queryFn: ({ signal }) => fetchUsers(filters, signal),
    placeholderData: (previous) => previous,
  });
}

export function useCreateUser(): UseMutationResult<
  UserResponse,
  ApiRequestError,
  CreateUserRequest
> {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: (body: CreateUserRequest) => createUser(body),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users });
      showToast('success', `${created.name} can now sign in as ${created.role.toLowerCase()}.`);
    },
    // A duplicate email or a validation failure is shown on the form, not toasted.
  });
}

interface UpdateUserVariables {
  readonly id: string;
  readonly body: UpdateUserRequest;
}

export function useUpdateUser(): UseMutationResult<
  UserResponse,
  ApiRequestError,
  UpdateUserVariables
> {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  return useMutation({
    mutationFn: ({ id, body }: UpdateUserVariables) => updateUser(id, body),
    onSuccess: (updated) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users });
      showToast('success', `${updated.name} was updated.`);
    },
    onError: (error: ApiRequestError) => {
      // LAST_ADMIN and SELF_MODIFICATION both carry a message written for a non-technical
      // reader ("You cannot deactivate your own account."), so it is shown verbatim.
      showToast('error', error.message);
    },
  });
}
