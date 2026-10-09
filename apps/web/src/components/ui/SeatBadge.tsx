import type { ReactElement } from 'react';
import type { WorkshopResponse } from '@seat-booker/contracts';

/**
 * The seats-left badge: green with room, amber at 3 or fewer, red when full.
 *
 * It reads `seatsAvailable` and `isFull` straight from the response and never recomputes
 * them from `capacity - activeCount`. That is the rule from the coding standards: if the
 * frontend decides something the backend also decides, the backend value wins. During the
 * Saturday-morning rush the server's count is the only one that is true.
 *
 * The amber threshold is a display choice only — it is not a business rule, and nothing
 * branches on it beyond the colour.
 */

const LOW_SEAT_THRESHOLD = 3;

interface SeatBadgeProps {
  readonly workshop: Pick<
    WorkshopResponse,
    'activeCount' | 'capacity' | 'seatsAvailable' | 'isFull'
  >;
  readonly size?: 'sm' | 'md';
}

export function SeatBadge({ workshop, size = 'sm' }: SeatBadgeProps): ReactElement {
  const { seatsAvailable, isFull, activeCount, capacity } = workshop;

  const tone = isFull
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : seatsAvailable <= LOW_SEAT_THRESHOLD
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  const label = isFull
    ? 'Full'
    : seatsAvailable === 1
      ? '1 seat left'
      : `${seatsAvailable} seats left`;

  const sizeClasses = size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap ${tone} ${sizeClasses}`}
      // The visible label says "4 seats left"; the title gives the full ratio for anyone
      // who wants the exact numbers without opening the workshop.
      title={`${activeCount} of ${capacity} seats taken`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

/**
 * The detail page's seat counter — the same authoritative numbers, shown as a progress
 * meter rather than a pill.
 */
export function SeatCounter({
  workshop,
}: {
  readonly workshop: Pick<
    WorkshopResponse,
    'activeCount' | 'capacity' | 'seatsAvailable' | 'isFull'
  >;
}): ReactElement {
  const { activeCount, capacity, seatsAvailable, isFull } = workshop;

  // Guard against a zero capacity even though the DB forbids it — a divide-by-zero here
  // would render `NaN%` and break the bar.
  const filledPercent =
    capacity > 0 ? Math.min(100, Math.round((activeCount / capacity) * 100)) : 0;

  const barTone = isFull
    ? 'bg-rose-500'
    : seatsAvailable <= LOW_SEAT_THRESHOLD
      ? 'bg-amber-500'
      : 'bg-emerald-500';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <span className="text-2xl font-semibold tabular-nums text-slate-900">{activeCount}</span>
          <span className="text-sm text-slate-500"> / {capacity} registered</span>
        </div>
        <SeatBadge workshop={workshop} size="md" />
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={activeCount}
        aria-valuemin={0}
        aria-valuemax={capacity}
        aria-label={`${activeCount} of ${capacity} seats taken`}
      >
        <div
          className={`h-full rounded-full transition-all ${barTone}`}
          style={{ width: `${filledPercent}%` }}
        />
      </div>
    </div>
  );
}
