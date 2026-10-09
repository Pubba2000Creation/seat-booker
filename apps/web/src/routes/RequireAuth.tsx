import type { ReactElement } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import type { Role } from '@seat-booker/contracts';
import { useAuth } from '../features/auth/auth-context';
import { LoadingState } from '../components/ui/States';
import { NotAllowedPage } from '../pages/NotAllowedPage';

/**
 * Route guards.
 *
 * The 401 / 403 split from the rbac-guard skill is mirrored here:
 * - not authenticated -> redirect to login, remembering where they were headed
 * - authenticated but wrong role -> "Not allowed" page, still signed in
 *
 * A wrong role must not log the user out. An admin who follows a link to a workshop has a
 * perfectly valid session; throwing them to the login screen would look like a bug and
 * teach them to re-enter their password for no reason.
 */

export function RequireAuth(): ReactElement {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'bootstrapping') {
    return <LoadingState label="Checking your session…" />;
  }

  if (status === 'anonymous') {
    // `state.from` lets the login page send them on to their original destination.
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}

/**
 * Role gate for a branch of the route tree. Renders the same "Not allowed" page the API's
 * 403 would produce, so the two paths to a refusal look identical to the user.
 */
export function RequireRole({ allow }: { readonly allow: readonly Role[] }): ReactElement {
  const { user } = useAuth();

  if (user === null) {
    // RequireAuth always runs first, so this is unreachable in practice. Handled rather
    // than asserted — a non-null assertion here would be exactly the `!` the standards ban.
    return <Navigate to="/login" replace />;
  }

  if (!allow.includes(user.role)) {
    return <NotAllowedPage />;
  }

  return <Outlet />;
}

/**
 * Sends a signed-in user to their role's home page: ADMIN to Users, MANAGER and STAFF to
 * Workshops (§7.2). Used for `/` so nobody lands on a page their role cannot open.
 */
export function RoleHomeRedirect(): ReactElement {
  const { status, user } = useAuth();

  if (status === 'bootstrapping') {
    return <LoadingState label="Loading…" />;
  }

  if (user === null) {
    return <Navigate to="/login" replace />;
  }

  return <Navigate to={user.role === 'ADMIN' ? '/users' : '/workshops'} replace />;
}
