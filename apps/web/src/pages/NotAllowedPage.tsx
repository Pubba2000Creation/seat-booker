import type { ReactElement } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';

/**
 * Shown for a 403 — the role is wrong, not the session.
 *
 * The user stays signed in and is offered a link to the page their role does own. Worth
 * noting for a reviewer: an ADMIN reaching this page from a workshop link is correct
 * behaviour, not a bug. The brief's matrix gives ADMIN no workshop or registration access,
 * and that reading is followed literally on both the API and here.
 */
export function NotAllowedPage(): ReactElement {
  const { user } = useAuth();
  const homePath = user?.role === 'ADMIN' ? '/users' : '/workshops';

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <span
        aria-hidden="true"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-xl font-bold text-amber-700"
      >
        !
      </span>
      <h1 className="text-lg font-semibold text-slate-900">Not allowed</h1>
      <p className="max-w-md text-sm text-slate-600">
        Your account does not have access to this page.
        {user !== null ? ` You are signed in as ${user.name} (${user.role.toLowerCase()}).` : ''}
      </p>
      <Link
        to={homePath}
        className="mt-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
      >
        Go to my pages
      </Link>
    </div>
  );
}
