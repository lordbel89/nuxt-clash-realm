import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { type RouteSpec, routes } from '../../server/api-registry.ts';
import { buildOpenApi, SPEC_FILE } from '../../scripts/api-spec.ts';

/**
 * Il registro delle rotte è la fonte dell'OpenAPI. Questi test impediscono che resti indietro
 * rispetto agli handler, e che `docs/api/openapi.json` resti indietro rispetto al registro.
 */

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const API_DIR = join(ROOT, 'server/api');
const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete']);

interface HandlerFile {
  key: string;
  file: string;
  source: string;
}

/** `users/[id].get.ts` → `GET /api/users/:id`. Fuori `/api/auth/**`, che è di Better Auth. */
async function handlerFiles(): Promise<HandlerFile[]> {
  const entries = await readdir(API_DIR, { recursive: true, withFileTypes: true });
  const files: HandlerFile[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.ts')) continue;

    const file = relative(API_DIR, join(entry.parentPath, entry.name));
    if (file.startsWith('auth/')) continue;

    const parts = file.replace(/\.ts$/, '').split('.');
    const method = METHODS.has(parts.at(-1)!) ? parts.pop()!.toUpperCase() : 'ALL';
    const path = `/api/${parts.join('.')}`
      .replace(/\/index$/, '')
      .replace(/\[\.\.\.\w*\]/g, '**')
      .replace(/\[(\w+)\]/g, ':$1');

    files.push({ key: `${method} ${path}`, file, source: await readFile(join(API_DIR, file), 'utf8') });
  }

  return files;
}

/** Il nome con cui ogni schema è esportato da `shared/schemas/`, per confrontarlo con il sorgente dell'handler. */
async function schemaNames() {
  const dir = join(ROOT, 'shared/schemas');
  const names = new Map<unknown, string>();

  for (const file of await readdir(dir)) {
    const module = await import(join(dir, file)) as Record<string, unknown>;
    for (const [name, value] of Object.entries(module)) names.set(value, name);
  }

  return names;
}

const key = (route: RouteSpec) => `${route.method} ${route.path}`;

test('ogni handler ha la sua voce nel registro, e ogni voce disponibile ha il suo handler', async () => {
  const files = (await handlerFiles()).map(handler => handler.key).sort();
  const implemented = routes.filter(route => route.status !== 'proposed').map(key).sort();

  assert.deepEqual(files, implemented, 'registro (server/api-registry.ts) e handler (server/api/) divergono');
});

test('una rotta proposta non ha ancora un handler', async () => {
  const files = new Set((await handlerFiles()).map(handler => handler.key));

  for (const route of routes.filter(route => route.status === 'proposed')) {
    assert.ok(!files.has(key(route)), `${key(route)} ha un handler: passala ad 'available'`);
  }
});

test('nessuna rotta compare due volte nel registro', () => {
  const keys = routes.map(key);
  assert.deepEqual(keys, [...new Set(keys)]);
});

test('ogni handler usa gli schemi, il tipo di risposta e l\'accesso dichiarati nel registro', async () => {
  const names = await schemaNames();
  const handlers = new Map((await handlerFiles()).map(handler => [handler.key, handler]));

  for (const route of routes.filter(route => route.status !== 'proposed')) {
    const { file, source } = handlers.get(key(route))!;
    const read = (reader: string) => source.match(new RegExp(`${reader}\\(event, (\\w+)\\)`))?.[1];

    assert.equal(read('readParams'), route.params && names.get(route.params), `${file}: parametri di rotta`);
    assert.equal(read('readQuery'), route.query && names.get(route.query), `${file}: query`);
    assert.equal(read('readInput'), route.body && names.get(route.body), `${file}: body`);

    const response = source.match(/\):\s*Promise<(.+)>\s*=>/)?.[1];
    assert.equal(response, route.response, `${file}: tipo di risposta`);

    const requiresSession = /\brequire(?:Session|UserId|\w*Role)\(/.test(source);
    assert.equal(requiresSession, route.access === 'session', `${file}: accesso`);
  }
});

test('docs/api/openapi.json è aggiornato (altrimenti: npm run api:spec)', async () => {
  assert.equal(await readFile(SPEC_FILE, 'utf8'), await buildOpenApi());
});
