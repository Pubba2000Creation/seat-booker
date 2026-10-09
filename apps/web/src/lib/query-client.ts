import { QueryClient } from '@tanstack/react-query';
import { asApiError } from './api-error';

/**
 * The shared query client.
 *
 * Retry policy is the interesting part. A 4xx from this API is a decision, not a glitch:
 * retrying a `WORKSHOP_FULL`, a `FORBIDDEN` or a `VALIDATION_ERROR` cannot change the
 * answer and only delays showing the user what happened. So retries are limited to
 * transport failures and 5xx.
 *
 * Mutations are never retried at all. A retried register could, in principle, create a
 * second registration if the first request actually succeeded but its response was lost —
 * exactly the double-booking this whole application exists to prevent.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Seat counts move during a rush, so cached data is treated as immediately stale
        // and refetched when the user comes back to the tab.
        staleTime: 0,
        refetchOnWindowFocus: true,
        retry: (failureCount, error: unknown) => {
          const apiError = asApiError(error);

          // Unrecognised failure: allow one retry, it may have been a transport blip.
          if (apiError === null) return failureCount < 1;

          // A deliberate 4xx answer. Asking again will not change it.
          if (apiError.statusCode >= 400 && apiError.statusCode < 500) return false;

          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,
      },
    },
  });
}
