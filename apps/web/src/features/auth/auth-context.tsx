import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { LoginRequest, LoginResponse, Role, UserResponse } from '@seat-booker/contracts';
import { request } from '../../lib/api-client';
import { asApiError } from '../../lib/api-error';
import { clearToken, readToken, writeToken } from '../../lib/token-storage';

/**
 * Owns the session: the token, the current user, and the decision to end the session.
 *
 * Bootstrap deliberately calls `GET /auth/me` rather than trusting a stored token or
 * decoding its payload. A token survives in `localStorage` after the user is deactivated
 * or their role is changed, and the API re-reads `is_active` on every request (see the
 * rbac-guard skill). Asking the server is the only way the frontend learns the truth —
 * and it means a deactivated user is bounced to login on their next page load.
 */

export type AuthStatus = 'bootstrapping' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  readonly status: AuthStatus;
  readonly user: UserResponse | null;
  readonly login: (credentials: LoginRequest) => Promise<void>;
  readonly logout: () => void;
  /** True when `role` is one of the roles allowed for a thing. */
  readonly hasRole: (...roles: readonly Role[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): ReactElement {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<UserResponse | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() =>
    // No stored token means there is nothing to verify — skip straight to anonymous so
    // the login screen paints immediately instead of flashing a spinner.
    readToken() === null ? 'anonymous' : 'bootstrapping',
  );

  const logout = useCallback((): void => {
    clearToken();
    setUser(null);
    setStatus('anonymous');
    // Drop every cached query: the next user to log in on this browser must not see the
    // previous one's workshops or attendee lists from cache.
    queryClient.clear();
  }, [queryClient]);

  // Bootstrap once on mount when a token exists.
  useEffect(() => {
    if (status !== 'bootstrapping') return;

    let cancelled = false;

    const verify = async (): Promise<void> => {
      try {
        const me = await request<UserResponse>('/auth/me');
        if (cancelled) return;
        setUser(me);
        setStatus('authenticated');
      } catch (error: unknown) {
        if (cancelled) return;

        const apiError = asApiError(error);
        if (apiError?.code === 'UNAUTHENTICATED') {
          // Expired, invalid, or the user was deactivated. Clear and show login.
          logout();
          return;
        }

        // The API is unreachable or broken. Keeping the token but reporting anonymous
        // would silently discard a valid session; dropping the token on a network blip
        // would log out a user whose credentials are fine. Treat it as anonymous for
        // this load but leave the token in place, so a retry recovers the session.
        setUser(null);
        setStatus('anonymous');
      }
    };

    void verify();

    return () => {
      cancelled = true;
    };
  }, [status, logout]);

  const login = useCallback(
    async (credentials: LoginRequest): Promise<void> => {
      // Errors propagate to the form, which renders them next to the fields. The context
      // does not toast them — a failed login belongs on the form, not in a corner.
      const result = await request<LoginResponse>('/auth/login', {
        method: 'POST',
        body: credentials,
      });

      writeToken(result.accessToken);
      // Nothing cached from a previous session should survive a new login.
      queryClient.clear();
      setUser(result.user);
      setStatus('authenticated');
    },
    [queryClient],
  );

  const hasRole = useCallback(
    (...roles: readonly Role[]): boolean => (user === null ? false : roles.includes(user.role)),
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, logout, hasRole }),
    [status, user, login, logout, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}
