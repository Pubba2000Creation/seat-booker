import type { ReactElement } from 'react';
import { WORKSHOP_LOCATIONS, WORKSHOP_STATUSES } from '@seat-booker/contracts';
import type { WorkshopFilters } from '@seat-booker/contracts';
import { Button } from '../../components/ui/Button';
import { CheckboxField, SelectField, TextField } from '../../components/ui/Field';
import { thisWeekRange } from '../../lib/dates';

/**
 * Filters for the workshops list (§7.1): the "This week" quick button, a date range,
 * status, location, a free-text search, and "Only with seats".
 *
 * Presentational only — it receives the current filters and reports changes. The page owns
 * the state and mirrors it into the URL, so a filtered view can be bookmarked or pasted
 * into a chat and comes back the same.
 */

interface WorkshopFilterBarProps {
  readonly filters: WorkshopFilters;
  readonly onChange: (patch: Partial<WorkshopFilters>) => void;
  readonly onReset: () => void;
}

const STATUS_LABELS: Readonly<Record<string, string>> = {
  DRAFT: 'Draft',
  OPEN: 'Open',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
};

const LOCATION_LABELS: Readonly<Record<string, string>> = {
  COLOMBO: 'Colombo',
  KALUTARA: 'Kalutara',
  GALLE: 'Galle',
};

export function WorkshopFilterBar({
  filters,
  onChange,
  onReset,
}: WorkshopFilterBarProps): ReactElement {
  const week = thisWeekRange();
  const isThisWeek = filters.from === week.from && filters.to === week.to;

  const hasAnyFilter =
    filters.from !== undefined ||
    filters.to !== undefined ||
    filters.status !== undefined ||
    filters.location !== undefined ||
    filters.hasSeats === true ||
    (filters.q !== undefined && filters.q.length > 0);

  return (
    <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50/60 px-5 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={isThisWeek ? 'primary' : 'secondary'}
          size="sm"
          // Toggles: pressing it again clears the range rather than re-applying it.
          onClick={() =>
            onChange(
              isThisWeek
                ? { from: undefined, to: undefined, page: 1 }
                : { from: week.from, to: week.to, page: 1 },
            )
          }
          aria-pressed={isThisWeek}
        >
          This week
        </Button>

        <Button
          variant={filters.status === 'OPEN' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() =>
            onChange({ status: filters.status === 'OPEN' ? undefined : 'OPEN', page: 1 })
          }
          aria-pressed={filters.status === 'OPEN'}
        >
          Open only
        </Button>

        {hasAnyFilter ? (
          <Button variant="ghost" size="sm" onClick={onReset}>
            Clear filters
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <TextField
          label="Search"
          type="search"
          placeholder="Code, title or instructor"
          value={filters.q ?? ''}
          onChange={(event) => onChange({ q: event.target.value, page: 1 })}
        />

        <TextField
          label="From"
          type="date"
          value={filters.from ?? ''}
          onChange={(event) => onChange({ from: event.target.value || undefined, page: 1 })}
        />

        <TextField
          label="To"
          type="date"
          value={filters.to ?? ''}
          onChange={(event) => onChange({ to: event.target.value || undefined, page: 1 })}
        />

        <SelectField
          label="Status"
          value={filters.status ?? ''}
          onChange={(event) => onChange({ status: event.target.value || undefined, page: 1 })}
        >
          <option value="">Any status</option>
          {WORKSHOP_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status] ?? status}
            </option>
          ))}
        </SelectField>

        <SelectField
          label="Location"
          value={filters.location ?? ''}
          onChange={(event) =>
            onChange({
              // The select's values come from the contract's location union, so the cast
              // is narrowing a known-good string rather than trusting arbitrary input.
              location:
                event.target.value === ''
                  ? undefined
                  : (event.target.value as WorkshopFilters['location']),
              page: 1,
            })
          }
        >
          <option value="">All locations</option>
          {WORKSHOP_LOCATIONS.map((location) => (
            <option key={location} value={location}>
              {LOCATION_LABELS[location] ?? location}
            </option>
          ))}
        </SelectField>
      </div>

      <CheckboxField
        label="Only workshops with seats available"
        checked={filters.hasSeats === true}
        onChange={(event) =>
          onChange({ hasSeats: event.target.checked ? true : undefined, page: 1 })
        }
      />
    </div>
  );
}
