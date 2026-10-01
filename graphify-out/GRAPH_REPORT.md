# Graph Report - .  (2026-10-01)

## Corpus Check
- 90 files · ~51,278 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 529 nodes · 678 edges · 67 communities (52 shown, 15 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.82)
- Token cost: 315,909 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Database & Auth Bootstrap|Database & Auth Bootstrap]]
- [[_COMMUNITY_Engine Log & Reproducibility|Engine Log & Reproducibility]]
- [[_COMMUNITY_Project Overview & Lifecycle|Project Overview & Lifecycle]]
- [[_COMMUNITY_Users Service & Contract Tests|Users Service & Contract Tests]]
- [[_COMMUNITY_Runtime Dependencies|Runtime Dependencies]]
- [[_COMMUNITY_Ruleset, Roles & Timezones|Ruleset, Roles & Timezones]]
- [[_COMMUNITY_v1 Scope & Infrastructure|v1 Scope & Infrastructure]]
- [[_COMMUNITY_Dev Tooling & Scripts|Dev Tooling & Scripts]]
- [[_COMMUNITY_Auth & DB Rules|Auth & DB Rules]]
- [[_COMMUNITY_Tournament Mocks|Tournament Mocks]]
- [[_COMMUNITY_VSCode Editor Settings|VSCode Editor Settings]]
- [[_COMMUNITY_Input Validation Pipeline|Input Validation Pipeline]]
- [[_COMMUNITY_Phase Architecture|Phase Architecture]]
- [[_COMMUNITY_Theming & Layouts|Theming & Layouts]]
- [[_COMMUNITY_Tournament Engine Rules|Tournament Engine Rules]]
- [[_COMMUNITY_Tournament Types|Tournament Types]]
- [[_COMMUNITY_Database Client Setup|Database Client Setup]]
- [[_COMMUNITY_Shared DTOs & Mocks|Shared DTOs & Mocks]]
- [[_COMMUNITY_Mock Middleware|Mock Middleware]]
- [[_COMMUNITY_Migration Snapshot A|Migration Snapshot A]]
- [[_COMMUNITY_Migration Snapshot B|Migration Snapshot B]]
- [[_COMMUNITY_Backend Layering|Backend Layering]]
- [[_COMMUNITY_Users API DTOs|Users API DTOs]]
- [[_COMMUNITY_Mock Lifecycle & Wire Format|Mock Lifecycle & Wire Format]]
- [[_COMMUNITY_Navigation Config|Navigation Config]]
- [[_COMMUNITY_RoundTimer Component|RoundTimer Component]]
- [[_COMMUNITY_Placeholder Logo|Placeholder Logo]]
- [[_COMMUNITY_Side Menu Utils|Side Menu Utils]]
- [[_COMMUNITY_Launch Config|Launch Config]]
- [[_COMMUNITY_Env Configuration|Env Configuration]]
- [[_COMMUNITY_TS Config|TS Config]]
- [[_COMMUNITY_API Types|API Types]]
- [[_COMMUNITY_User Types|User Types]]
- [[_COMMUNITY_Components Showcase Page|Components Showcase Page]]
- [[_COMMUNITY_Auth Client|Auth Client]]
- [[_COMMUNITY_Auth Middleware|Auth Middleware]]
- [[_COMMUNITY_Tournaments Index Page|Tournaments Index Page]]
- [[_COMMUNITY_Select Item Type|Select Item Type]]
- [[_COMMUNITY_Launch Config (alt)|Launch Config (alt)]]
- [[_COMMUNITY_Payment Status|Payment Status]]
- [[_COMMUNITY_RoundTimer Concept|RoundTimer Concept]]
- [[_COMMUNITY_Unused Tiptap|Unused Tiptap]]
- [[_COMMUNITY_Robots.txt|Robots.txt]]

## God Nodes (most connected - your core abstractions)
1. `scripts` - 12 edges
2. `shared/types/ (DTOs)` - 10 edges
3. `createDatabase()` - 9 edges
4. `pg-boss for All Jobs (enqueued in same transaction)` - 9 edges
5. `Weighted Blossom Maximum Matching Pairing` - 8 edges
6. `server/mappers/<entity>.ts` - 8 edges
7. `readDatabaseEnv()` - 7 edges
8. `Two-Level Ruleset (Module Catalog + Composition)` - 7 edges
9. `Waitlist Promotion by Expiring Offer` - 7 edges
10. `closeDatabase()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Node v24.11.0 Requirement (README)` --conceptually_related_to--> `Node 26 Pin for Native Temporal`  [AMBIGUOUS]
  README.md → CLAUDE.md
- `pg-boss for All Jobs (enqueued in same transaction)` --shares_data_with--> `Drizzle ORM on Postgres`  [EXTRACTED]
  docs/brainstorm.md → README.md
- `npm run test:backend (node --test)` --conceptually_related_to--> `Node v24.11.0 Requirement (README)`  [AMBIGUOUS]
  docs/backend-structure.md → README.md
- `shared/schemas Valibot + shared/types DTO` --conceptually_related_to--> `shared/ as API Contract Boundary`  [INFERRED]
  README.md → CLAUDE.md
- `app/pages/hello.vue Contract Mismatch` --conceptually_related_to--> `shared/ as API Contract Boundary`  [INFERRED]
  docs/backend-structure.md → CLAUDE.md

## Hyperedges (group relationships)
- **Verifiable Deterministic Pairing (seed, signature, draw number, pure engine, exact math)** — brainstorm_seeded_outcomes, glossario_generation_signature, glossario_draw_number, brainstorm_pure_engine, brainstorm_exact_math, brainstorm_weighted_blossom [EXTRACTED 1.00]
- **pg-boss Job Pipeline (offers, mail, push, season recalc, Glicko)** — brainstorm_pgboss_jobs, brainstorm_waitlist_offer, brainstorm_smtp_mail, brainstorm_web_push, brainstorm_season_recalc, brainstorm_glicko_rating, glossario_seat_offer [EXTRACTED 1.00]
- **Phase Chaining Contract (phase, gate, inheritance, no-rematch scope, linearization)** — brainstorm_phase_architecture, glossario_phase, glossario_gate, glossario_phase_inheritance, brainstorm_no_rematch_scope, brainstorm_bracket_seeding_modes [EXTRACTED 1.00]
- **Dev mock request flow** — mock_middleware_mocks_ts, mock_servemock, mock_rou3, mock_registry_index_ts, mock_mock_data_header [EXTRACTED 1.00]
- **Row to DTO layering per entity** — api_entity_row, api_mappers, contract_shared_types, api_services, api_handlers, api_input_mapper [EXTRACTED 1.00]
- **Shared schema validation on both sides** — contract_shared_schemas, app_uform, api_validation_ts, contract_api_error_data, app_fetch_error_handling [INFERRED 0.85]

## Communities (67 total, 15 thin omitted)

### Community 0 - "Database & Auth Bootstrap"
Cohesion: 0.08
Nodes (34): AUTH_DEFAULTS, readAuthEnv(), Auth, AuthOptions, createAuth(), closeDatabase(), createDatabase(), createPgliteDatabase() (+26 more)

### Community 1 - "Engine Log & Reproducibility"
Cohesion: 0.06
Nodes (47): server/services/users.ts (getOwnAccount), Two Bye Origins (structural, premium), Check-in Opening as Single Freeze Point, Versioned Config Frozen at Use (copy, not reference), Lexicographic Pairing Priorities (cardinality > no 2nd bye > no rematch > quadratic score diff > side > cosmetic), Manual Pairing Override with Mandatory Reason, Online Only with Paper Fallback, Pure TypeScript Tournament Engine (+39 more)

### Community 2 - "Project Overview & Lifecycle"
Cohesion: 0.06
Nodes (43): HTTP Handlers (session, validation, 404), app/pages/hello.vue Contract Mismatch, Pure Allowlist Mappers, Offset Pagination with Informative Total, Paginated<T>, Strict Numeric Query Validation, Shared Schemas Validate and Normalize Contract, npm run test:backend (node --test) (+35 more)

### Community 3 - "Users Service & Contract Tests"
Cohesion: 0.08
Nodes (29): query, actorId, call, db, event, originals, replacements, row (+21 more)

### Community 4 - "Runtime Dependencies"
Cohesion: 0.06
Nodes (32): dependencies, better-auth, @better-auth/drizzle-adapter, drizzle-orm, eslint, nuxt, @nuxt/eslint, @nuxt/ui (+24 more)

### Community 5 - "Ruleset, Roles & Timezones"
Cohesion: 0.08
Nodes (28): Better Auth organization Plugin, Bye in Tiebreaks as Two Independent Parameters, Catalog Categories (result shape, points, tiebreak, list, operational), Standings Math Uses Only + - * /, min, max, Adding a Game = Writing a Composition, Tiebreak Catalog (OMW%, GW%, OGW%, VP, Buchholz, head-to-head, wins), Per-Tournament IANA Timezone and Temporal Date Math, Two-Level Roles (org owner/admin; tournament head_judge/judge/scorekeeper) (+20 more)

### Community 6 - "v1 Scope & Infrastructure"
Cohesion: 0.10
Nodes (28): Accepted Privacy Risks (minors, ownership), CapRover Deploy (always-on Node container), Glicko Rating (separate from circuit points), Milestones M0 Walking Skeleton -> M1 Swiss -> M2 Top Cut -> M3 Dress Rehearsal, Notification Matrix (push + in app, email for seat offers), pg-boss for All Jobs (enqueued in same transaction), Player Identity Rules (on-the-fly, unclaimed, claim token), Post-v1 Ordered Roadmap (+20 more)

### Community 7 - "Dev Tooling & Scripts"
Cohesion: 0.09
Nodes (22): devDependencies, drizzle-kit, @electric-sql/pglite, @faker-js/faker, @iconify-json/lucide, rou3, vue-tsc, name (+14 more)

### Community 8 - "Auth & DB Rules"
Cohesion: 0.12
Nodes (19): Adding an entity checklist, server/database/seed.ts, app/utils/authClient.ts (Better Auth Vue client), app/middleware/auth.global.ts (authWhitelist), loginBypass.ts middleware, Banning via session.create.before hook, Better Auth (self-hosted), session.cookieCache disabled (+11 more)

### Community 9 - "Tournament Mocks"
Cohesion: 0.13
Nodes (14): defineMock(), Mock, MockContext, MockMethod, mocks, router, createRound(), createTournament() (+6 more)

### Community 10 - "VSCode Editor Settings"
Cohesion: 0.14
Nodes (13): cssVarHover.watchedFiles, editor.codeActionsOnSave, source.fixAll.eslint, editor.formatOnSave, eslint.format.enable, eslint.useFlatConfig, eslint.validate, [javascript] (+5 more)

### Community 11 - "Input Validation Pipeline"
Cohesion: 0.23
Nodes (12): server/api/** handlers, Input mapper toNewEntityRow(), server/utils/validation.ts (readInput, readQuery, readParams), TournamentForm component, UForm (shared schema validation), server/utils/auth.ts (requireSession, requireUserId, useAuth), Branded ids (shared/types/ids.ts), shared/schemas/common.ts (Uuid, brandedUuid, ListQuery) (+4 more)

### Community 12 - "Phase Architecture"
Cohesion: 0.20
Nodes (11): Groups-to-Bracket Seeding (overall_standing / fixed_cross), Data Model Phase -> Round -> Match -> Board/Game, No-Rematch Scope = Chain of Phases Inheriting Opponent History, Phase Architecture (ordered list in, ordered list out), bracketSeeding, Gate, Match (kind: duel | ffa | bye), MatchSlot (+3 more)

### Community 13 - "Theming & Layouts"
Cohesion: 0.18
Nodes (11): Frontend app/ (Nuxt UI v4, Tailwind 4), Layouts: default, auth, projector, app/config/navigation.ts (appHeader, sideMenu, sideMenuFooter), projector layout (forced dark, text-screen scale), sideMenuDecorator() (app/utils/sideMenuUtils.ts), app/app.config.ts (semantic aliases), Lato fonts not loaded (@nuxt/fonts missing), light.css / dark.css (--app-gradient) (+3 more)

### Community 14 - "Tournament Engine Rules"
Cohesion: 0.20
Nodes (10): API Contract (shared/), orderBy tiebreaker for lists, Weighted maximum matching (blossom) pairing, docs/brainstorm.md (§0, §7, §8), Deterministic engine with server-provided seed, Exact integer/BigInt weights, Round generation signature {engineVersion, seed, input}, Engine is pure TypeScript with own I/O types (+2 more)

### Community 15 - "Tournament Types"
Cohesion: 0.22
Nodes (8): Match, MatchStatus, Participant, Round, Standing, Tournament, TournamentConfig, TournamentStatus

### Community 16 - "Database Client Setup"
Cohesion: 0.29
Nodes (7): server/services/<entity>.ts, createDatabase() (server/database/client.ts), PGlite variable import specifier, Postgres everywhere (PGlite local, postgres-js prod), useDatabase(), Dynamic import behind import.meta.dev, @faker-js/faker

### Community 17 - "Shared DTOs & Mocks"
Cohesion: 0.38
Nodes (7): FetchError<ApiErrorData> handling, ApiErrorData (shared/types/api.ts), Paginated<T> (shared/types/api.ts), shared/types/ (DTOs), server/mocks/define.ts, defineMock(), server/mocks/*.mock.ts

### Community 18 - "Mock Middleware"
Cohesion: 0.33
Nodes (7): server/middleware/mocks.ts, MOCK_DATA: true header, Dev-only Mock System, Enabled mock wins over real handler, README.md (Mock section), serveMock(event), Mocks rule (frontend-owned server files)

### Community 19 - "Migration Snapshot A"
Cohesion: 0.29
Nodes (6): ddl, dialect, id, prevIds, renames, version

### Community 20 - "Migration Snapshot B"
Cohesion: 0.29
Nodes (6): ddl, dialect, id, prevIds, renames, version

### Community 21 - "Backend Layering"
Cohesion: 0.40
Nodes (6): <Entity>Row ($inferSelect), Backend layering (schema, DTO, mapper, service, handler), server/mappers/<entity>.ts, Spread a DTO, never a Row, npm run test:backend (tests/backend, node --test), server/api/users*.ts + server/services/users.ts

### Community 22 - "Users API DTOs"
Cohesion: 0.33
Nodes (6): DTO variants compose, nest downward only, GET /api/users, GET /api/users/:id, GET /api/users/me, User DTO, UserSummary DTO

### Community 23 - "Mock Lifecycle & Wire Format"
Cohesion: 0.33
Nodes (6): Do not annotate useFetch generic, Dates as ISO strings on the wire, app/pages/hello.vue, Mock lifecycle (mock is never deleted), server/mocks/index.ts (mock registry), rou3 router

### Community 24 - "Navigation Config"
Cohesion: 0.40
Nodes (4): appHeader, AppHeaderConfig, sideMenu, sideMenuFooter

### Community 25 - "RoundTimer Component"
Cohesion: 0.50
Nodes (3): expired, label, remaining

### Community 26 - "Placeholder Logo"
Cohesion: 0.67
Nodes (4): Clash Realm Placeholder Logo, Crossed Pixel Swords (Clash Motif), Crowned Shield Emblem with R Monogram, Red vs Blue Split Palette (Opposing Sides)

### Community 29 - "Env Configuration"
Cohesion: 0.67
Nodes (3): server/auth/env.ts (NUXT_AUTH_SECRET), drizzle.config.ts, server/database/env.ts

## Ambiguous Edges - Review These
- `Node 26 Pin for Native Temporal` → `Node v24.11.0 Requirement (README)`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to
- `Node v24.11.0 Requirement (README)` → `npm run test:backend (node --test)`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to

## Knowledge Gaps
- **167 isolated node(s):** `env`, `name`, `type`, `private`, `test:backend` (+162 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Node 26 Pin for Native Temporal` and `Node v24.11.0 Requirement (README)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Node v24.11.0 Requirement (README)` and `npm run test:backend (node --test)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `shared/types/ (DTOs)` connect `Shared DTOs & Mocks` to `Input Validation Pipeline`, `Theming & Layouts`, `Tournament Engine Rules`, `Mock Middleware`, `Backend Layering`, `Mock Lifecycle & Wire Format`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `pg-boss for All Jobs (enqueued in same transaction)` connect `v1 Scope & Infrastructure` to `Engine Log & Reproducibility`, `Project Overview & Lifecycle`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `Weighted Blossom Maximum Matching Pairing` connect `Engine Log & Reproducibility` to `v1 Scope & Infrastructure`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `env`, `name`, `type` to the rest of the system?**
  _201 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Database & Auth Bootstrap` be split into smaller, more focused modules?**
  _Cohesion score 0.0784313725490196 - nodes in this community are weakly interconnected._