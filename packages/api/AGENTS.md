# AGENTS.md (packages/api)

## Scope

- Applies to `packages/api/**`.
- Inherit shared monorepo rules from `../../AGENTS.md`.
- If guidance conflicts, this file wins for `packages/api` changes.

## Stack

- oRPC procedure/router definitions
- API context creation + auth-aware procedures
- Zod input validation at API boundary
- Drizzle-backed data access via `@gneissdotrun/db`

## Commands (Run From Repo Root)

- Typecheck API: `bun --filter @gneissdotrun/api run typecheck`
- Lint API: `bunx oxlint packages/api`
- Format API (mutating): `bunx oxfmt --write packages/api`

## Tests

- Current state: no `test` script in `packages/api/package.json`.
- Use Bun test runner directly when tests are added.
- Run package tests: `bun test packages/api`
- Run single test file: `bun test packages/api/src/routers/todo.test.ts`
- Run single test case: `bun test packages/api/src/routers/todo.test.ts --test-name-pattern "creates todo"`

## API Conventions

- Keep `publicProcedure`/`protectedProcedure` split in `src/index.ts`.
- Validate all external input with `.input(z.object(...))`.
- Use `ORPCError` for auth/procedure-level failures.
- Keep router composition in `src/routers/index.ts`.
- Keep context shape minimal and typed (`Context` from `src/context.ts`).

## Style And Imports

- Use `import type` for type-only symbols.
- Import grouping order:
- 1) third-party
- 2) workspace packages (`@gneissdotrun/*`)
- 3) relative imports
- Keep shared exports named (avoid unnecessary default exports in packages).

## Data Layer Rules

- Use Drizzle query builders; avoid raw SQL unless required.
- Keep DB table references from `@gneissdotrun/db/schema/*`.
- Keep procedure handlers focused and side-effect minimal.

## Error Handling

- Fail fast at boundary validation.
- Preserve typed error paths for clients.
- Avoid swallowing errors; let interceptors/logging handle centralized reporting.

## Delivery Checklist

- Run `bun --filter @gneissdotrun/api run typecheck`.
- Run targeted tests if added/changed.
- Run lint/format on touched files.
