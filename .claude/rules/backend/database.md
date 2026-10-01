---
paths:
  - "server/database/**"
  - "server/utils/database.ts"
  - "server/plugins/**"
  - "drizzle.config.ts"
---

# Database

```bash
npm run db:generate    # genera le migrazioni dallo schema
npm run db:migrate     # applica le migrazioni al database configurato in .env
npm run db:seed        # dati di sviluppo (rieseguibile)
npm run db:studio      # Drizzle Studio sul database configurato in .env
```

Drizzle ORM 1.0 (rc) with Relational Queries v2: `db.query.users.findMany(...)`, with relations declared via `defineRelations()` in `server/database/relations.ts`, separate from the schema.

**Postgres everywhere, one schema, one set of migrations.** Locally the driver is PGlite (`@electric-sql/pglite`), the same Postgres compiled to WASM, running in-process with its data in `.data/pglite`, so development needs nothing installed. Production is a real Postgres reached over the network via `postgres-js`. **It is provisioned and operated outside this repo**, which only holds the connection string in `NUXT_DATABASE_URL`. Both speak the same SQL: write `pgTable`, `uuid()`, `timestamptz`, `jsonb` freely.

Schema lives in `server/database/schema/`, one file per area, re-exported by `index.ts`, which is what drizzle-kit and `defineRelations()` read. Add a table there and run `npm run db:generate`. **Forgetting the `export *` line in `index.ts` fails silently**: no migration and no error.

`createDatabase()` in `server/database/client.ts` picks the driver from `runtimeConfig.database.dialect`. The exported `Database` type is the network-Postgres one, and the PGlite client is cast onto it. Handlers get the shared instance from the auto-imported, async `useDatabase()`: `const db = await useDatabase()`.

The PGlite driver is imported through a **variable specifier** (`const pgliteDriver = 'drizzle-orm/pglite'`) precisely so the bundler cannot resolve it statically. That keeps 17 MB of WASM out of `.output` (11 MB instead of 29 MB) and lets PGlite stay a devDependency. Turning that back into a normal import will silently quadruple the production build.

Config comes from `NUXT_DATABASE_*` (see `.env.example`). Defaults live in `server/database/env.ts` and feed both `runtimeConfig` and `drizzle.config.ts`, so there is one place to change them.

PGlite is a single connection with no pool. That is fine for development, but it will not surface concurrency or locking bugs. Anything that depends on transactional behaviour under load has to be checked against a real Postgres.

## Columns and ids

- The id column carries the brand: `uuid('id').$type<UserId>()`, so rows arrive branded and mappers need no cast.
- Drizzle's shorthand equality filter is disabled for object-typed columns, and a branded intersection counts as one. Write `where: { id: { eq: id } }`, not `where: { id }`.
- A list's `orderBy` needs a tiebreaker (`{ createdAt: 'asc', id: 'asc' }`). `defaultNow()` is the transaction timestamp, so rows written by one statement share it, and equal sort keys make page boundaries non-deterministic.
