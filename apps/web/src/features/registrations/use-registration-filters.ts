import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_PAGE_SIZE, isRegistrationStatus } from '@seat-booker/contracts';
import type { RegistrationFilters } from '@seat-booker/contracts';

/**
 * Keeps the attendee-history filters in the URL, the same way `use-workshop-filters` does.
 *
 * The practical payoff here is the lookup itself: "has this person booked with us before?"
 * is a question staff get asked at the desk, and a URL that carries the email means the
 * answer can be pasted into a message or kept open in a tab across a refresh.
 */

const PARAM_KEYS = ['email', 'from', 'to', 'status', 'workshopId', 'page'] as const;

export interface RegistrationFiltersState {
  readonly filters: RegistrationFilters;
  readonly setFilters: (patch: Partial<RegistrationFilters>) => void;
  readonly resetFilters: () => void;
}

export function useRegistrationFilters(): RegistrationFiltersState {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<RegistrationFilters>(() => {
    const read = (key: string): string | undefined => {
      const value = searchParams.get(key);
      return value !== null && value.length > 0 ? value : undefined;
    };

    const status = read('status');
    const pageRaw = Number(read('page') ?? '1');

    return {
      email: read('email'),
      from: read('from'),
      to: read('to'),
      // A hand-edited URL carrying a bogus status is dropped rather than forwarded: the API
      // answers 400, and the user would be shown an error for a filter they never set.
      // 'ALL' is a valid filter value but not a RegistrationStatus, so it is checked apart.
      status: status === 'ALL' || isRegistrationStatus(status) ? status : undefined,
      workshopId: read('workshopId'),
      page: Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1,
      pageSize: DEFAULT_PAGE_SIZE,
    };
  }, [searchParams]);

  const setFilters = useCallback(
    (patch: Partial<RegistrationFilters>): void => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);

          for (const [key, value] of Object.entries(patch)) {
            // `pageSize` is a constant, never a URL concern.
            if (key === 'pageSize') continue;

            // No boolean filters in this shape, so there is no `false` case to drop.
            if (value === undefined || value === null || value === '') {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          }

          // Page 1 is the default; keeping it out leaves clean, shareable links.
          if (next.get('page') === '1') next.delete('page');

          return next;
        },
        // Replace, not push, so Back leaves the page rather than walking back through
        // every keystroke in the email box.
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const resetFilters = useCallback((): void => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const key of PARAM_KEYS) next.delete(key);
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  return { filters, setFilters, resetFilters };
}
