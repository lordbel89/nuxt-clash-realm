---
paths:
  - "shared/**"
  - "server/api/**"
  - "server/services/**"
  - "server/mappers/**"
  - "server/mocks/**"
  - "app/pages/**"
  - "app/components/**"
  - "app/composables/**"
---

# API contract (both sides)

`shared/` holds what crosses the wire: `shared/types/` (DTOs, imported as `#shared/types/...`) and `shared/schemas/` (Valibot input schemas). Both sides import them. A change here is a change to the other person's contract (see the root `CLAUDE.md`).

**The database row is not the API contract.** The backend maps rows to DTOs. The frontend only ever sees DTOs. A DTO's fields are written out one by one on purpose, as an allowlist: a new column does not reach the frontend by itself. Never derive a DTO from a table type (`Omit<UserRow, …>`).

## Endpoints that exist today

| Route | Returns | Notes |
|---|---|---|
| `GET /api/users` | `Paginated<UserSummary>` | session required |
| `GET /api/users/:id` | `UserSummary` | session required; no private data, even for your own id |
| `GET /api/users/me` | `User` | the account from the session |
| `/api/auth/**` | Better Auth's own shape | see "Two error shapes" |

Anything else under `/api/` is served only by a mock (`server/mocks/`) until its handler exists.

## Shapes

- **Dates cross the wire as ISO strings**, never `Date`. Nitro's `Serialize` already maps `Date` to `string` in what `useFetch` infers, so the DTO says `string` to keep the declared and inferred types identical. Converting back is the frontend's job.
- **DTO variants compose, never re-declare.** The smallest shape is the base (`UserSummary { id, name }`), and fuller ones extend it (`User extends UserSummary`). Nesting goes downward only: `Tournament` may hold `UserSummary`, and a summary never holds its parent, otherwise the JSON cycles. Variants are created when a real consumer needs one, not in advance.
- **Branded ids.** `shared/types/ids.ts` exports `Branded<T, Name>` and one alias per entity (`UserId`). The brand is type-only (the JSON is a plain string), but passing a `UserId` where a `TournamentId` is expected will not compile.
- **`Paginated<T>`** (`shared/types/api.ts`): every list endpoint returns `{ items, total, limit, offset }`, never a bare array.
- **`ApiErrorData`** (`shared/types/api.ts`): the typed body of a 400, with `fields` for per-field messages and `messages` for issues that belong to no field.

## Input schemas (`shared/schemas/`)

Hand-written and **contract-first**: the rules are business rules (a valid email, a name of at least two characters), not a mirror of table constraints. The same schema validates the form in `UForm` and the body in the handler, so the two cannot drift. Never generate them from tables (`drizzle-valibot` would drag Drizzle into the client bundle).

Each file exports a constant and a type **with the same name**. That is not a duplicate: one lives in value space, the other in type space.

```ts
export const CreateTournamentInput = v.object({ … })
export type CreateTournamentInput = v.InferOutput<typeof CreateTournamentInput>
```

Write the type messages out by hand too, in Italian. Valibot's defaults are English and reach the user through `ApiErrorData`. An object's message covers both "not an object" and "missing key", so phrase it to hold in both.

`shared/schemas/common.ts` holds the reusable pieces: `Uuid`, `brandedUuid<T>()` (the only place the branded-id cast is written), and `ListQuery` (`limit`/`offset` with defaults and caps).

## Two error shapes

- **Ours**: `createError({ statusCode, statusMessage: 'Conflict', message: 'Email già registrata' })`. `statusMessage` is the English HTTP reason phrase; h3 strips non-ASCII from it. The Italian text is in `message`. **The frontend reads `error.data.message`, never `error.statusMessage`.**
- **Better Auth's** (`/api/auth/**`): `{ code, message }`, read by its own client library. Do not harmonise the two.
