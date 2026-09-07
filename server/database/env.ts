/**
 * Lettura della configurazione database fuori dal contesto Nuxt
 * (drizzle-kit e lo script di migrazione girano come processi Node autonomi).
 * Dentro Nitro usa invece `useRuntimeConfig().database`, alimentato dagli stessi default.
 */

export const DATABASE_DEFAULTS = {
  dialect: 'pglite',
  url: '',
  pglitePath: '.data/pglite',
} as const;

export const MIGRATIONS_DIR = 'server/database/migrations';

let envLoaded = false;

/** Esportata perché serve anche alla configurazione di autenticazione. */
export function loadEnvFile() {
  if (envLoaded) return;
  envLoaded = true;

  try {
    // Node >= 20.12: carica .env senza dipendenze esterne
    process.loadEnvFile('.env');
  }
  catch {
    // Nessun .env in locale: si usano i default
  }
}

export function readDatabaseEnv() {
  loadEnvFile();

  return {
    dialect: (process.env.NUXT_DATABASE_DIALECT ?? DATABASE_DEFAULTS.dialect) as 'pglite' | 'postgres',
    url: process.env.NUXT_DATABASE_URL ?? DATABASE_DEFAULTS.url,
    pglitePath: process.env.NUXT_DATABASE_PGLITE_PATH ?? DATABASE_DEFAULTS.pglitePath,
  };
}
