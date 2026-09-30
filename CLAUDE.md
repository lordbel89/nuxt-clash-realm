# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # dev server on http://localhost:3000 (port pinned in nuxt.config.ts)
npm run build      # production build
npm run preview    # preview the production build
npx eslint .       # lint (no npm script; @nuxt/eslint generates the flat config into .nuxt/)
npx eslint . --fix

npm run db:generate    # genera le migrazioni dallo schema
npm run db:migrate     # applica le migrazioni al database configurato in .env
npm run db:seed        # dati di sviluppo (rieseguibile)
npm run db:studio      # Drizzle Studio sul database configurato in .env
```

Node version is pinned in `.nvmrc` to the major `26` (LTS from 2026-10-28), which nvm resolves to the latest 26.x. Node 26 is required for native `Temporal`. Lint requires `.nuxt/eslint.config.mjs`, produced by `nuxt prepare` (runs on `postinstall`) — run `npx nuxt prepare` first if `.nuxt/` is missing.

There is no test setup in this repo.

## Architecture

Nuxt 4 app for running tabletop/esports tournaments. The frontend pages still hold empty `ref`s: no API route consumes the database yet, so every page is unwired.

The backend lives in `server/` (Nitro). See "Database" and "API contract" below. `app/types/tournament.ts` is still the frontend's own source of truth: migrate a type into `shared/types/` only when the endpoint that produces it actually exists.

### The `ponytail:` marker

Comments prefixed `ponytail:` mark deliberate backend-integration seams (data fetching, auth, validation schemas). They are not TODO cruft — they name exactly what the backend contract should be, e.g. `useFetch<Tournament[]>('/api/tournaments')`. Keep the marker when touching such code; remove it only when actually wiring the backend. `grep -rn "ponytail" app` lists every open seam.

### Domain model

`app/types/tournament.ts` is the single source of truth: `Tournament` → `Round[]` → `Match[]`, plus `Participant`, `Standing`, and `TournamentConfig` (the create/configure payload). Components take these types as props; pages own the state.

### Database

Drizzle ORM 1.0 (rc) with Relational Queries v2 — `db.query.users.findMany(...)`, relations declared via `defineRelations()` in `server/database/relations.ts`, separate from the schema.

**Postgres everywhere, one schema, one set of migrations.** Locally the driver is PGlite (`@electric-sql/pglite`) — the same Postgres compiled to WASM, running in-process with its data in `.data/pglite`, so development needs nothing installed. Production is a real Postgres reached over the network via `postgres-js`; **it is provisioned and operated outside this repo**, which only ever holds the connection string in `NUXT_DATABASE_URL`. Both speak the same SQL: write `pgTable`, `uuid()`, `timestamptz`, `jsonb` freely.

Schema lives in `server/database/schema/`, one file per area, re-exported by `index.ts` — which is what drizzle-kit and `defineRelations()` read. Add a table there and run `npm run db:generate`.

`createDatabase()` in `server/database/client.ts` picks the driver from `runtimeConfig.database.dialect`; the exported `Database` type is the network-Postgres one, and the PGlite client is cast onto it. Handlers get the shared instance from the auto-imported `useDatabase()` — it is async: `const db = await useDatabase()`.

The PGlite driver is imported through a **variable specifier** (`const pgliteDriver = 'drizzle-orm/pglite'`) precisely so the bundler cannot resolve it statically. That keeps 17 MB of WASM out of `.output` (11 MB instead of 29 MB) and lets PGlite stay a devDependency. Turning that back into a normal import will silently quadruple the production build.

Config comes from `NUXT_DATABASE_*` (see `.env.example`); defaults live in `server/database/env.ts` and feed both `runtimeConfig` and `drizzle.config.ts`, so there is one place to change them.

PGlite is a single connection with no pool: fine for development, but it will not surface concurrency or locking bugs. Anything that depends on transactional behaviour under load has to be checked against a real Postgres.

### API contract

Three layers, and the middle one is the point: **the database row is not the API contract.**

1. `server/database/schema/users.ts` exports `UserRow` (`$inferSelect`) — never leaves `server/`.
2. `shared/types/user.ts` exports `User` — what handlers return and the frontend consumes, imported as `#shared/types/user` from both sides.
3. `server/mappers/user.ts` exports `toUser(row): UserRow → User` — the only place the two meet. Handlers never touch a `Row` themselves. The input direction (`toNew<Entity>Row(input): Input → NewRow`) has no live example right now: users are created by Better Auth, not by a body of ours. It comes back with the first entity that has a form of its own — see *The input mapper*.

The DTO's fields are written out one by one on purpose. That is an allowlist: a new column in `users` does not reach the frontend by itself, and `passwordHash` never can. Deriving the DTO with `Omit<UserRow, …>` would invert that and is the mistake to avoid. The mapper's signature is the consistency check — add a field to `User` or drop a column from `users` and it stops compiling.

Dates cross the wire as **ISO strings**, not `Date`. Nitro's `Serialize` type already maps `Date` to `string` in what `useFetch` infers (`T extends { toJSON(): infer U } ? U`), so a DTO typed `Date` would not blow up at runtime — it would disagree with the inferred type the moment anyone annotates a prop or a ref as `User`. The DTO says `string` so that the declared type and the inferred one are the same type. Converting back is the frontend's job.

**Output is mapped. Input is validated, then mapped.** Validation and mapping are different jobs and must not be confused. Output comes from your own database and is trusted: it goes through a mapper, no runtime validation. Input arrives from outside and is not: it goes through a Valibot schema in `shared/schemas/`, hand-written and **contract-first** — the rules there are business rules (a valid email, a name of at least two characters), not a mirror of the table's constraints, which the database already enforces. Validation answers "is this acceptable?" and knows nothing about tables. What comes out of it is the input DTO (`CreateTournamentInput`), and the input mapper answers the other question, "where does this go?" — see *The input mapper* below.

The schema lives in `shared/` because both sides use the same one: `UForm` validates the form with it, the `POST` handler validates the body with it. One definition, so the two cannot drift.

Schemas are never generated from the tables. `drizzle-valibot` would need the `pgTable` object, a runtime **value**, which would drag Drizzle and the table definitions into the client bundle — so a generated schema could not live in `shared/` at all. Coherence with the table is instead guaranteed by the input mapper's return type, not by the insert: see the next section for why `values(input)` alone is not a check.

Each schema file exports a constant and a type **with the same name**:

```ts
export const CreateTournamentInput = v.object({ … })
export type CreateTournamentInput = v.InferOutput<typeof CreateTournamentInput>
```

That is not a duplicate. The constant lives in value space (it exists at runtime and validates), the type in type space (it vanishes at compile time); they can share a name because TypeScript picks by position. The type is derived from the schema so there is still only one list of fields.

`server/api/users.get.ts` and `users/[id].get.ts` are the worked example for the output side — copy their shape for tournaments. Handlers are async because `useDatabase()` is: `const db = await useDatabase()`.

#### The input mapper

A mapper file has two directions. `toEntity(row)` turns a row into the output DTO; `toNewEntityRow(input)` turns the validated input DTO into the row to insert. The handler chains them and never sees a `Row` in between:

```ts
const input = await readInput(event, CreateTournamentInput);   // validated, still a DTO
const [row] = await db.insert(tournaments).values(toNewTournamentRow(input, organizerId)).returning();
return toTournament(row);
```

`user` has no input mapper today — Better Auth owns user creation — so the first one will be written for tournaments. Write it even when the shapes look identical: it is there for its **return type**. Passing `input` straight to `values()` is not the compile-time check it looks like: TypeScript does not excess-property-check a value that is not an object literal, so a contract field with no matching column compiles fine and Drizzle drops the key silently. The mapper returns an object literal typed `NewRow`, so there a field without a column is an error. The check is one-directional without it — a missing required column fails in `values()`, an extra field never does.

The mapper is also where everything that is not a 1:1 copy of the body lives, and that is what the contract stops being as soon as an entity has a real form:

- **A validated field that is not a column.** Registration will send `password`; the row holds `passwordHash`. Hashing is a translation, not a validation, and does not belong in a schema shared with the frontend.
- **A field the client does not send.** `organizerId` comes from the session, `status` always starts as `draft`. They are extra parameters of the mapper: `toNewTournamentRow(input, organizerId)`.
- **A field that spreads over columns or rows.** `TournamentConfig.location.name` / `.position` become two columns or a `jsonb`; `roundDurationMinutes` belongs to the rounds, not the tournament. One named function decides that, not code scattered across handlers.

Valibot does none of this: it validates, it does not translate. Keep the two jobs in their two files.

#### DTO variants: compose, never re-declare

One entity rarely has one shape. The same user is a name inside a tournament card, a full record on `/api/users`, and a record plus its tournaments on `/api/users/:id`. Writing three complete interfaces writes `id` and `name` six times, so **the smallest shape is the base and the others extend it by intersection**:

```ts
export interface UserSummary { id: UserId; name: string }          // what other DTOs embed
export type User = UserSummary & { email: string; … }              // the full record
export type UserDetail = User & { tornei: TournamentSummary[] }    // with relations loaded
```

Mappers follow the same ladder — `toUser` spreads `toUserSummary(row)`, `toUserDetail` spreads `toUser(row)` — so no field is mapped twice. The handler's explicit return type is what picks the variant for that route.

Nesting still goes downward only: `UserDetail` holds `TournamentSummary`, and `Tournament` holds `UserSummary` as its organizer. If both held the full shape the JSON would cycle. Having a small variant to embed is what makes that rule applicable.

**Spread a DTO, never a `Row`.** `{ ...toUser(row), … }` is safe; `{ ...row, … }` compiles just as well and puts `passwordHash` in the response, because TypeScript does not excess-property-check what comes from a spread. It is the only way this design can leak a column, and the whole remedy is that rule.

Variants are created when a real consumer needs one, not in advance. `user` has none yet because nothing embeds it.

#### Branded ids

`shared/types/ids.ts` exports `Branded<T, Name>` and one alias per entity (`UserId`). The brand lives only in type space — the JSON is an ordinary string — but it makes passing a `UserId` where a `TournamentId` is expected a compile error, which is the likeliest mistake once six entities all have an `id`.

The column carries the brand (`uuid('id').$type<UserId>()`), so rows arrive branded and mappers need no cast. Two consequences:

- Route params arrive as bare strings, so the brand is applied at that boundary and nowhere else, in the entity's params schema — through `brandedUuid<UserId>()` from `shared/schemas/common.ts`, which is the only place the cast is written.
- Drizzle's shorthand equality filter is disabled for object-typed columns, and an intersection counts as one: write `where: { id: { eq: id } }`, not `where: { id }`.

#### Validation at the boundary

Handlers do not call `v.safeParse` themselves. `server/utils/validation.ts` exports one reader per input source, each returning already-validated data, and is the single place where issues become a 400:

```ts
const { limit, offset } = readQuery(event, ListQuery);
const { id } = readParams(event, UserIdParams);
const input = await readInput(event, CreateTournamentInput);
```

Only `readInput` is async — reading the body is. These replace h3's `getValidatedQuery` / `getValidatedRouterParams` / `readValidatedBody` on purpose: those wrap whatever the validator throws inside their own 400, nesting the payload at `data.data`, so the response would no longer have the shape of `ApiErrorData`.

`shared/schemas/common.ts` holds the pieces that repeat across entities: `Uuid` (so no handler hand-rolls a regex), `brandedUuid<T>()` (the branded-id cast, written once), and `ListQuery` (`limit`, `offset`, with defaults, so no `findMany` is left uncapped). Both of those are capped — `MAX_LIMIT` bounds the work per request, `MAX_OFFSET` bounds the rows Postgres discards to reach a page, since a deep `OFFSET` is a sequential scan anyone can ask for. Per-entity params schemas live next to that entity's input schemas.

Write the type messages of a schema out by hand too, not just the business rules: Valibot's defaults are English (`Invalid type: Expected Object…`) and they reach the user through `ApiErrorData`. An object's message covers two positions — a body that is not an object at all, and a missing key — so phrase it to hold in both.

#### The two text fields of `createError`

`statusMessage` is the HTTP reason phrase and h3 strips every non-ASCII character from it (`H3Error.toJSON`), so `'Email già registrata'` reaches the client as `Email gi registrata`. It stays short, standard and English; the Italian text for the user goes in `message`, which Nitro forwards untouched for every 4xx, in dev and in production alike:

```ts
throw createError({ statusCode: 409, statusMessage: 'Conflict', message: 'Email già registrata' });
```

The frontend therefore reads `error.data.message`, never `error.statusMessage`.

#### Cross-cutting response shapes

`shared/types/api.ts` holds what is not specific to one entity:

- `Paginated<T>` — every list endpoint returns `{ items, total, limit, offset }`, never a bare array. Adding pagination later would be a breaking change of shape; adding it now is free. Two things follow. A consumer reads `data.items`, and **must not annotate the generic** — `useFetch<User[]>('/api/users')` compiles, silently overrides the inference from Nitro, and leaves the page reading a field that is not there. Write `useFetch('/api/users')` and let the handler's return type flow through. And a list's `orderBy` needs a tiebreaker (`{ createdAt: 'asc', id: 'asc' }`): `defaultNow()` is the transaction timestamp, so rows written by one statement share it, and equal sort keys make page boundaries non-deterministic — a row can repeat or disappear.
- `ApiErrorData` — the typed body of a validation `createError`, so the frontend reads `FetchError<ApiErrorData>` and puts messages back in the form without `any`. It carries `fields` for per-field messages and `messages` for issues that belong to no field (an empty body, a body that is not an object): Valibot's `flatten` puts those in `root`/`other`, and dropping them would send a 400 with nothing to display.

### Adding an entity

A new entity is spread across these files, and they must move together. Skipping one produces code that compiles and is wrong.

| # | File | What goes in it | Skipping it means |
|---|---|---|---|
| 1 | `server/database/schema/<entity>.ts` | `pgTable` + `Row` / `NewRow` types | — |
| 2 | `server/database/schema/index.ts` | one `export *` line | drizzle-kit does not see the table: **no migration, and no error either** |
| 3 | `server/database/relations.ts` | `r.one` / `r.many` if it has relations | `db.query` cannot use `with:` |
| 4 | `server/database/migrations/` | `npm run db:generate` | the code expects columns the database does not have |
| 5 | `shared/types/<entity>.ts` | the DTO and its variants, fields listed one by one | — |
| 6 | `server/mappers/<entity>.ts` | `toEntity(row): Row → DTO` and `toNewEntityRow(input): Input → NewRow` | the handler inserts the body as-is, and a contract field with no column is dropped silently |
| 7 | `shared/schemas/<entity>.ts` | Valibot input schemas + the route-params schema | the body reaches the database unvalidated |
| 8 | `server/api/<entity>*.ts` | the handlers | — |
| 9 | `server/database/seed.ts` | development data | — |

Then `npm run db:migrate` and, if you touched the seed, `npm run db:seed`.

**Which changes propagate where:**

- **New column** → 1, and 4. It reaches the frontend only if you also add it to 5 and 6: that is the allowlist working, not an oversight.
- **Renamed column** → 1, 4, 6. Neither the DTO (5) nor the input schema (7) has to follow: both mappers absorb the rename, and the frontend never notices. That is the whole point of the middle layer.
- **New field in the DTO** → 5 and 6 together. The mapper will not compile until you map it, which is the intended alarm.
- **New field in a form** → 7 and 6 together: the input mapper decides where the field goes, and 1 + 4 if that is a new column. Its `NewRow` return type is the alarm — a field the mapper writes into a column that does not exist will not compile. A field the mapper simply does not read (a `confirmPassword`, a consent checkbox) is validated and then dropped on purpose, and that is visible in the mapper rather than implicit in an `insert`.
- **New relation** → 3, and 5 + 6 if it is to be exposed: nest downward only (`Tournament` holds `Round[]`, `Round` does not hold `tournament`, otherwise the JSON has a cycle), and add a named variant composed by intersection (see *DTO variants*) instead of making the field optional.

Two recurring traps: forgetting step 2, which fails silently; and a junction table in a many-to-many that carries its own columns (a seed, an enrolment date) — that is an entity in its own right, not a plain array in the DTO.

### Authentication

Better Auth (`better-auth` + `@better-auth/drizzle-adapter`), self-hosted: the tables are in our own Postgres, the cookies are signed by our own server. Email + password only for now — no 2FA, no organizations, no OAuth, and no mailer, so email verification and password reset are off.

**The perimeter is declared, and it is the thing to remember: `/api/auth/**` is Better Auth's territory.** Its endpoints validate their own input, return their own shape and their own errors (`{ code, message }`). They do not go through `readInput`, they do not produce `ApiErrorData`, they do not touch a mapper. Everything else stays our contract. Do not "harmonise" the two — the client library reads that shape.

The two worlds meet in exactly one file, `server/utils/auth.ts`, which is to authentication what `readInput` is to validation:

```ts
const session = await requireSession(event);   // 401 se manca
const userId = await requireUserId(event);     // UserId, marchiato qui
```

`useAuth()` is the lazy singleton, same pattern (and same failure caching caveat) as `useDatabase()` — it depends on it, so it is async too.

- `server/auth/index.ts` — the Better Auth config: adapter, `usePlural: true` (our tables are plural), `generateId: 'uuid'`, and the ban hook.
- `server/auth/env.ts` — defaults outside the Nuxt context, mirroring `server/database/env.ts`. `NUXT_AUTH_SECRET` is mandatory in production; in dev a fallback secret keeps the project running without a `.env`.
- `server/database/schema/auth.ts` — `sessions`, `accounts`, `verifications`, written by hand rather than pasted from `npx auth generate` so the migrations keep coming from `npm run db:generate`. **The TypeScript property names are the contract with Better Auth** (`userId`, `expiresAt`, `accountId`…); the column names are ours and it never sees them. These rows have no DTO and no mapper — they never leave `server/`.
- `app/utils/authClient.ts` — the Vue client, auto-imported. `app/middleware/auth.ts` protects a page via `definePageMeta({ middleware: 'auth' })`.

The password lives in `accounts.password` (scrypt), never on the user row — which is why `users.passwordHash` is gone.

#### Banning

`bannedAt` / `banReason` / `bannedUntil` are our columns; Better Auth knows nothing about them. Enforcement is a single `databaseHooks.session.create.before` in `server/auth/index.ts` — every login method has to create a session, so one point covers them all. `bannedUntil` null means indefinite; a ban whose `bannedUntil` is in the past no longer blocks anything.

Two consequences that are easy to get wrong:

- **Banning does not close open sessions.** Whoever sets `bannedAt` must also call `auth.api.revokeUserSessions({ body: { userId } })`.
- **`session.cookieCache` is off on purpose.** With it on the server trusts the cookie instead of the database, and a banned user keeps browsing until the cache expires.

`isActive` is the older, separate flag (account deactivated, no reason, no expiry) and blocks sign-in too. If it ends up meaning the same thing as a ban, collapse the two rather than checking both forever.

### Routing and layouts

Three layouts serve three audiences:

- `default` — `UDashboardGroup` shell with collapsible sidebar. Page titles feed the navbar via `definePageMeta({ title })`, read by the layout from `route.meta.title`.
- `auth` — centered card, used by `/login`.
- `projector` — full-screen, **dark mode forced via a `.dark` class on its own root** so a projection stays dark while the app runs light. Used by `/tournaments/[id]/display`, which pairs with the oversized `text-screen` / `text-screen-lg` type scale for readability at a distance.

`/` immediately redirects to `/tournaments`.

### Navigation

Sidebar and header items are data, not markup: `app/config/navigation.ts` exports `appHeader`, `sideMenu` (array of sections, each an array of `NavigationMenuItem`), and `sideMenuFooter`. Add menu entries there, not in `layouts/default.vue`. `sideMenu` is wrapped in `sideMenuDecorator()` (`app/utils/sideMenuUtils.ts`, auto-imported), which applies consistent per-level icon colors — parents accent, children primary.

### Theming — three layers, in order

1. **Primitives** (`app/assets/css/tokens/color.css`, `palette.css`, `typography.css`, `layout.css`) — `@theme static` blocks defining raw Tailwind 4 tokens: the custom `winner`/`loser`/`blue-ribbon` 50→950 ramps, font stacks, the projection type scale, and Nuxt UI role variables like `--ui-radius`.
2. **Theme values** (`light.css`, `dark.css`) — only tokens that differ between themes, currently `--app-gradient`. `:root` and `.dark` have equal specificity, so **`dark.css` must remain the last import in `main.css`** or light wins.
3. **Semantic aliases** (`app/app.config.ts`) — maps `primary`/`accent`/`winner`/… onto palettes, and holds Nuxt UI per-component defaults. Any new alias must also be listed in `ui.theme.colors` in `nuxt.config.ts` for Nuxt UI to generate its `--ui-<alias>` variables.

Use semantic classes (`text-muted`, `text-default`, `bg-(image:--app-gradient)`) over hardcoded colors.

### Components

Auto-imported with directory prefixes: `app/components/tournament/Card.vue` → `<TournamentCard>`, `app/components/match/Card.vue` → `<MatchCard>`. `TournamentForm` is shared by `/tournaments/new` and `/tournaments/[id]/settings` via `defineModel` + a `submit` emit — change form fields in one place.

`RoundTimer` starts its clock in `onMounted` and keeps `now` as `null` until then, deliberately, to avoid an SSR hydration mismatch. Preserve that pattern in any other time-dependent component.

## Conventions

- **UI text and code comments are in Italian.** Match that.
- Nuxt UI v4 components (`U*` prefix) throughout; reach for a Nuxt UI component before hand-rolling markup.
- ESLint stylistic rules are on, but several are disabled in `eslint.config.mjs` (semicolons, trailing commas, arrow parens, attribute hyphenation are all free-form). Don't "fix" these across files.
- Tailwind 4 via `@nuxt/ui`; there is no `tailwind.config`, all theming lives in CSS `@theme` blocks.

## Known gaps

- `nuxt.config.ts` has a `fonts:` block, but `@nuxt/fonts` is neither a dependency nor a registered module, so no `@font-face` rules are generated for the Lato files in `public/fonts/` — despite what the comment in `typography.css` claims. Lato currently only resolves if it's installed on the viewer's system.
- Tiptap packages are in `package.json` but nothing imports them yet.
- No mailer: email verification, password reset and any future invitation flow are all waiting on one.
