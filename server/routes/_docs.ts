/**
 * GET /_docs — il riferimento dell'API (Scalar) su docs/api/openapi.json. Solo in sviluppo.
 *
 * Scalar arriva dal CDN con una versione fissa: è una pagina per chi sviluppa, non vale una
 * dipendenza. Le prove dal browser usano il cookie di sessione già presente su questa origine.
 */
const SCALAR = 'https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.72.4';

export default defineEventHandler((event) => {
  if (!import.meta.dev) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Pagina non trovata' });
  }

  setResponseHeader(event, 'Content-Type', 'text/html; charset=utf-8');

  return `<!doctype html>
<html lang="it">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Clash Realm API</title>
  </head>
  <body>
    <div id="app"></div>
    <script src="${SCALAR}"></script>
    <script>
      Scalar.createApiReference('#app', { url: '/_docs/openapi.json', withDefaultFonts: false });
    </script>
  </body>
</html>`;
});
