import { config } from 'dotenv';

/**
 * Loads `apps/api/.env` for the standalone database scripts (generate / migrate / seed).
 * The Nest application itself uses `@nestjs/config` instead — this exists only because
 * drizzle-kit and the seed run outside the Nest DI container.
 *
 * All of these scripts are invoked with `apps/api` as the working directory (pnpm runs
 * package scripts from the package root), so a relative path is correct and avoids
 * `__dirname`, which is unavailable under drizzle-kit's ESM loader.
 */
let loaded = false;

function loadEnvOnce(): void {
  if (loaded) return;
  config({ path: '.env', quiet: true });
  loaded = true;
}

export function getDatabaseUrl(): string {
  loadEnvOnce();
  const url = process.env['DATABASE_URL'];
  if (url !== undefined && url.length > 0) {
    return url;
  }
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to apps/api/.env (see COMMANDS.md §2), ' +
      'or export DATABASE_URL for this command.',
  );
}
