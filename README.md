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

## Struttura

```
app/          frontend Nuxt (pagine, componenti, layout, tema)
server/       backend Nitro: api/, database/ (schema, migrazioni, seed), mappers/
shared/       codice condiviso client/server: types/ (DTO) e schemas/ (Valibot)
public/       asset statici
```

Le convenzioni di architettura — contratto API a tre livelli, checklist per aggiungere un'entità, livelli del tema — sono documentate in [CLAUDE.md](CLAUDE.md).

## Documentazione di riferimento

- [Nuxt](https://nuxt.com/docs/getting-started/introduction) · [deployment](https://nuxt.com/docs/getting-started/deployment)
- [Nuxt UI](https://ui.nuxt.com/)
- [Drizzle ORM](https://orm.drizzle.team/docs/overview)
