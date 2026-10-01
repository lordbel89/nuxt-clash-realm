---
paths:
  - "server/engine/**"
---

# Tournament engine (`server/engine/`)

Pairing and standings. The design is in `docs/brainstorm.md` §0 (principles 3–5), §7 (pairing engine, bye) and §8 (standings and tiebreaks). Read the relevant section before changing behaviour: the rules below are the invariants, and the brainstorm has the reasons.

## Invariants

- **Pure TypeScript.** No imports from Nuxt, h3, Nitro, Drizzle, `server/database/`, `server/services/` or `app/`. The engine takes participants, results and configuration and returns pairings or standings. It must stay extractable as a package with its own version.
- **Its own input and output types**, defined inside `server/engine/`. It does not consume DTOs or rows: the service that calls it translates rows → engine input and engine output → rows. That keeps the engine free of the API contract, and the contract free of the engine.
- **Deterministic.** Same input + same seed gives the same output. Participant ordering is stable, and on equal weight the lowest index wins. There is no `Math.random()` and no `Date.now()`: randomness comes from a seeded RNG, and time, if ever needed, comes in as input.
- **The seed is not the engine's business.** The server generates it (cryptographic RNG) when the round is created and passes it in. The engine never generates one.
- **Exact maths.** Weights are integers. With lexicographic priority levels they must be computed in `BigInt` or sized to stay below 2⁵³. No floating-point in comparisons that decide a pairing or a ranking.
- **Pairing never fails.** Weighted maximum matching (blossom): there are no hard constraints, only weights in priority order, and the engine always returns a complete pairing. The priority order is fixed (not a module parameter) and is listed in §7.
- **The core knows no tiebreak.** All standings maths lives in catalogue modules (`OMW%`, `GW%`, Buchholz…). The core applies the ordered list the ruleset picks. Floors, ceilings and bye treatment are module parameters, not constants.
- **Adding a game is a composition, not an engine change.** A rule the catalogue lacks is a new module; there is no DSL and no interpreter.

## Versioning

A round stores its generation signature `{ engineVersion, seed, input }`. Verifying a round means `engine(input, seed) == saved pairing`. Any change to the output for a given input is a new engine version.

## Tests

Fixtures in, pairings or standings out, with no database. Test location and runner script are not decided yet.
