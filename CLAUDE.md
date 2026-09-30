# CLAUDE.md

Nuxt 4 full-stack app for running tabletop/esports tournaments. Two people work on it, each on one half.

<!--
  Note per chi mantiene questi file (i commenti HTML non entrano nel contesto di Claude).

  Questo file è caricato sempre: tienilo corto e valido per entrambi. Tutto ciò che
  riguarda una sola metà va in .claude/rules/, dove ogni file dichiara con `paths:`
  i glob che lo attivano. Una regola si carica quando Claude legge un file che combacia.

  Chi sei lo dice il tuo CLAUDE.local.md (gitignored), non questo file.
  Per crearlo: cp CLAUDE.local.md.example CLAUDE.local.md
-->

## Who owns what

| Area | Owner | Paths | Instructions |
|---|---|---|---|
| Frontend | Marco | `app/`, `server/mocks/`, `server/middleware/mocks.ts`, `public/` | `.claude/rules/frontend/` |
| Backend | Lord Bel | `server/` (except the mocks), `tests/backend/` | `.claude/rules/backend/` |
| Tournament engine | Lord Bel | `server/engine/` | `.claude/rules/engine.md` |
| API contract | both | `shared/` | `.claude/rules/contract.md` |

Rules for each area load on their own when Claude reads a file in that area. If you plan work in an area before opening any of its files, read its rules file first.

- **Stay on your side.** `CLAUDE.local.md` says whose session this is. If it is missing, ask, and point to `CLAUDE.local.md.example`. If a task needs a change in the other half, stop and describe the change instead of making it, unless the user explicitly asks for it.
- **`shared/` is the boundary.** A change there changes the other person's contract. Say so explicitly in your summary, and do not "fix" the consumers on the other side yourself.

## Commands

```bash
npm run dev            # http://localhost:3000 (port pinned in nuxt.config.ts)
npm run build          # production build
npm run preview        # preview the production build
npx eslint .           # lint; `npm run format` = eslint --fix
npm run test:backend   # node --test, no database and no Nuxt
```

Database commands (`db:*`) are in `.claude/rules/backend/database.md`.

Node is pinned in `.nvmrc` to major `26`, required for native `Temporal`. Lint needs `.nuxt/eslint.config.mjs`, produced by `nuxt prepare` (runs on `postinstall`); run `npx nuxt prepare` if `.nuxt/` is missing.

## Domain

`docs/brainstorm.md` and `docs/glossario.md` are the source of truth for the domain. The glossary fixes the English identifier for each Italian term: use it, do not invent synonyms. `docs/backend-structure.md` describes the backend as it is today.

## Conventions

- **UI text and code comments are in Italian.** Match that.
- ESLint stylistic rules are on, but several are disabled in `eslint.config.mjs` (semicolons, trailing commas, arrow parens, attribute hyphenation are all free-form). Don't "fix" these across files.
- **The `ponytail:` marker.** Comments prefixed `ponytail:` mark deliberate frontend↔backend integration seams (data fetching, auth, validation schemas). They are not TODO cruft: they name the backend contract a page is waiting for, e.g. `useFetch('/api/tournaments')`. Keep the marker when touching such code; remove it only when actually wiring the backend. `grep -rn "ponytail" app server shared` lists every open seam.
- No mailer yet: email verification, password reset and any invitation flow are all waiting on one.
