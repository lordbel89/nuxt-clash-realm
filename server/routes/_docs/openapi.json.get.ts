import { readFile } from 'node:fs/promises';

/**
 * GET /_docs/openapi.json — la specifica versionata, letta dal disco a ogni richiesta: dopo
 * `npm run api:spec` basta ricaricare la pagina. Solo in sviluppo.
 */
export default defineEventHandler(async (event) => {
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Pagina non trovata' });
  }

  setResponseHeader(event, 'Content-Type', 'application/json; charset=utf-8');

  return await readFile('docs/api/openapi.json', 'utf8');
});
