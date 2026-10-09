/**
 * Environment validation. Runs once at boot, before anything else is constructed, so a
 * misconfigured deployment fails immediately with a readable list of problems rather than
 * dying later on the first request (or worse, booting with a default JWT secret).
 *
 * Deliberately hand-written rather than class-validator: this runs outside the DI
 * container, and a plain function keeps the failure message in our own words.
 */

export interface AppConfig {
  readonly nodeEnv: 'development' | 'test' | 'production';
  readonly databaseUrl: string;
  readonly jwtSecret: string;
  /** The raw env value, e.g. `8h`. Kept for logging and diagnostics. */
  readonly jwtExpiresIn: string;
  /**
   * `jwtExpiresIn` resolved to whole seconds. Signing uses this rather than the string:
   * jsonwebtoken's own string type is a narrow literal union that a validated-at-runtime
   * string cannot satisfy without a cast, and seconds are unambiguous.
   */
  readonly jwtExpiresInSeconds: number;
  readonly port: number;
  /** Comma-separated list in the env var; parsed to an array here. */
  readonly corsOrigins: readonly string[];
  readonly bcryptRounds: number;
  readonly centreTimezone: string;
}

const MIN_JWT_SECRET_LENGTH = 32;
const MIN_BCRYPT_ROUNDS = 4;
const MAX_BCRYPT_ROUNDS = 15;

function readString(env: NodeJS.ProcessEnv, key: string, problems: string[]): string {
  const raw = env[key];
  if (raw === undefined || raw.trim().length === 0) {
    problems.push(`${key} is required but was not set.`);
    return '';
  }
  return raw.trim();
}

function readInt(
  env: NodeJS.ProcessEnv,
  key: string,
  fallback: number,
  min: number,
  max: number,
  problems: string[],
): number {
  const raw = env[key];
  if (raw === undefined || raw.trim().length === 0) return fallback;

  const parsed = Number(raw.trim());
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    problems.push(`${key} must be an integer between ${min} and ${max} (received "${raw}").`);
    return fallback;
  }
  return parsed;
}

function readNodeEnv(
  env: NodeJS.ProcessEnv,
  problems: string[],
): 'development' | 'test' | 'production' {
  const raw = (env['NODE_ENV'] ?? 'development').trim();
  if (raw === 'development' || raw === 'test' || raw === 'production') return raw;
  problems.push(`NODE_ENV must be one of development | test | production (received "${raw}").`);
  return 'development';
}

/** `8h`, `30m`, `3600s`, `7d`, or a bare number of seconds. */
const JWT_EXPIRES_IN_PATTERN = /^(\d+)(s|m|h|d|w)?$/;

const DURATION_UNIT_SECONDS: Readonly<Record<string, number>> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 24 * 60 * 60,
  w: 7 * 24 * 60 * 60,
};

/** Converts a validated duration string to whole seconds. Returns null if unparseable. */
function durationToSeconds(raw: string): number | null {
  const match = JWT_EXPIRES_IN_PATTERN.exec(raw);
  if (match === null) return null;

  const amount = Number(match[1]);
  // A bare number means seconds, matching jsonwebtoken's own convention.
  const unit = match[2] ?? 's';
  const multiplier = DURATION_UNIT_SECONDS[unit];
  if (multiplier === undefined || amount <= 0) return null;

  return amount * multiplier;
}

export function loadAppConfig(env: NodeJS.ProcessEnv): AppConfig {
  const problems: string[] = [];

  const nodeEnv = readNodeEnv(env, problems);
  const databaseUrl = readString(env, 'DATABASE_URL', problems);
  if (databaseUrl.length > 0 && !/^postgres(ql)?:\/\//.test(databaseUrl)) {
    problems.push('DATABASE_URL must be a postgres:// or postgresql:// connection string.');
  }

  const jwtSecret = readString(env, 'JWT_SECRET', problems);
  if (jwtSecret.length > 0 && jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    problems.push(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters ` +
        `(received ${jwtSecret.length}).`,
    );
  }

  const jwtExpiresIn = (env['JWT_EXPIRES_IN'] ?? '8h').trim();
  const jwtExpiresInSeconds = durationToSeconds(jwtExpiresIn);
  if (jwtExpiresInSeconds === null) {
    problems.push(
      `JWT_EXPIRES_IN must be a positive duration like "8h", "30m", "7d" or a number of ` +
        `seconds (received "${jwtExpiresIn}").`,
    );
  }

  const port = readInt(env, 'PORT', 3000, 1, 65535, problems);
  const bcryptRounds = readInt(
    env,
    'BCRYPT_ROUNDS',
    10,
    MIN_BCRYPT_ROUNDS,
    MAX_BCRYPT_ROUNDS,
    problems,
  );

  const centreTimezone = (env['CENTRE_TIMEZONE'] ?? 'Asia/Colombo').trim();
  // Validated against the runtime's own IANA database rather than a hard-coded list.
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: centreTimezone });
  } catch {
    problems.push(`CENTRE_TIMEZONE is not a valid IANA timezone (received "${centreTimezone}").`);
  }

  const corsRaw = (env['CORS_ORIGIN'] ?? 'http://localhost:5173').trim();
  const corsOrigins = corsRaw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  if (corsOrigins.length === 0) {
    problems.push('CORS_ORIGIN must list at least one origin.');
  }

  if (problems.length > 0) {
    throw new Error(
      `Invalid API environment configuration:\n${problems.map((p) => `  - ${p}`).join('\n')}\n` +
        'See .env.example for every variable the API needs.',
    );
  }

  return {
    nodeEnv,
    databaseUrl,
    jwtSecret,
    jwtExpiresIn,
    // Non-null is safe here: a null value added a problem above and we already threw.
    jwtExpiresInSeconds: jwtExpiresInSeconds ?? 0,
    port,
    corsOrigins,
    bcryptRounds,
    centreTimezone,
  };
}
