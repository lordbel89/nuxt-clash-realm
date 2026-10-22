import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toJsonSchema } from '@valibot/to-json-schema';
import { createGenerator } from 'ts-json-schema-generator';
import type { GenericSchema } from 'valibot';
import { type RouteSpec, routes } from '../server/api-registry.ts';

/**
 * Genera `docs/api/openapi.json` dal registro delle rotte (`server/api-registry.ts`).
 *
 *     npm run api:spec              # riscrive il file
 *     npm run api:spec -- --check   # esce con 1 se il file non è aggiornato
 *
 * - Ingressi: gli schemi Valibot di `shared/schemas`, convertiti con `@valibot/to-json-schema`
 *   nella forma d'ingresso (prima delle `transform`: un id marchiato resta una stringa uuid).
 * - Risposte: i tipi di `shared/types`, convertiti con `ts-json-schema-generator`. I tipi
 *   marchiati diventano stringhe, i commenti JSDoc diventano descrizioni.
 * - Convenzioni: il testo di `docs/api/README.md` diventa la descrizione del riferimento.
 */

const ROOT = fileURLToPath(new URL('..', import.meta.url));
export const SPEC_FILE = join(ROOT, 'docs/api/openapi.json');
const README_FILE = join(ROOT, 'docs/api/README.md');
const TYPES_DIR = join(ROOT, 'shared/types');

type JsonSchema = Record<string, unknown>;

/** La specifica completa, serializzata in modo stabile: due generazioni dallo stesso codice danno lo stesso testo. */
export async function buildOpenApi(): Promise<string> {
  // ApiErrorData non è la risposta di nessuna rotta, ma il corpo dei 400 la usa
  const responses = await responseSchemas([...routes.map(route => route.response).filter(type => type !== 'void'), 'ApiErrorData']);
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of routes) {
    const path = route.path.replace(/:(\w+)/g, '{$1}');
    paths[path] ??= {};
    paths[path][route.method.toLowerCase()] = operation(route, responses.refs.get(route.response));
  }

  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Clash Realm API',
      version: 'v1-dev',
      description: await readFile(README_FILE, 'utf8'),
    },
    tags: [...new Set(routes.map(route => route.tag))].map(name => ({ name })),
    paths,
    components: {
      schemas: { ...ERROR_SCHEMAS, ...responses.schemas },
      securitySchemes: {
        session: {
          type: 'apiKey',
          in: 'cookie',
          name: 'better-auth.session_token',
          description: 'Il cookie di sessione di Better Auth, impostato da `POST /api/auth/sign-in/email`.',
        },
      },
    },
  };

  return `${JSON.stringify(spec, null, 2)}\n`;
}

const STATUS_LABEL = { proposed: 'proposto', available: 'disponibile', deprecated: 'deprecato' } as const;

function operation(route: RouteSpec, responseRef: JsonSchema | undefined) {
  const parameters = [
    ...objectParameters(route.params, 'path'),
    ...objectParameters(route.query, 'query'),
  ];
  const hasInput = Boolean(route.params || route.query || route.body);

  const errors: Record<string, unknown> = {};
  if (hasInput) errors['400'] = errorResponse('Dati non validi: i messaggi per campo sono in `data`', 'ValidationError');
  if (route.access === 'session') errors['401'] = errorResponse('Autenticazione richiesta');
  for (const [status, description] of Object.entries(route.errors ?? {})) {
    errors[status] = errorResponse(description);
  }

  return {
    'tags': [route.tag],
    'summary': route.summary,
    'description': [`**Stato:** ${STATUS_LABEL[route.status]}`, route.description].filter(Boolean).join('\n\n'),
    'x-status': route.status,
    ...(route.status === 'deprecated' && { deprecated: true }),
    ...(route.access === 'session' ? { security: [{ session: [] }] } : { security: [] }),
    ...(parameters.length > 0 && { parameters }),
    ...(route.body && {
      requestBody: { required: true, content: { 'application/json': { schema: inputSchema(route.body) } } },
    }),
    'responses': {
      ...successResponse(route, responseRef),
      ...errors,
    },
  };
}

function successResponse(route: RouteSpec, responseRef: JsonSchema | undefined) {
  if (route.stream) {
    return { 200: { description: route.stream, content: { 'text/event-stream': { schema: { type: 'string' } } } } };
  }

  return responseRef
    ? { 200: { description: 'OK', content: { 'application/json': { schema: responseRef } } } }
    : { 204: { description: 'Fatto, nessun contenuto' } };
}

function errorResponse(description: string, schema = 'ApiError') {
  return { description, content: { 'application/json': { schema: { $ref: `#/components/schemas/${schema}` } } } };
}

/** Lo schema d'ingresso, senza `$schema`: in OpenAPI 3.1 il dialetto lo dichiara il documento. */
function inputSchema(schema: GenericSchema): JsonSchema {
  const { $schema: _, ...json } = toJsonSchema(schema, {
    typeMode: 'input',
    errorMode: 'ignore',
    overrideAction: ({ valibotAction, jsonSchema }) => {
      // `isoDateTime` di Valibot è un orario locale senza fuso (`2026-11-29T10:00`); il `date-time`
      // di JSON Schema invece vuole l'offset, quindi direbbe il contrario
      if (valibotAction.type !== 'iso_date_time') return undefined;
      const { format: __, ...rest } = jsonSchema as JsonSchema;
      return {
        ...rest,
        pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$',
        description: 'Orario locale nel fuso del torneo, senza fuso né secondi',
        examples: ['2026-11-29T10:00'],
      };
    },
  }) as JsonSchema;
  return json;
}

/** Un oggetto di parametri (rotta o query) diventa un parametro OpenAPI per proprietà. */
function objectParameters(schema: GenericSchema | undefined, location: 'path' | 'query') {
  if (!schema) return [];

  const json = inputSchema(schema) as { properties?: Record<string, JsonSchema>; required?: string[]; };

  return Object.entries(json.properties ?? {}).map(([name, property]) => ({
    name,
    in: location,
    required: location === 'path' || (json.required ?? []).includes(name),
    schema: property,
  }));
}

/**
 * Lo schema di ogni tipo di risposta. Il generatore lavora su file: si scrive un modulo
 * temporaneo con un alias per ogni espressione del registro e gli import di tutti i nomi
 * esportati da `shared/types`, così il registro può usare un nome senza dire da dove viene.
 */
async function responseSchemas(expressions: string[]) {
  const unique = [...new Set(expressions)];
  const dir = await mkdtemp(join(tmpdir(), 'clash-api-spec-'));

  try {
    const imports: string[] = [];
    for (const file of (await readdir(TYPES_DIR)).filter(name => name.endsWith('.ts')).sort()) {
      const source = await readFile(join(TYPES_DIR, file), 'utf8');
      const names = [...source.matchAll(/^export (?:interface|type) (\w+)/gm)].map(match => match[1]);
      if (names.length > 0) imports.push(`import type { ${names.join(', ')} } from '${join(TYPES_DIR, file)}';`);
    }

    const aliases = unique.map((expression, index) => `export type Response${index} = ${expression};`);
    await writeFile(join(dir, 'responses.ts'), [...imports, ...aliases].join('\n'));
    await writeFile(join(dir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        strict: true,
        target: 'ESNext',
        module: 'ESNext',
        moduleResolution: 'bundler',
        allowImportingTsExtensions: true,
        noEmit: true,
        skipLibCheck: true,
        noUnusedLocals: false,
        paths: { '#shared/*': [join(ROOT, 'shared/*')] },
      },
      files: ['responses.ts'],
    }));

    // Il controllo dei tipi resta acceso: un nome sbagliato nel registro deve fermare la generazione
    const generator = createGenerator({
      path: join(dir, 'responses.ts'),
      tsconfig: join(dir, 'tsconfig.json'),
      type: '*',
      expose: 'export',
      topRef: false,
      jsDoc: 'extended',
      additionalProperties: false,
    });

    const definitions: Record<string, JsonSchema> = {};
    const roots = new Map<string, JsonSchema>();

    unique.forEach((expression, index) => {
      const { definitions: found = {}, $schema: _, ...root } = generator.createSchema(`Response${index}`) as JsonSchema & { definitions?: Record<string, JsonSchema>; };
      Object.assign(definitions, found);
      roots.set(expression, root);
    });

    return normalizeDefinitions(definitions, roots);
  }
  finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Riporta le definizioni del generatore a componenti OpenAPI:
 * - i nomi generici (`Paginated<UserSummary>`) diventano nomi validi (`Paginated_UserSummary`);
 * - `Branded<string,"UserId">` si scioglie nel suo tipo base: il marchio esiste solo in TypeScript;
 * - i `$ref` puntano a `#/components/schemas/…`, in ordine alfabetico per un diff leggibile.
 */
function normalizeDefinitions(definitions: Record<string, JsonSchema>, roots: Map<string, JsonSchema>) {
  const branded = new Map<string, JsonSchema>();
  const names = new Map<string, string>();

  for (const [name, schema] of Object.entries(definitions)) {
    if (name.startsWith('Branded<')) branded.set(name, schema);
    else names.set(name, name.replace(/[<,]/g, '_').replace(/[>"\s]/g, ''));
  }

  const rewrite = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(rewrite);
    if (!value || typeof value !== 'object') return value;

    const object = value as JsonSchema;
    if (typeof object.$ref === 'string') {
      const target = decodeURIComponent(object.$ref.replace('#/definitions/', ''));
      if (branded.has(target)) return rewrite(branded.get(target));
      return { ...object, $ref: `#/components/schemas/${names.get(target)}` };
    }

    return Object.fromEntries(Object.entries(object).map(([key, child]) => [key, rewrite(child)]));
  };

  const schemas: Record<string, JsonSchema> = {};
  for (const [original, name] of [...names].sort(([, a], [, b]) => a.localeCompare(b))) {
    schemas[name] = rewrite(definitions[original]) as JsonSchema;
  }

  const refs = new Map([...roots].map(([expression, root]) => [expression, rewrite(root) as JsonSchema]));

  return { schemas, refs };
}

/**
 * Il corpo di ogni errore nostro, cioè la serializzazione di `createError` in h3. Non è in
 * `shared/types` perché la forma è di h3: il frontend la riceve come `FetchError` e legge
 * `error.data.message`. Gli errori di `/api/auth/**` hanno la forma di Better Auth.
 */
const ERROR_SCHEMAS: Record<string, JsonSchema> = {
  ApiError: {
    type: 'object',
    properties: {
      statusCode: { type: 'integer' },
      statusMessage: { type: 'string', description: 'La reason phrase HTTP, in inglese: non mostrarla all\'utente' },
      message: { type: 'string', description: 'Il testo in italiano per l\'utente' },
      data: {},
    },
    required: ['statusCode', 'statusMessage', 'message'],
  },
  ValidationError: {
    allOf: [
      { $ref: '#/components/schemas/ApiError' },
      {
        type: 'object',
        properties: { data: { $ref: '#/components/schemas/ApiErrorData' } },
        required: ['data'],
      },
    ],
  },
};

async function main() {
  const spec = await buildOpenApi();

  if (process.argv.includes('--check')) {
    const current = await readFile(SPEC_FILE, 'utf8').catch(() => '');
    if (current !== spec) {
      console.error('docs/api/openapi.json non è aggiornato: lancia `npm run api:spec`.');
      process.exit(1);
    }
    console.info('docs/api/openapi.json è aggiornato.');
    return;
  }

  await writeFile(SPEC_FILE, spec);
  console.info(`Scritto docs/api/openapi.json (${routes.length} rotte).`);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
