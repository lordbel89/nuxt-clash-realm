import { randomBytes } from 'node:crypto';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import type { Database } from '../../server/database/client.ts';
import { relations } from '../../server/database/relations.ts';
import { MIGRATIONS_FOLDER } from './database.ts';

/** Il Postgres di `compose.test.yml`. Sovrascrivibile per puntare a un'altra istanza. */
export const TEST_POSTGRES_URL = process.env.TEST_POSTGRES_URL ?? 'postgres://clash:clash@localhost:54329/clash_test';

export interface TestPostgres {
  db: Database;
  /** Stringa di connessione del database creato, per aprire connessioni in più (LISTEN, client paralleli). */
  url: string;
  /** Chiude le connessioni e cancella il database. */
  drop: () => Promise<void>;
}

/**
 * Un database nuovo sul Postgres in Docker, con tutte le migrazioni applicate, per i test [C].
 * Ogni file di test ha il suo, quindi i file restano isolati anche se girano in parallelo.
 * Il nome è casuale; `drop()` in un `after` lo cancella.
 */
export async function createTestPostgres(): Promise<TestPostgres> {
  const name = `test_${randomBytes(6).toString('hex')}`;
  const admin = postgres(TEST_POSTGRES_URL, { max: 1, onnotice: () => {} });

  try {
    await admin.unsafe(`CREATE DATABASE ${name}`);
  }
  catch (error) {
    await admin.end();
    throw new Error(`Postgres di test non raggiungibile su ${TEST_POSTGRES_URL}: avvialo con \`docker compose -f compose.test.yml up -d --wait\``, { cause: error });
  }

  const url = new URL(TEST_POSTGRES_URL);
  url.pathname = `/${name}`;

  const client = postgres(url.href, { onnotice: () => {} });
  const db = drizzle({ client, relations });

  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });

  return {
    db,
    url: url.href,
    drop: async () => {
      await client.end();
      await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await admin.end();
    },
  };
}
