import { parseArgs } from 'node:util';

/**
 * Prova rapida di un'istanza già in piedi (produzione o locale): health, login, e un flusso SSE che
 * deve restare aperto oltre i 60 secondi dietro il proxy, ricevendo `hello`, un evento quando il
 * torneo cambia e almeno un `ping`.
 *
 *     SMOKE_EMAIL=… SMOKE_PASSWORD=… npm run smoke -- --url https://clash-realm.example.com
 *
 * Serve un account creato con `user:create`. La prova lascia nel database un'organizzazione «Smoke
 * test» con un torneo in bozza «Smoke test A/B», che riusa a ogni esecuzione.
 */

const { values } = parseArgs({
  options: {
    url: { type: 'string' },
    seconds: { type: 'string', default: '65' },
  },
  strict: true,
});

const base = values.url?.replace(/\/+$/, '');
const email = process.env.SMOKE_EMAIL;
const password = process.env.SMOKE_PASSWORD;
const seconds = Number(values.seconds);

if (!base || !email || !password || !Number.isFinite(seconds)) {
  console.error('Uso: SMOKE_EMAIL=… SMOKE_PASSWORD=… npm run smoke -- --url <https://…> [--seconds 65]');
  process.exit(1);
}

let cookie = '';

const call = (path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set('Origin', base);
  if (cookie) headers.set('Cookie', cookie);
  if (init.body) headers.set('Content-Type', 'application/json');

  return fetch(`${base}${path}`, { ...init, headers });
};

function step(message: string) {
  console.info(`• ${message}`);
}

function fail(message: string): never {
  console.error(`✖ ${message}`);
  process.exit(1);
}

async function json<T>(response: Response, what: string): Promise<T> {
  if (!response.ok) fail(`${what}: ${response.status} ${await response.text()}`);

  return await response.json() as T;
}

async function main() {
  const health = await call('/api/health');
  if (!health.ok) fail(`/api/health risponde ${health.status}`);
  step('health: il database risponde');

  const login = await call('/api/auth/sign-in/email', { method: 'POST', body: JSON.stringify({ email, password }) });
  if (!login.ok) fail(`login fallito: ${login.status} ${await login.text()}`);
  cookie = login.headers.getSetCookie().map(header => header.split(';')[0]).join('; ');
  await json(await call('/api/users/me'), '/api/users/me');
  step('login: la sessione funziona');

  // La pagina più grande possibile: con quella predefinita (25) un account con molte organizzazioni
  // non troverebbe la sua e ne creerebbe un doppione a ogni giro
  const organizations = await json<{ items: { id: string; name: string; }[]; }>(await call('/api/organizations?limit=100'), 'organizzazioni');
  const organization = organizations.items.find(item => item.name === 'Smoke test')
    ?? await json<{ id: string; }>(await call('/api/organizations', { method: 'POST', body: JSON.stringify({ name: 'Smoke test' }) }), 'creazione organizzazione');

  const tournaments = await json<{ items: { id: string; name: string; }[]; }>(await call(`/api/tournaments?organizationId=${organization.id}&limit=100`), 'tornei');
  const existing = tournaments.items.find(item => item.name.startsWith('Smoke test'));
  const tournament = existing
    ?? await json<{ id: string; name: string; }>(await call('/api/tournaments', {
      method: 'POST',
      body: JSON.stringify({ organizationId: organization.id, name: 'Smoke test A', game: 'Smoke' }),
    }), 'creazione torneo');

  const stream = await call(`/api/tournaments/${tournament.id}/stream`);
  if (!stream.ok || !stream.body) fail(`il flusso risponde ${stream.status}`);
  step(`flusso aperto, lo tengo per ${seconds} secondi…`);

  // Cambia il nome poco dopo l'apertura: deve arrivare l'evento
  setTimeout(() => {
    const next = tournament.name === 'Smoke test A' ? 'Smoke test B' : 'Smoke test A';
    call(`/api/tournaments/${tournament.id}`, { method: 'PATCH', body: JSON.stringify({ name: next }) })
      .then(response => response.ok || fail(`PATCH del torneo: ${response.status}`));
  }, 2000);

  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  const events: string[] = [];
  const startedAt = Date.now();
  let ended = false;
  let buffer = '';

  while (Date.now() - startedAt < seconds * 1000) {
    const remaining = seconds * 1000 - (Date.now() - startedAt);
    const chunk = await Promise.race([reader.read(), new Promise<null>(resolve => setTimeout(() => resolve(null), remaining))]);
    if (chunk === null) break;
    if (chunk.done) {
      ended = true;
      break;
    }

    buffer += decoder.decode(chunk.value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop()!;
    for (const block of blocks) events.push(block.split('\n')[0]!.replace('event: ', ''));
  }
  await reader.cancel().catch(() => {});

  if (ended) fail(`il flusso si è chiuso dopo ${Math.round((Date.now() - startedAt) / 1000)} secondi: il proxy lo taglia?`);
  // Il `ping` parte ogni 30 secondi: in meno tempo non può esserci
  for (const expected of seconds > 31 ? ['hello', 'tournament.updated', 'ping'] : ['hello', 'tournament.updated']) {
    if (!events.includes(expected)) fail(`nessun evento «${expected}» in ${seconds} secondi (ricevuti: ${events.join(', ') || 'nessuno'})`);
  }
  step(`flusso: rimasto aperto ${seconds} secondi, eventi ${[...new Set(events)].join(', ')}`);

  console.info('✔ tutto a posto');
}

main().catch(error => fail(error instanceof Error ? error.message : String(error)));
