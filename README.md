# Clash Realm

Applicazione Nuxt 4 per la gestione di tornei. Stack: Nuxt UI v4 + Tailwind 4 sul frontend, Nitro + Drizzle ORM su Postgres sul backend.

## Requisiti

- Node **v24.11.0** (versione fissata in `.nvmrc`: `nvm use`)
- Nessun database da installare in locale: lo sviluppo usa PGlite, cioè Postgres compilato in WASM che gira in-process e tiene i dati in `.data/pglite`.

## Avvio rapido

```bash
nvm use
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev
```

`npm install` esegue in automatico `nuxt prepare` (hook `postinstall`), che genera la cartella `.nuxt/` con i tipi e la config ESLint.

## Comandi

### Applicazione

| Comando | A cosa serve |
|---|---|
| `npm run dev` | Avvia il dev server con HMR su [http://localhost:3000](http://localhost:3000). La porta è fissata in `nuxt.config.ts` (`devServer.port`). |
| `npm run build` | Build di produzione in `.output/`, server Nitro incluso. |
| `npm run preview` | Serve la build appena prodotta in locale, per verificarla prima del deploy. Richiede un `build` precedente. |
| `npm run generate` | Build statica (pre-rendering). Presente perché fa parte dello starter Nuxt, ma non è il target di deploy di questo progetto: le API hanno bisogno del server Nitro. |
| `npm install` → `postinstall` | Lancia `nuxt prepare`: rigenera `.nuxt/` (tipi auto-importati, `.nuxt/eslint.config.mjs`). Da rieseguire a mano con `npx nuxt prepare` se `.nuxt/` manca o è disallineata. |

### Database

| Comando | A cosa serve |
|---|---|
| `npm run db:generate` | `drizzle-kit generate`: confronta lo schema in `server/database/schema/` con le migrazioni esistenti e scrive il file SQL della differenza in `server/database/migrations/`. Non tocca il database. Da lanciare dopo ogni modifica allo schema. |
| `npm run db:migrate` | Esegue `server/database/migrate.ts`: applica le migrazioni pendenti al database configurato in `.env`. |
| `npm run db:seed` | Esegue `server/database/seed.ts`: popola il database con i dati di sviluppo. È rieseguibile, non duplica le righe. |
| `npm run db:studio` | Apre Drizzle Studio, la UI web per ispezionare e modificare i dati del database configurato in `.env`. |

Tutti e quattro leggono la configurazione da `.env` tramite `server/database/env.ts` — girano come processi Node autonomi, fuori dal contesto Nuxt, quindi vedono l'ambiente descritto lì, non `runtimeConfig`.

Un solo dialetto SQL (`postgresql`) e un solo set di migrazioni: valgono sia per PGlite in locale sia per il Postgres di produzione.

### Lint

Non c'è uno script npm dedicato: `@nuxt/eslint` genera la flat config dentro `.nuxt/`, quindi si usa direttamente il binario.

```bash
npx eslint .
npx eslint . --fix
```

Se ESLint si lamenta di una config mancante, esegui prima `npx nuxt prepare`.

### Test

Non è presente alcun setup di test in questo repository.

## Configurazione

Le variabili stanno in `.env` (vedi `.env.example`); i default sono in `server/database/env.ts` e alimentano sia `runtimeConfig` sia `drizzle.config.ts`.

| Variabile | Default | Significato |
|---|---|---|
| `NUXT_DATABASE_DIALECT` | `pglite` | `pglite` in sviluppo, `postgres` in produzione. Sceglie il driver in `server/database/client.ts`. |
| `NUXT_DATABASE_PGLITE_PATH` | `.data/pglite` | Cartella dati di PGlite. Usata solo con dialetto `pglite`. |
| `NUXT_DATABASE_URL` | *(vuota)* | Stringa di connessione al Postgres di produzione. Usata solo con dialetto `postgres`. |

Per ripartire da un database pulito in locale basta cancellare la cartella dati di PGlite e rilanciare migrazioni e seed:

```bash
rm -rf .data/pglite && npm run db:migrate && npm run db:seed
```

## Mock

Dati finti serviti da Nitro **solo in sviluppo**: servono a lavorare su una pagina prima che l'endpoint esista, o a riprodurre a comando uno stato che il database non ha. Un mock è un file TypeScript in `server/mocks/` — un JSON con i superpoteri di tipi, faker e funzioni.

```ts
// server/mocks/tournaments.mock.ts
import { fakerIT as faker } from '@faker-js/faker';
import { defineMock } from './define.ts';

export default defineMock<Paginated<Tournament>>({
  method: 'GET',
  path: '/api/tournaments',
  enabled: true,
  delay: 500,
  data: () => ({ items: [/* faker… */], total: 6, limit: 25, offset: 0 }),
});
```

Poi una riga in `server/mocks/index.ts`, che è l'elenco dei mock esistenti. Un file può esportare un mock solo o un array, per tenere insieme le rotte di una stessa entità.

| Campo | A cosa serve |
|---|---|
| `method` | `'GET'`, `'POST'`, `'PUT'`, `'PATCH'`, `'DELETE'`. |
| `path` | Percorso dell'endpoint, con `:nome` per i parametri: `'/api/tournaments/:id'`. Arrivano in `data`. |
| `enabled` | `false` spegne il singolo mock. Default `true`, ma nei file è scritto esplicitamente: è lì che si mette `false`. |
| `delay` | Millisecondi di attesa: è così che si vedono gli stati di caricamento. |
| `data` | Il corpo della risposta. Un valore per dati fissi, una funzione `({ params, query, event })` per generarli a ogni chiamata. |

- **Accendere e spegnere una chiamata alla volta**: `enabled: false` e la richiesta prosegue verso l'handler reale — se non esiste, torna il suo 404. Nitro ricarica al salvataggio, non serve riavviare.
- **Un mock spento non si cancella**: quando l'endpoint vero funziona, il file resta lì da spegnere e riaccendere. È lo strumento per riprodurre a comando un caso che il database non ha — duecento partecipanti, un 500, una risposta lenta — aggiornandone i dati il giorno che quel caso serve.
- **Riconoscerli**: ogni risposta che arriva da un mock porta l'header `MOCK_DATA: true`, e nessun'altra. Nel tab Network si vede a colpo d'occhio quali chiamate della pagina sono vere.
- **Endpoint che non esistono ancora**: i mock passano da un middleware, quindi rispondono prima del routing. La pagina chiama `useFetch('/api/tournaments')` e riceve i dati anche senza `server/api/tournaments.get.ts` (vedi `app/pages/tournaments/index.vue`). In quel caso il generico su `useFetch` è necessario, perché non c'è una rotta da cui inferire il tipo: va tolto quando l'handler arriva.
- **Precedenza**: un mock acceso vince sull'handler reale. È voluto — accenderlo non richiede di toccare `server/api/`.
- **Errori**: `data` può lanciare. `throw createError({ statusCode: 500 })` fa arrivare alla pagina l'errore vero, non un caso finto da gestire a parte.
- **Fuori dallo sviluppo non esistono**: il middleware è dietro `import.meta.dev`, che in build diventa `false`; né i mock né `@faker-js/faker` (devDependency) entrano nel bundle di produzione.

## Struttura

```
app/          frontend Nuxt (pagine, componenti, layout, tema)
server/       backend Nitro: api/, database/ (schema, migrazioni, seed), mappers/, mocks/
shared/       codice condiviso client/server: types/ (DTO) e schemas/ (Valibot)
public/       asset statici
```

Le convenzioni di architettura — contratto API a tre livelli, checklist per aggiungere un'entità, livelli del tema — sono documentate in [CLAUDE.md](CLAUDE.md).

## Documentazione di riferimento

- [Nuxt](https://nuxt.com/docs/getting-started/introduction) · [deployment](https://nuxt.com/docs/getting-started/deployment)
- [Nuxt UI](https://ui.nuxt.com/)
- [Drizzle ORM](https://orm.drizzle.team/docs/overview)
