---
paths:
  - "server/api/**"
  - "server/services/**"
  - "server/mappers/**"
  - "server/utils/validation.ts"
  - "server/database/schema/**"
  - "server/database/seed.ts"
  - "tests/backend/**"
---

# API: handlers, services, mappers

The shapes that cross the wire are in `.claude/rules/contract.md`. This file covers how the backend produces them.

## Layers

1. `server/database/schema/<entity>.ts` exports `<Entity>Row` (`$inferSelect`), which never leaves `server/`.
2. `shared/types/<entity>.ts` exports the DTO.
3. `server/mappers/<entity>.ts` is the only place the two meet. Mappers are pure functions: no queries, no hashing, no permission checks, no writes. A mapper does not authorise a read. They take minimal sources (`Pick<UserRow, 'id' | 'name'>`), so a query can select only what it maps.
4. `server/services/<entity>.ts` holds the reads and use cases, with an explicit `Database` parameter and no HTTP dependencies. Ids that identify the actor (`actorId`) come from the session, never from params or body.
5. `server/api/**` handlers read the session, validate input, call a service, and turn a missing result into a 404. They never touch a `Row`.

`server/api/users*.ts` + `server/services/users.ts` are the worked example; copy their shape.

**Output is mapped. Input is validated, then mapped.** Output comes from our own database and is trusted: it goes through a mapper with no runtime validation. Input is not trusted: it goes through a schema in `shared/schemas/`, then through the input mapper.

**Spread a DTO, never a `Row`.** `{ ...toUser(row), … }` is safe. `{ ...row, … }` compiles just as well and leaks every column, because TypeScript does not excess-property-check a spread.

## The input mapper

A mapper file has two directions: `toEntity(row)` for output and `toNewEntityRow(input, …)` for insert. The handler chains them:

```ts
const input = await readInput(event, CreateTournamentInput);   // validated, still a DTO
const [row] = await db.insert(tournaments).values(toNewTournamentRow(input, organizerId)).returning();
return toTournament(row);
```

Write it even when the shapes look identical. Its point is the **return type**: passing `input` straight to `values()` is not a check. TypeScript does not excess-property-check a non-literal, so a contract field with no matching column compiles and Drizzle drops it silently. The mapper returns an object literal typed `NewRow`, where an extra field is an error.

It is also where everything that is not a 1:1 copy lives:

- a validated field that is not a column (`password` → `passwordHash`);
- a field the client does not send (`organizerId` from the session, `status` starting as `draft`), passed as an extra parameter;
- a field that spreads over columns or rows (`location.name`/`.position`; `roundDurationMinutes` belongs to the rounds).

Operations on several rows are not input mappers; they are services. Valibot validates, it does not translate: keep the two jobs in their two files.

## Validation at the boundary

Handlers never call `v.safeParse`. `server/utils/validation.ts` exports one reader per source and is the single place where issues become a 400 with `ApiErrorData`:

```ts
const { limit, offset } = readQuery(event, ListQuery);
const { id } = readParams(event, UserIdParams);        // brands the id here
const input = await readInput(event, CreateTournamentInput);   // async: reads the body
```

These replace h3's `getValidatedQuery`/`getValidatedRouterParams`/`readValidatedBody`, which nest the payload at `data.data`.

## Adding an entity

The files below move together; skipping one produces code that compiles and is wrong.

| # | File | What | Skipping it means |
|---|---|---|---|
| 1 | `server/database/schema/<entity>.ts` | `pgTable` + `Row`/`NewRow` | — |
| 2 | `server/database/schema/index.ts` | one `export *` | **no migration, and no error** |
| 3 | `server/database/relations.ts` | `r.one`/`r.many` | no `with:` in `db.query` |
| 4 | `server/database/migrations/` | `npm run db:generate` | code expects missing columns |
| 5 | `shared/types/<entity>.ts` | DTO + variants, fields one by one | — |
| 6 | `server/mappers/<entity>.ts` | `toEntity` + `toNewEntityRow` | a contract field without a column is dropped silently |
| 7 | `shared/schemas/<entity>.ts` | input schemas + params schema | unvalidated body |
| 8 | `server/services/<entity>.ts` + `server/api/<entity>*.ts` | use cases + handlers | — |
| 9 | `server/database/seed.ts` | development data | — |

Then `npm run db:migrate`, and `npm run db:seed` if you touched the seed. Steps 5 and 7 are in `shared/`: tell the frontend.

- **New column** → 1, 4. It reaches the frontend only via 5 + 6: that is the allowlist working.
- **Renamed column** → 1, 4, 6. The DTO and the schema do not follow; the mappers absorb it.
- **New DTO field** → 5 + 6; the mapper will not compile until you map it.
- **New form field** → 7 + 6 (+ 1, 4 if it is a new column). A field the mapper does not read (`confirmPassword`) is dropped on purpose, visibly.
- **New relation** → 3, plus 5 + 6 if exposed: nest downward only, and add a named variant instead of an optional field.

A junction table that carries its own columns (a seed, an enrolment date) is an entity in its own right, not a plain array in the DTO.

## Tests

`npm run test:backend` runs `tests/backend/*.test.ts` with `node --test`, without a database and without Nuxt. It covers mapper allowlists, serialisation, validation and error payloads, query projections, and `/me` authorisation with fake dependencies. It is not an end-to-end HTTP test, and it does not exercise Better Auth or Postgres.
