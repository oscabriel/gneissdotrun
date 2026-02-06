# AGENTS.md (packages/env)

## Scope

- Applies to `packages/env/**`.
- Inherit shared monorepo rules from `../../AGENTS.md`.
- If guidance conflicts, this file wins for `packages/env` changes.

## Package Role

- Provides typed runtime env modules:
- `@gneissdotrun/env/server`
- `@gneissdotrun/env/web`
- Centralizes env validation and access patterns.

## Commands (Run From Repo Root)

- No local package scripts currently.
- Typecheck env package directly: `bunx tsc -p packages/env/tsconfig.json --noEmit`
- Lint env: `bunx oxlint packages/env`
- Format env (mutating): `bunx oxfmt --write packages/env`

## Tests

- Current state: no `test` script in `packages/env/package.json`.
- Use Bun test runner directly if tests are added.
- Run package tests: `bun test packages/env`
- Run single test file: `bun test packages/env/src/web.test.ts`
- Run single test case: `bun test packages/env/src/web.test.ts --test-name-pattern "requires VITE_SERVER_URL"`

## Env Conventions

- Keep validation in one place via Zod/createEnv.
- Keep server env and client env separated.
- Client env keys must use `VITE_` prefix.
- Do not bypass typed modules with `process.env` in app code.

## Safety Rules

- Fail fast on missing or invalid env.
- Never hardcode secrets/default secrets.
- Keep runtime bindings aligned with infra definitions (`packages/infra/alchemy.run.ts`).

## Style

- Use `import type` for type-only imports.
- Keep modules small and explicit.
- Preserve strict TS behavior and minimal casts.

## Delivery Checklist

- Run `bunx tsc -p packages/env/tsconfig.json --noEmit`.
- Run lint/format on touched env files.
- Re-check dependent apps if env contracts changed.
