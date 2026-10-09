import { useState } from 'react';
import type { ReactElement } from 'react';
import { DEFAULT_PAGE_SIZE, ROLES } from '@seat-booker/contracts';
import type { Role, UserFilters, UserResponse } from '@seat-booker/contracts';
import { useAuth } from '../features/auth/auth-context';
import { useUpdateUser, useUsers } from '../features/users/use-users';
import { CreateUserForm } from '../features/users/CreateUserForm';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { SelectField, TextField } from '../components/ui/Field';
import { ActiveBadge, RoleBadge } from '../components/ui/StatusBadge';
import { Pagination } from '../components/ui/Pagination';
import { EmptyState, ErrorState, LoadingState } from '../components/ui/States';
import { formatDate } from '../lib/dates';

/**
 * User administration (ADMIN only) — the landing page for an admin.
 *
 * Nothing is deleted here: a user is deactivated, which keeps every history reference they
 * appear in valid. "Who registered this attendee?" must still answer correctly years after
 * that staff member leaves.
 *
 * The self-modification controls are disabled for the signed-in admin, and the API enforces
 * the same rule plus "never zero active admins". The disabled control is a courtesy; the
 * 409 is the guarantee.
 */
export function UsersPage(): ReactElement {
  const { user: currentUser } = useAuth();
  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const filters: UserFilters = {
    role: roleFilter === '' ? undefined : roleFilter,
    q: search.trim().length > 0 ? search.trim() : undefined,
    page,
    pageSize: DEFAULT_PAGE_SIZE,
  };

  const query = useUsers(filters);
  const updateMutation = useUpdateUser();

  const [pendingDeactivation, setPendingDeactivation] = useState<UserResponse | null>(null);

  const items = query.data?.items ?? [];

  const changeRole = (user: UserResponse, role: Role): void => {
    if (role === user.role) return;
    updateMutation.mutate({ id: user.id, body: { role } });
  };

  const confirmDeactivate = (): void => {
    if (pendingDeactivation === null) return;
    updateMutation.mutate(
      { id: pendingDeactivation.id, body: { isActive: false } },
      { onSettled: () => setPendingDeactivation(null) },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Users</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Create accounts, change roles, and deactivate people who have left.
          </p>
        </div>
        <Button onClick={() => setIsCreateOpen((open) => !open)}>
          {isCreateOpen ? 'Close form' : 'New user'}
        </Button>
      </div>

      {isCreateOpen ? (
        <Card>
          <CardHeader title="Create an account" description="There is no public signup." />
          <CardBody>
            <CreateUserForm onCreated={() => setIsCreateOpen(false)} />
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="All users"
          description={
            query.data !== undefined
              ? `${query.data.total} ${query.data.total === 1 ? 'account' : 'accounts'}`
              : undefined
          }
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void query.refetch()}
              isLoading={query.isFetching && !query.isLoading}
            >
              Refresh
            </Button>
          }
        />

        <div className="grid gap-3 border-b border-slate-200 bg-slate-50/60 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
          <TextField
            label="Search"
            type="search"
            placeholder="Name or email"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
          <SelectField
            label="Role"
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value as Role | '');
              setPage(1);
            }}
          >
            <option value="">Any role</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {role.charAt(0) + role.slice(1).toLowerCase()}
              </option>
            ))}
          </SelectField>
        </div>

        {query.isLoading ? (
          <LoadingState label="Loading users…" />
        ) : query.isError ? (
          <ErrorState
            error={query.error}
            onRetry={() => void query.refetch()}
            isRetrying={query.isFetching}
          />
        ) : items.length === 0 ? (
          <EmptyState
            title="No users match this search"
            description="Try a different name, email, or role."
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-5 py-2.5">
                      Person
                    </th>
                    <th scope="col" className="px-5 py-2.5">
                      Role
                    </th>
                    <th scope="col" className="px-5 py-2.5">
                      Account
                    </th>
                    <th scope="col" className="px-5 py-2.5">
                      Created
                    </th>
                    <th scope="col" className="px-5 py-2.5 text-right">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((user) => {
                    const isSelf = currentUser !== null && currentUser.id === user.id;

                    return (
                      <tr key={user.id} className="border-b border-slate-100">
                        <td className="px-5 py-3">
                          <p className="font-medium text-slate-900">
                            {user.name}
                            {isSelf ? (
                              <span className="ml-2 text-xs font-normal text-slate-500">(you)</span>
                            ) : null}
                          </p>
                          <p className="text-xs text-slate-500">{user.email}</p>
                        </td>
                        <td className="px-5 py-3">
                          {isSelf ? (
                            // An admin cannot demote themselves (the API answers
                            // SELF_MODIFICATION), so the control is read-only here.
                            <RoleBadge status={user.role} />
                          ) : (
                            <select
                              aria-label={`Role for ${user.name}`}
                              value={user.role}
                              disabled={updateMutation.isPending}
                              onChange={(event) => changeRole(user, event.target.value as Role)}
                              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 disabled:bg-slate-50"
                            >
                              {ROLES.map((role) => (
                                <option key={role} value={role}>
                                  {role.charAt(0) + role.slice(1).toLowerCase()}
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <ActiveBadge isActive={user.isActive} />
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-600">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {isSelf ? (
                            <span className="text-xs text-slate-400">—</span>
                          ) : user.isActive ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setPendingDeactivation(user)}
                              disabled={updateMutation.isPending}
                            >
                              Deactivate
                            </Button>
                          ) : (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() =>
                                updateMutation.mutate({ id: user.id, body: { isActive: true } })
                              }
                              disabled={updateMutation.isPending}
                            >
                              Reactivate
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={query.data?.page ?? 1}
              pageSize={query.data?.pageSize ?? DEFAULT_PAGE_SIZE}
              total={query.data?.total ?? 0}
              onPageChange={setPage}
              isLoading={query.isFetching}
            />
          </>
        )}
      </Card>

      <ConfirmDialog
        isOpen={pendingDeactivation !== null}
        title="Deactivate this account?"
        confirmLabel="Yes, deactivate"
        cancelLabel="Keep active"
        isPending={updateMutation.isPending}
        onConfirm={confirmDeactivate}
        onClose={() => setPendingDeactivation(null)}
      >
        <p>
          <span className="font-medium text-slate-900">{pendingDeactivation?.name}</span> will not
          be able to sign in. Their past registrations and cancellations stay in the records, and
          the account can be reactivated later.
        </p>
      </ConfirmDialog>
    </div>
  );
}
