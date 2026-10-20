import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import type { Database } from '../../server/database/client.ts';
import { relations } from '../../server/database/relations.ts';

/** Risolta dal file, non dalla cartella corrente: i test girano da qualunque punto. */
export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../server/database/migrations', import.meta.url));

/**
 * Un database PGlite in memoria con tutte le migrazioni applicate, per i test [I].
 * Uno per file di test: nessuno stato condiviso fra i file, che `node --test` esegue in parallelo.
 * Chiuderlo con `closeDatabase(db)` in un `after`.
 *
 * PGlite è una connessione sola: va bene per i servizi, non per la concorrenza (per quella c'è [C]).
 */
export async function createTestDatabase(): Promise<Database> {
  const db = drizzle({ client: new PGlite(), relations });

  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  // Stesso cast di `createDatabase()`: il resto del backend ragiona sul tipo del Postgres di rete
  return db as unknown as Database;
}
