import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { DEFAULT_PAGE_SIZE, isWorkshopLocation } from '@seat-booker/contracts';
import type { WorkshopFilters } from '@seat-booker/contracts';

/**
 * Keeps the workshop filters in the URL rather than in component state.
 *
 * The payoff is practical: a staff member can bookmark "open workshops with seats this
 * week", the back button steps through filter changes, and a reviewer can paste a filtered
 * URL and see the same list. It also means the filters survive a refresh without any
 * mirroring of server data into state.
 */

const PARAM_KEYS = ['from', 'to', 'status', 'location', 'hasSeats', 'q', 'page'] as const;

export interface WorkshopFiltersState {
  readonly filters: WorkshopFilters;
  readonly setFilters: (patch: Partial<WorkshopFilters>) => void;
  readonly resetFilters: () => void;
}

export function useWorkshopFilters(): WorkshopFiltersState {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<WorkshopFilters>(() => {
    const read = (key: string): string | undefined => {
      const value = searchParams.get(key);
      return value !== null && value.length > 0 ? value : undefined;
    };

    const location = read('location');
    const pageRaw = Number(read('page') ?? '1');

    return {
      from: read('from'),
      to: read('to'),
      status: read('status'),
      // An unknown location in a hand-edited URL is dropped rather than forwarded — the
      // API would reject it with a 400 and the user would see an error for a filter they
      // never set.
      location: isWorkshopLocation(location) ? location : undefined,
      hasSeats: read('hasSeats') === 'true' ? true : undefined,
      q: read('q'),
      page: Number.isInteger(pageRaw) && pageRaw > 0 ? pageRaw : 1,
      pageSize: DEFAULT_PAGE_SIZE,
    };
  }, [searchParams]);

  const setFilters = useCallback(
    (patch: Partial<WorkshopFilters>): void => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);

          for (const [key, value] of Object.entries(patch)) {
            // `pageSize` is a constant, never a URL concern.
            if (key === 'pageSize') continue;

            if (value === undefined || value === null || value === '' || value === false) {
              next.delete(key);
            } else {
              next.set(key, String(value));
            }
          }

          // Page 1 is the default; keeping it out of the URL leaves clean, shareable links.
          if (next.get('page') === '1') next.delete('page');

          return next;
        },
        // Filter changes replace rather than push, so Back leaves the list instead of
        // walking back through every keystroke in the search box.
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
