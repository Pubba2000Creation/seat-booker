/**
 * Turns the `from` / `to` query parameters into UTC instants.
 *
 * The frontend's "This week" button and date-range inputs send CALENDAR DATES
 * (`2026-10-06`), not instants, and it computes them in the centre's local time (§13 calls
 * this out). Timestamps are stored UTC, so a date-only bound has to be widened into the
 * instant range that calendar day covers IN THE CENTRE'S TIMEZONE:
 *
 *   from=2026-10-06  ->  2026-10-05T18:30:00Z  (00:00:00 Colombo)
 *   to=2026-10-12    ->  2026-10-12T18:29:59Z  (23:59:59 Colombo)
 *
 * Treating them as UTC midnight instead would shift the window by the zone's offset and
 * quietly drop the last evening of a range — a workshop at 21:00 on Sunday would vanish
 * from "This week". A full date-time is passed through untouched, since it is already an
 * instant and needs no interpretation.
 */

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type RangeEdge = 'START_OF_DAY' | 'END_OF_DAY';

/**
 * Measures the zone's UTC offset at a given instant, so a DST boundary cannot shift the
 * window by an hour. `Asia/Colombo` has no DST today, but hard-coding that assumption is
 * the kind of thing that breaks silently after a configuration change.
 */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  // `sv-SE` formats as `YYYY-MM-DD HH:mm:ss`, which `Date.parse` reads reliably.
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const wallClock = new Date(`${formatter.format(instant).replace(' ', 'T')}Z`);
  return wallClock.getTime() - instant.getTime();
}

/**
 * Parses a query bound. Returns `null` for an unparseable value so the caller can decide
 * — the DTO has already rejected malformed input, so this is the defensive path.
 */
export function parseRangeBound(
  raw: string | undefined,
  edge: RangeEdge,
  timeZone: string,
): Date | null {
  if (raw === undefined) return null;

  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  if (!DATE_ONLY_PATTERN.test(trimmed)) {
    // Already a full instant — the client said exactly what it meant.
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const wallClock =
    edge === 'START_OF_DAY' ? `${trimmed}T00:00:00.000Z` : `${trimmed}T23:59:59.999Z`;

  const asIfUtc = new Date(wallClock);
  if (Number.isNaN(asIfUtc.getTime())) return null;

  // Offset is measured AT the target instant, then subtracted to convert the centre's wall
  // clock into the real UTC instant.
  const offset = zoneOffsetMs(asIfUtc, timeZone);
  return new Date(asIfUtc.getTime() - offset);
}
