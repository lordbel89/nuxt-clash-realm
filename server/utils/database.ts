import type { Database, DatabaseDialect } from '../database/client.ts';
import { createDatabase } from '../database/client.ts';

let instance: Promise<Database> | undefined;

/**
 * Istanza condivisa del database, creata alla prima richiesta.
 * Auto-importata nel contesto Nitro: negli handler basta `const db = await useDatabase()`.
 */
export function useDatabase(): Promise<Database> {
  if (!instance) {
    const { database } = useRuntimeConfig();

    // Una connessione fallita non deve restare in cache: la promise rifiutata
    // varrebbe per tutte le richieste successive e il server non si riprenderebbe
    // più nemmeno a database tornato disponibile. Il confronto di identità evita
    // di azzerare un tentativo più recente, se nel frattempo ne è partito uno.
    const pending: Promise<Database> = createDatabase({
      dialect: database.dialect as DatabaseDialect,
      url: database.url,
      pglitePath: database.pglitePath,
    }).catch((error) => {
      if (instance === pending) instance = undefined;

      throw error;
    });

    instance = pending;
  }

  return instance;
}

/** Ritorna l'istanza solo se già creata, senza aprire una connessione. */
export function getDatabaseInstance() {
  return instance;
}
