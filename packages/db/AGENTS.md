# AGENTS.md (packages/db)

## Scope

- Applies to `packages/db/**`.
- Inherit shared monorepo rules from `../../AGENTS.md`.
- If guidance conflicts, this file wins for `packages/db` changes.

## Stack

- Drizzle ORM schema + client
- SQLite/D1-compatible configuration
- Migrations managed via Drizzle Kit

## Commands (Run From Repo Root)

- Generate migrations: `bun --filter @gneissdotrun/db run db:generate`
- Push schema: `bun --filter @gneissdotrun/db run db:push`
- Typecheck DB package directly: `bunx tsc -p packages/db/tsconfig.json --noEmit`
- Lint DB: `bunx oxlint packages/db`
- Format DB (mutating): `bunx oxfmt --write packages/db`

## Tests

- Current state: no `test` script in `packages/db/package.json`.
- Use Bun test runner directly for added tests.
- Run package tests: `bun test packages/db`
- Run single test file: `bun test packages/db/src/schema/todo.test.ts`
- Run single test case: `bun test packages/db/src/schema/todo.test.ts --test-name-pattern "default completed false"`

## Schema Conventions

- Keep schema files under `packages/db/src/schema`.
- Use Drizzle table builders (`sqliteTable`, column helpers) consistently.
- Keep DB column names in `snake_case`.
- Keep TS exports/readability in existing style.
- Re-export schema modules via `packages/db/src/schema/index.ts`.

## Migration Rules

- Treat `packages/db/src/migrations/*` as generated/tool-managed.
- Prefer generating migrations over manual edits.
- If manual migration edits are required, keep them minimal and deterministic.

## Style And Imports

- Use `import type` for type-only imports.
- Import grouping order:
- 1. third-party
- 2. workspace packages (`@gneissdotrun/*`)
- 3. relative imports
- Keep schema defaults, indexes, and relations explicit.

## Error/Data Safety

- Keep nullable vs non-null constraints explicit.
- Prefer DB constraints/defaults over app-only assumptions.
- Avoid schema changes that break auth/todo flows without coordinated updates.

## Delivery Checklist

- Run schema command (`db:generate` or `db:push`) as needed.
- Run `bunx tsc -p packages/db/tsconfig.json --noEmit`.
- Run lint/format on touched DB files.
