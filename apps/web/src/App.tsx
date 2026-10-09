import { useState } from 'react';
import type { ReactElement } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { createQueryClient } from './lib/query-client';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/toast/toast-context';
import { ToastHost } from './components/toast/ToastHost';
import { AuthProvider } from './features/auth/auth-context';
import { AppRoutes } from './routes/AppRoutes';

/**
 * Provider stack. The order matters:
 *
 * - `QueryClientProvider` outermost of the three, because `AuthProvider` clears the query
 *   cache on login and logout.
 * - `ToastProvider` above the router, because the session-expiry hook inside it toasts.
 * - `AuthProvider` above `AppRoutes`, because every route guard reads it.
 */
export function App(): ReactElement {
  // Created in state rather than at module scope so a Fast Refresh does not swap the
  // client out from under the cache mid-session.
  const [queryClient] = useState(createQueryClient);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <AppRoutes />
              <ToastHost />
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
