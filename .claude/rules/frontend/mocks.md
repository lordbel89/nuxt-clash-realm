---
paths:
  - "server/mocks/**"
  - "server/middleware/mocks.ts"
---

# Mocks

These files live in `server/` but belong to the frontend. Full documentation: `.claude/mock.md`. Read it before adding or changing a mock.

- Dev only: `server/middleware/mocks.ts` answers before any handler and exits at once outside `import.meta.dev`.
- **An enabled mock wins over the real handler**, and it bypasses authentication. Every mocked response carries the `MOCK_DATA: true` header.
- The response type goes in `shared/types/`, not `app/`: server code cannot import from `app/`, and the type is an API contract anyway. That makes it a `shared/` change, so tell the backend.
- A mock describes the contract the backend is expected to implement. When the real handler lands, the two must agree; `enabled: false` switches back to the handler to compare.
