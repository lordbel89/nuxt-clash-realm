import type { Database, DatabaseDialect } from '../database/client.ts'
import { createDatabase } from '../database/client.ts'

let instance: Promise<Database> | undefined

/**
 * Istanza condivisa del database, creata alla prima richiesta.
 * Auto-importata nel contesto Nitro: negli handler basta `const db = await useDatabase()`.
 */
export function useDatabase(): Promise<Database> {
  if (!instance) {
    const { database } = useRuntimeConfig()

    instance = createDatabase({
      dialect: database.dialect as DatabaseDialect,
      url: database.url,
      pglitePath: database.pglitePath,
    })
  }

  return instance
}

/** Ritorna l'istanza solo se già creata, senza aprire una connessione. */
export function getDatabaseInstance() {
  return instance
}
