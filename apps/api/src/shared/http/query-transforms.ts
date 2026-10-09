/**
 * Transforms for query-string DTOs.
 *
 * Query parameters always arrive as strings, and the global `ValidationPipe` runs with
 * `enableImplicitConversion: false` — deliberately, because implicit conversion turns
 * `isActive=false` into `true` and `capacity=abc` into `NaN` silently. These helpers make
 * each coercion explicit at the field that needs it, and leave anything unrecognised
 * untouched so the following `@IsInt` / `@IsBoolean` reports a real validation error
 * instead of the coercion guessing.
 */

/**
 * `"true"` / `"1"` -> true, `"false"` / `"0"` -> false, anything else unchanged.
 *
 * A bare flag (`?hasSeats`) arrives as `''` and is read as true: that is what a reader
 * expects from a URL, and the frontend never sends it.
 */
export function toOptionalBoolean({ value }: { value: unknown }): unknown {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return value;

  const normalised = value.trim().toLowerCase();
  if (normalised === 'true' || normalised === '1' || normalised === '') return true;
  if (normalised === 'false' || normalised === '0') return false;

  // Left as the original string so @IsBoolean rejects it, rather than defaulting to a
  // value the caller did not ask for.
  return value;
}

/**
 * Digits -> number. A non-numeric string is returned unchanged so `@IsInt` reports it;
 * returning `NaN` would produce the much less helpful "must be an integer" on a value the
 * caller can no longer see in the message.
 */
export function toOptionalInteger({ value }: { value: unknown }): unknown {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  if (!/^-?\d+$/.test(trimmed)) return value;

  return Number.parseInt(trimmed, 10);
}

/** Trims a string, and maps an empty result to `undefined` so `@IsOptional` drops it. */
export function toOptionalTrimmed({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

/** Trims and lower-cases — the normalisation every email comparison depends on (§13). */
export function toOptionalEmail({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const normalised = value.trim().toLowerCase();
  return normalised.length === 0 ? undefined : normalised;
}
