/**
 * Lettura della configurazione di autenticazione fuori dal contesto Nuxt
 * (lo script di seed gira come processo Node autonomo).
 * Dentro Nitro si usa invece `useRuntimeConfig().auth`, alimentato dagli
 * stessi default: un posto solo da cambiare.
 */

import { loadEnvFile } from '../database/env.ts';

export const AUTH_DEFAULTS = {
  secret: '',
  url: 'http://localhost:3000',
} as const;

/**
 * Segreto di ripiego per lo sviluppo: firma i cookie in locale così il
 * progetto parte senza .env. In produzione `NUXT_AUTH_SECRET` è obbligatorio
 * (vedi `resolveSecret` in server/utils/auth.ts).
 */
export const DEV_SECRET = 'clash-realm-dev-secret-non-usare-in-produzione';

export function readAuthEnv() {
  loadEnvFile();

  return {
    secret: process.env.NUXT_AUTH_SECRET || DEV_SECRET,
    url: process.env.NUXT_AUTH_URL ?? AUTH_DEFAULTS.url,
  };
}
