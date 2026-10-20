import type { PgBoss } from 'pg-boss';
import { startBoss } from '../jobs/boss.ts';

let instance: Promise<PgBoss> | undefined;

/**
 * Il pg-boss del processo, avviato alla prima richiesta. Auto-importato nel contesto Nitro:
 * `const boss = await useBoss()`. Il plugin `jobs` lo avvia all'accensione quando i job sono abilitati.
 */
export function useBoss(): Promise<PgBoss> {
  if (!instance) {
    const { database } = useRuntimeConfig();

    // Stessa regola del database: un tentativo fallito non resta in cache
    const pending: Promise<PgBoss> = useDatabase()
      .then(db => startBoss(db, { dialect: database.dialect as 'pglite' | 'postgres', url: database.url }))
      .catch((error) => {
        if (instance === pending) instance = undefined;

        throw error;
      });

    instance = pending;
  }

  return instance;
}

/** Ritorna pg-boss solo se già creato, senza avviarlo. */
export function getBossInstance() {
  return instance;
}
