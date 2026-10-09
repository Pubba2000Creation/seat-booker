import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { getDatabaseUrl } from './env';

/**
 * Applies any pending migrations in `apps/api/drizzle/`.
 *
 * `max: 1` because the migrator takes an advisory lock and must run on a single
 * connection; running it on a pool can deadlock against itself.
 */
async function main(): Promise<void> {
  const client = postgres(getDatabaseUrl(), { max: 1 });

  try {
    const db = drizzle(client);
    console.log('Applying migrations from ./drizzle ...');
    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations applied.');
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
