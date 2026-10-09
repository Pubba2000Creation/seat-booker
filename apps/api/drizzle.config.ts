import { defineConfig } from 'drizzle-kit';
import { getDatabaseUrl } from './src/db/env';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: getDatabaseUrl(),
  },
  // Keep generated SQL readable — it is reviewed by hand before being applied.
  verbose: true,
  strict: true,
});
