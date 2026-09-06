import { defineConfig } from 'drizzle-kit';
import { MIGRATIONS_DIR, readDatabaseEnv } from './server/database/env.ts';

const env = readDatabaseEnv();

// Un solo dialetto SQL: le migrazioni generate valgono per entrambi gli ambienti.
// Le credenziali cambiano solo per i comandi che si collegano davvero (studio, push).
export default defineConfig({
  dialect: 'postgresql',
  schema: './server/database/schema/index.ts',
  out: MIGRATIONS_DIR,
  ...(env.dialect === 'pglite'
    ? { driver: 'pglite' as const, dbCredentials: { url: env.pglitePath } }
    : { dbCredentials: { url: env.url } }),
});
