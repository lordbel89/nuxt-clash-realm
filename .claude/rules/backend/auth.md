---
paths:
  - "server/auth/**"
  - "server/utils/auth.ts"
  - "server/api/auth/**"
  - "server/database/schema/auth.ts"
  - "server/database/schema/users.ts"
---

# Authentication (server side)

Better Auth (`better-auth` + `@better-auth/drizzle-adapter`), self-hosted: the tables are in our own Postgres, and the cookies are signed by our own server. Email + password only for now: no 2FA, no organizations, no OAuth, and no mailer, so email verification and password reset are off.

**The perimeter: `/api/auth/**` is Better Auth's territory.** Its endpoints validate their own input and return their own shape and errors (`{ code, message }`). They do not go through `readInput`, do not produce `ApiErrorData`, and do not touch a mapper. Everything else is our contract. Do not "harmonise" the two, because the client library reads that shape.

The two worlds meet in exactly one file, `server/utils/auth.ts`, which is to authentication what `readInput` is to validation:

```ts
const session = await requireSession(event);   // 401 se manca
const userId = await requireUserId(event);     // UserId, marchiato qui
```

Domain handlers never import `createAuth`. `useAuth()` is the lazy async singleton, built on `useDatabase()`. A failed creation is not cached, so the server can recover.

- `server/auth/index.ts`: the Better Auth config, with the adapter, `usePlural: true` (our tables are plural), `generateId: 'uuid'`, and the ban hook.
- `server/auth/env.ts`: defaults outside the Nuxt context, mirroring `server/database/env.ts`. `NUXT_AUTH_SECRET` is mandatory in production. In dev a fallback secret keeps the project running without a `.env`.
- `server/database/schema/auth.ts`: `sessions`, `accounts`, `verifications`, written by hand rather than pasted from `npx auth generate` so migrations keep coming from `npm run db:generate`. **The TypeScript property names are the contract with Better Auth** (`userId`, `expiresAt`, `accountId`…). The column names are ours. These rows have no DTO and no mapper.

The password lives in `accounts.password` (scrypt), never on the user row.

## Banning

`bannedAt` / `banReason` / `bannedUntil` are our columns; Better Auth knows nothing about them. Enforcement is a single `databaseHooks.session.create.before` in `server/auth/index.ts`. Every login method has to create a session, so that one point covers them all. `bannedUntil` null means indefinite. A ban whose `bannedUntil` is in the past blocks nothing.

- **Banning does not close open sessions.** Whoever sets `bannedAt` must also call `auth.api.revokeUserSessions({ body: { userId } })`.
- **`session.cookieCache` is off on purpose.** With it on, the server trusts the cookie instead of the database, and a banned user keeps browsing until the cache expires.

`isActive` is the older, separate flag (account deactivated, no reason, no expiry) and blocks sign-in too. If it ends up meaning the same thing as a ban, collapse the two rather than checking both forever.

No administrative role exists yet: no route simulates its privileges.
