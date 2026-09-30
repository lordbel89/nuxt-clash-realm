---
paths:
  - "app/**"
---

# Frontend (`app/`)

Nuxt UI v4 components (`U*` prefix) throughout: reach for a Nuxt UI component before hand-rolling markup. Tailwind 4 via `@nuxt/ui`; there is no `tailwind.config` (theming: `.claude/rules/frontend/theming.md`).

Components take DTOs from `shared/types/` as props; pages own the state. Types used only by the UI (`USelectItem`…) stay in `app/types/`. A type that describes an API response goes in `shared/types/`, because `server/` (including the mocks) cannot import from `app/`.

## Consuming the API

What each endpoint returns, and the error shapes, are in `.claude/rules/contract.md`. From the consumer side:

- **Do not annotate the generic of `useFetch`** when a real handler exists: `useFetch('/api/users')`, not `useFetch<User[]>(…)`. The annotation overrides the inference from Nitro, compiles anyway, and hides a mismatch with what the handler returns. The exception is an endpoint served only by a mock, where there is no handler to infer from. There the generic is the only source of the type; remove it when the handler lands.
- Lists are `Paginated<T>`: read `data.items`, not `data`.
- Errors: `FetchError<ApiErrorData>`. Show `error.data.message`, put `error.data.fields` back into the form, never read `error.statusMessage`.
- Dates arrive as ISO strings; converting them is the frontend's job.
- Input schemas come from `shared/schemas/`, and `UForm` validates with the same schema the handler uses. Do not write a second one here.

## Auth

`app/utils/authClient.ts` is the Better Auth Vue client (`signIn`, `signOut`, `useSession`), auto-imported. It talks only to `/api/auth/**`, whose errors are `{ error: { code, message } }`, not `ApiErrorData`.

`app/middleware/auth.global.ts` protects **every page** except the paths in its `authWhitelist`. `loginBypass.ts` sends an already signed-in user away from `/login`. Both call `authClient.useSession(useFetch)`, so the session is read server-side with the request cookies and reused on hydration.

## Routing and layouts

Three layouts serve three audiences:

- `default`: `UDashboardGroup` shell with collapsible sidebar. Page titles feed the navbar via `definePageMeta({ title })`, read by the layout from `route.meta.title`.
- `auth`: centered card, used by `/login`.
- `projector`: full-screen, **dark mode forced via a `.dark` class on its own root** so a projection stays dark while the app runs light. Used by `/tournaments/[id]/display`, which pairs with the oversized `text-screen` / `text-screen-lg` type scale for readability at a distance.

`/` immediately redirects to `/community/news-feed`.

## Navigation

Sidebar and header items are data, not markup: `app/config/navigation.ts` exports `appHeader`, `sideMenu` (array of sections, each an array of `NavigationMenuItem`), and `sideMenuFooter`. Add menu entries there, not in `layouts/default.vue`. `sideMenu` is wrapped in `sideMenuDecorator()` (`app/utils/sideMenuUtils.ts`, auto-imported), which applies consistent per-level icon colors: parents accent, children primary.

## Components

Auto-imported with directory prefixes: `app/components/tournament/Card.vue` → `<TournamentCard>`, `app/components/match/Card.vue` → `<MatchCard>`. `TournamentForm` is shared by `/tournaments/new` and `/tournaments/[id]/settings` via `defineModel` + a `submit` emit, so form fields change in one place.

`RoundTimer` starts its clock in `onMounted` and keeps `now` as `null` until then, deliberately, to avoid an SSR hydration mismatch. Preserve that pattern in any other time-dependent component.

## Known gaps

- Tiptap packages are in `package.json` but nothing imports them yet.
