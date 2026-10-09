import type { ReactElement } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import type { Role } from '@seat-booker/contracts';
import { useAuth } from '../../features/auth/auth-context';
import { RoleBadge } from '../ui/StatusBadge';
import { Button } from '../ui/Button';
import { CENTRE_TIMEZONE } from '../../lib/config';

/**
 * The signed-in shell: header, role-derived navigation, and the routed page.
 *
 * Navigation is built from the user's role, so an admin never sees a Workshops tab that
 * would 403 and a staff member never sees Users. This is for usability only — every one of
 * these routes is enforced by the API's deny-by-default guard, and typing the URL directly
 * gets a "Not allowed" page rather than data.
 */

interface NavItem {
  readonly to: string;
  readonly label: string;
  readonly roles: readonly Role[];
}

const NAV_ITEMS: readonly NavItem[] = [
  { to: '/workshops', label: 'Workshops', roles: ['MANAGER', 'STAFF'] },
  { to: '/history', label: 'History', roles: ['MANAGER', 'STAFF'] },
  { to: '/users', label: 'Users', roles: ['ADMIN'] },
] as const;

export function AppLayout(): ReactElement {
  const { user, logout } = useAuth();

  const visibleItems = NAV_ITEMS.filter((item) =>
    user === null ? false : item.roles.includes(user.role),
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-sm font-bold text-white"
            >
              SB
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-slate-900">Seat Booker</p>
              <p className="text-xs text-slate-500">Community Training Centre</p>
            </div>
          </div>

          <nav aria-label="Main" className="flex items-center gap-1">
            {visibleItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {user !== null ? (
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-slate-900">{user.name}</p>
                <p className="text-xs text-slate-500">{user.email}</p>
              </div>
            ) : null}
            {user !== null ? <RoleBadge status={user.role} /> : null}
            <Button variant="secondary" size="sm" onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>

      <footer className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        {/* Stated plainly so staff know which clock the times belong to. */}
        <p className="text-xs text-slate-400">All times shown in {CENTRE_TIMEZONE}.</p>
      </footer>
    </div>
  );
}
