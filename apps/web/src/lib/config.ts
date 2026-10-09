/**
 * Frontend configuration, read once from Vite's env at module load.
 *
 * Both values have dev fallbacks so `pnpm --filter @seat-booker/web dev` works on a clean
 * clone before anyone copies `.env.example`. A missing API base URL in a production build
 * is a deployment mistake, not something to paper over at runtime — hence the explicit
 * fallback rather than a thrown error, with the real value supplied by `.env`.
 */

const DEFAULT_API_BASE_URL = 'http://localhost:3000/api';

/** The centre operates in a single timezone; every timestamp is rendered in it. */
const DEFAULT_CENTRE_TIMEZONE = 'Asia/Colombo';

function readEnv(key: string, fallback: string): string {
  const raw: unknown = import.meta.env[key];
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

export const API_BASE_URL: string = readEnv('VITE_API_BASE_URL', DEFAULT_API_BASE_URL).replace(
  /\/+$/,
  '',
);

export const CENTRE_TIMEZONE: string = readEnv('VITE_CENTRE_TIMEZONE', DEFAULT_CENTRE_TIMEZONE);

/** Where the access token lives. Key is namespaced so it cannot collide on localhost. */
export const TOKEN_STORAGE_KEY = 'seat-booker.accessToken';
