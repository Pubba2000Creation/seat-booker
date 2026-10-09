import type { ReactElement } from 'react';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout';
import { HistoryPage } from '../pages/HistoryPage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { UsersPage } from '../pages/UsersPage';
import { WorkshopDetailPage } from '../pages/WorkshopDetailPage';
import { WorkshopFormPage } from '../pages/WorkshopFormPage';
import { WorkshopsPage } from '../pages/WorkshopsPage';
import { RequireAuth, RequireRole, RoleHomeRedirect } from './RequireAuth';
import { useSessionExpiry } from '../features/auth/use-session-expiry';

/**
 * The route tree.
 *
 * The role gates mirror the API's permission matrix exactly — workshops and registrations
 * for MANAGER and STAFF, users for ADMIN, and ADMIN deliberately excluded from workshops.
 * Keeping the two in step is what makes the UI consistent with the 403s the API returns;
 * the API remains the enforcement point either way.
 *
 * `/workshops/new` and `/workshops/:workshopId` do not conflict: React Router ranks a
 * static segment above a dynamic one regardless of declaration order, so "new" is never
 * matched as a workshop id.
 */
export function AppRoutes(): ReactElement {
  // Mounted inside the router so a session expiry can toast and redirect.
  useSessionExpiry();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          {/* ADMIN lands on Users, MANAGER and STAFF on Workshops. */}
          <Route index element={<RoleHomeRedirect />} />

          <Route element={<RequireRole allow={['MANAGER', 'STAFF']} />}>
            <Route path="workshops" element={<WorkshopsPage />} />
            <Route path="workshops/:workshopId" element={<WorkshopDetailPage />} />
            {/* The global attendee lookup — same roles as GET /api/registrations. */}
            <Route path="history" element={<HistoryPage />} />
          </Route>

          {/* Creating and editing a workshop is MANAGER only. */}
          <Route element={<RequireRole allow={['MANAGER']} />}>
            <Route path="workshops/new" element={<WorkshopFormPage />} />
            <Route path="workshops/:workshopId/edit" element={<WorkshopFormPage />} />
          </Route>

          <Route element={<RequireRole allow={['ADMIN']} />}>
            <Route path="users" element={<UsersPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
