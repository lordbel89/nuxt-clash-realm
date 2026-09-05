import { mkdirSync } from 'node:fs'
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { relations } from './relations.ts'

export type DatabaseDialect = 'pglite' | 'postgres'

export interface DatabaseOptions {
  dialect: DatabaseDialect
  /** Stringa di connessione Postgres (usata solo dal dialetto postgres) */
  url: string
  /** Cartella dati di PGlite (usata solo dal dialetto pglite) */
  pglitePath: string
}

function createPostgresDatabase(url: string) {
  if (!url) {
    throw new Error('Connessione Postgres non configurata: valorizza NUXT_DATABASE_URL')
  }

  return drizzlePostgres({
    client: postgres(url),
    relations
  })
}

/**
 * PGlite è una devDependency e in produzione non viene mai caricato.
 * Lo specificatore sta in una variabile apposta: così il bundler non lo risolve
 * staticamente e i suoi ~17 MB di WASM restano fuori da .output (11 MB invece
 * di 29 MB). Riportarlo a un import normale quadruplica il build.
 */
async function createPgliteDatabase(dataDir: string) {
  const pgliteDriver = 'drizzle-orm/pglite'
  const { drizzle } = await import(/* @vite-ignore */ pgliteDriver) as typeof import('drizzle-orm/pglite')

  mkdirSync(dataDir, { recursive: true })

  return drizzle({
    connection: { dataDir },
    relations
  })
}

/**
 * Il tipo esposto al resto del backend è quello del client Postgres di rete:
 * PGlite è lo stesso Postgres compilato in WASM e parla lo stesso SQL, quindi
 * le query scritte contro questo tipo valgono per entrambi gli ambienti.
 */
export type Database = ReturnType<typeof createPostgresDatabase>

export async function createDatabase(options: DatabaseOptions): Promise<Database> {
  if (options.dialect === 'postgres') {
    return createPostgresDatabase(options.url)
  }

  return await createPgliteDatabase(options.pglitePath) as unknown as Database
}

/** Chiude la connessione sottostante: il pool di rete o l'istanza WASM. */
export async function closeDatabase(db: Database) {
  const client = db.$client as unknown

  if (typeof (client as { end?: () => Promise<void> }).end === 'function') {
    await (client as { end: () => Promise<void> }).end()
  }
  else if (typeof (client as { close?: () => Promise<void> }).close === 'function') {
    await (client as { close: () => Promise<void> }).close()
  }
}
