/**
 * Risponde con i mock prima di qualunque handler reale, solo in sviluppo.
 *
 * È un middleware e non un insieme di rotte per due motivi: intercetta anche i
 * percorsi per cui un handler non esiste ancora — il caso d'uso principale — e
 * ha comunque la precedenza su quelli che esistono, quindi accendere un mock
 * non richiede di toccare `server/api/`.
 *
 * L'import è dinamico e dietro `import.meta.dev`: in produzione la costante
 * diventa `false`, il resto è codice morto e né i mock né faker (che è una
 * devDependency) entrano nel bundle.
 *
 * `NUXT_MOCKS=false` nel .env li spegne tutti insieme: serve agli scenari [S],
 * che girano su `nuxt dev` e devono parlare con gli handler veri.
 */
export default defineEventHandler(async (event) => {
  if (!import.meta.dev || !useRuntimeConfig(event).mocks) return;

  const { serveMock } = await import('../mocks/index.ts');

  return await serveMock(event);
});
