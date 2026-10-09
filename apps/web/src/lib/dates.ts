import { CENTRE_TIMEZONE } from './config';

/**
 * Timestamps cross the wire as ISO 8601 UTC and are rendered in the centre's timezone.
 *
 * `Intl.DateTimeFormat` with an explicit `timeZone` does the conversion, so the display is
 * the centre's local time regardless of where the browser sits — a reviewer in another
 * country sees the same clock time the staff do. Formatters are built once; constructing
 * one per cell is measurably slow in a long table.
 */

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: CENTRE_TIMEZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: CENTRE_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const weekdayFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: CENTRE_TIMEZONE,
  weekday: 'short',
});

/** Parts of a UTC instant as seen in the centre's timezone. */
const isoPartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: CENTRE_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function parse(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `11 Oct 2026` */
export function formatDate(iso: string): string {
  const date = parse(iso);
  return date ? dateFormatter.format(date) : '—';
}

/** `09:30` */
export function formatTime(iso: string): string {
  const date = parse(iso);
  return date ? timeFormatter.format(date) : '—';
}

/** `Sun 11 Oct 2026, 09:30` */
export function formatDateTime(iso: string): string {
  const date = parse(iso);
  if (!date) return '—';
  return `${weekdayFormatter.format(date)} ${dateFormatter.format(date)}, ${timeFormatter.format(date)}`;
}

/** `Sun 11 Oct 2026, 09:30 – 12:30` — collapses the end date when it is the same day. */
export function formatDateRange(startIso: string, endIso: string): string {
  const start = parse(startIso);
  const end = parse(endIso);
  if (!start || !end) return '—';

  const sameDay = toCentreDateString(startIso) === toCentreDateString(endIso);

  if (sameDay) {
    return `${formatDateTime(startIso)} – ${timeFormatter.format(end)}`;
  }
  return `${formatDateTime(startIso)} – ${formatDateTime(endIso)}`;
}

/**
 * `YYYY-MM-DD` for the instant as seen in the centre's timezone — the format the API's
 * `from`/`to` filters and `<input type="date">` both use.
 *
 * `en-CA` yields exactly `YYYY-MM-DD`, which is why it is used instead of hand-assembling
 * parts from `formatToParts`.
 */
export function toCentreDateString(iso: string): string {
  const date = parse(iso);
  return date ? isoPartsFormatter.format(date) : '';
}

/** Today in the centre's timezone, as `YYYY-MM-DD`. */
export function centreToday(): string {
  return isoPartsFormatter.format(new Date());
}

export interface DateRange {
  readonly from: string;
  readonly to: string;
}

/**
 * The brief's "This week" quick filter, computed in the centre's local time (§13 calls
 * this out explicitly). The week runs Monday to Sunday — the centre's own convention, and
 * the one the staff would expect from a schedule.
 *
 * Arithmetic is done on the centre-local calendar date string rather than on the browser's
 * `Date` getters, so a browser in another timezone cannot shift the week by a day.
 */
export function thisWeekRange(): DateRange {
  const today = centreToday();
  const [year, month, day] = today.split('-').map(Number);

  // Midday UTC avoids any chance of the date rolling over when we add days.
  const anchor = new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12));

  // getUTCDay(): 0 = Sunday. Shift so Monday is the start of the week.
  const dayOfWeek = anchor.getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;

  const monday = new Date(anchor);
  monday.setUTCDate(anchor.getUTCDate() - daysSinceMonday);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  return { from: toIsoDateOnly(monday), to: toIsoDateOnly(sunday) };
}

function toIsoDateOnly(date: Date): string {
  const parts = date.toISOString().split('T');
  return parts[0] ?? '';
}

/**
 * Converts a `<input type="datetime-local">` value (`2026-10-11T09:30`, no zone) into an
 * ISO UTC instant, interpreting it as a wall-clock time in the centre's timezone.
 *
 * Done by measuring the zone's offset at that instant rather than assuming a fixed one, so
 * a DST boundary cannot shift a workshop by an hour. `Asia/Colombo` has no DST today, but
 * hard-coding that assumption is the kind of thing that breaks silently after a move.
 */
export function centreLocalToUtcIso(localValue: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(localValue)) return null;

  // First guess: treat the wall-clock time as if it were UTC.
  const guess = new Date(`${localValue.slice(0, 16)}:00Z`);
  if (Number.isNaN(guess.getTime())) return null;

  // How far that guess lands from the intended wall-clock time in the centre's zone.
  const offsetMs = guess.getTime() - wallClockAsUtcMs(guess);

  return new Date(guess.getTime() + offsetMs).toISOString();
}

/** The centre-local wall clock of `instant`, re-read as if those numbers were UTC. */
function wallClockAsUtcMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CENTRE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(instant);

  const pick = (type: Intl.DateTimeFormatPartTypes): number => {
    const found = parts.find((part) => part.type === type);
    return found ? Number(found.value) : 0;
  };

  // `hour12: false` can render midnight as 24 in some engines; normalise it.
  const hour = pick('hour') % 24;

  return Date.UTC(
    pick('year'),
    pick('month') - 1,
    pick('day'),
    hour,
    pick('minute'),
    pick('second'),
  );
}

/**
 * ISO UTC -> `<input type="datetime-local">` value in the centre's timezone, for
 * pre-filling the edit form. The inverse of `centreLocalToUtcIso`.
 */
export function utcIsoToCentreLocal(iso: string): string {
  const date = parse(iso);
  if (!date) return '';
  const wall = new Date(wallClockAsUtcMs(date));
  return wall.toISOString().slice(0, 16);
}

/** True when the instant is already in the past — used to explain why a workshop is closed. */
export function isPast(iso: string): boolean {
  const date = parse(iso);
  return date ? date.getTime() < Date.now() : false;
}
