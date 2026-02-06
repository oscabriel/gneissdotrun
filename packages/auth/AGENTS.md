# AGENTS.md (packages/auth)

## Scope

- Applies to `packages/auth/**`.
- Inherit shared monorepo rules from `../../AGENTS.md`.
- If guidance conflicts, this file wins for `packages/auth` changes.

## Stack

- Better Auth configuration
- Drizzle adapter wiring to `@gneissdotrun/db`
- Runtime values from `@gneissdotrun/env/server`

## Commands (Run From Repo Root)

- No local package scripts currently.
- Typecheck auth package directly: `bunx tsc -p packages/auth/tsconfig.json --noEmit`
- Lint auth: `bunx oxlint packages/auth`
- Format auth (mutating): `bunx oxfmt --write packages/auth`

## Tests

- Current state: no `test` script in `packages/auth/package.json`.
- Use Bun test runner directly for new tests.
- Run package tests: `bun test packages/auth`
- Run single test file: `bun test packages/auth/src/index.test.ts`
- Run single test case: `bun test packages/auth/src/index.test.ts --test-name-pattern "creates session"`

## Auth Conventions

- Keep auth setup centralized in `packages/auth/src/index.ts`.
- Keep Better Auth + Drizzle adapter wiring in one configuration object.
- Keep trusted origins and cookie behavior aligned with infra/env bindings.
- Use typed env access (`env`) for all runtime values.

## Security Rules

- Never hardcode secrets or fallback test secrets.
- Do not commit real domains/keys for cross-subdomain cookie settings.
- Preserve secure cookie attributes unless explicitly changing deployment posture.

## Style

- Use `import type` for type-only imports.
- Import grouping order:
- 1. third-party
- 2. workspace packages (`@gneissdotrun/*`)
- 3. relative imports
- Keep configuration readable; avoid deeply nested inline logic.

## Error Handling

- Let calling layers handle HTTP error mapping.
- Keep auth module deterministic and side-effect-light.
- Prefer explicit option flags over implicit behavior.

## Delivery Checklist

- Run `bunx tsc -p packages/auth/tsconfig.json --noEmit`.
- Run lint/format on touched files.
- Verify env key usage remains typed and minimal.
