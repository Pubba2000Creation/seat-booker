import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { asApiError } from '../../lib/api-error';
import { useAuth } from './auth-context';
import { useToast } from '../../components/toast/toast-context';

/**
 * Logs the user out whenever any query or mutation comes back `UNAUTHENTICATED`.
 *
 * This lives in one subscription on the query cache rather than in each hook's `onError`,
 * because a token can expire mid-session on literally any request — and a per-hook handler
 * means the one hook someone forgets leaves the user staring at an error they cannot fix.
 *
 * 403 is deliberately NOT handled here: a forbidden request means the role is wrong, not
 * the session, so the user stays logged in and sees the "Not allowed" page instead. That
 * distinction is the whole point of the 401-vs-403 split in the rbac-guard skill.
 */
export function useSessionExpiry(): void {
  const queryClient = useQueryClient();
  const { status, logout } = useAuth();
  const { showToast } = useToast();

  useEffect(() => {
    // While bootstrapping, the auth context handles its own 401 — reacting here too would
    // double-toast on a plain expired token at page load.
    if (status !== 'authenticated') return;

    const handle = (error: unknown): void => {
      if (asApiError(error)?.code === 'UNAUTHENTICATED') {
        logout();
        showToast('info', 'Your session has expired. Please sign in again.');
      }
    };

    const queries = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'error') {
        handle(event.action.error);
      }
    });

    const mutations = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && event.action.type === 'error') {
        handle(event.action.error);
      }
    });

    return () => {
      queries();
      mutations();
    };
  }, [queryClient, status, logout, showToast]);
}
