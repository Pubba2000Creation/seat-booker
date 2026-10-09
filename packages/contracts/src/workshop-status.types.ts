/**
 * `DRAFT` and `CANCELLED` and `COMPLETED` are not bookable. "Full" is deliberately
 * NOT a status — it is derived from `activeCount === capacity` so it can never drift.
 */
export type WorkshopStatus = 'DRAFT' | 'OPEN' | 'CANCELLED' | 'COMPLETED';

export const WORKSHOP_STATUSES: readonly WorkshopStatus[] = [
  'DRAFT',
  'OPEN',
  'CANCELLED',
  'COMPLETED',
] as const;

export function isWorkshopStatus(value: unknown): value is WorkshopStatus {
  return typeof value === 'string' && (WORKSHOP_STATUSES as readonly string[]).includes(value);
}

/** The three locations the centre operates from. */
export type WorkshopLocation = 'COLOMBO' | 'KALUTARA' | 'GALLE';

export const WORKSHOP_LOCATIONS: readonly WorkshopLocation[] = [
  'COLOMBO',
  'KALUTARA',
  'GALLE',
] as const;

export function isWorkshopLocation(value: unknown): value is WorkshopLocation {
  return typeof value === 'string' && (WORKSHOP_LOCATIONS as readonly string[]).includes(value);
}
