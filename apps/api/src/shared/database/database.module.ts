import { Global, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { AppConfigService } from '../config/app-config.service';
import * as schema from '../../db/schema';

export const DATABASE = Symbol('Database');
export const DATABASE_CLIENT = Symbol('DatabaseClient');

/**
 * The Drizzle handle every repository injects. Exported as a type so `infrastructure/`
 * files can annotate their constructor parameter — this type must never appear in an
 * `application/` or `api/` signature.
 */
export type Database = ReturnType<typeof createDatabase>;

export type DatabaseClient = ReturnType<typeof postgres>;

function createDatabase(client: DatabaseClient) {
  return drizzle(client, { schema });
}

/**
 * Closes the connection pool on shutdown so `pnpm dev` restarts and Jest runs do not leak
 * sockets (Jest hangs on an open pool and reports "did not exit").
 */
@Injectable()
class DatabaseLifecycle implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseLifecycle.name);

  constructor(@Inject(DATABASE_CLIENT) private readonly client: DatabaseClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.end({ timeout: 5 });
    this.logger.log('Database connection pool closed.');
  }
}

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CLIENT,
      useFactory: (config: AppConfigService): DatabaseClient =>
        postgres(config.databaseUrl, {
          // The concurrency test fires 50 parallel registrations; a pool of 1 would
          // serialise them and the race would never actually be exercised.
          max: 10,
          onnotice: () => {
            // Postgres NOTICE output is noise here (e.g. "relation already exists" from
            // IF NOT EXISTS). Errors still propagate normally.
          },
        }),
      inject: [AppConfigService],
    },
    {
      provide: DATABASE,
      useFactory: (client: DatabaseClient): Database => createDatabase(client),
      inject: [DATABASE_CLIENT],
    },
    DatabaseLifecycle,
  ],
  exports: [DATABASE, DATABASE_CLIENT],
})
export class DatabaseModule {}
