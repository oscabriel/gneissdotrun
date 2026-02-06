# AGENTS.md (apps/server)

## Scope

- Applies to `apps/server/**`.
- Inherit shared monorepo rules from `../../AGENTS.md`.
- If guidance conflicts, this file wins for `apps/server` changes.

## Stack

- Hono HTTP server on Cloudflare Workers
- oRPC RPC/OpenAPI handlers
- Better Auth integration endpoint
- Runtime env from `@gneissdotrun/env/server`

## Commands (Run From Repo Root)

- Start server in turbo graph: `bun run dev:server`
- Build server package: `bun --filter server run build`
- Typecheck server: `bun --filter server run typecheck`
- Compile binary output: `bun --filter server run compile`
- Lint server: `bunx oxlint apps/server`
- Format server (mutating): `bunx oxfmt --write apps/server`

## Tests

- Current state: no `test` script in `apps/server/package.json`.
- Use Bun test runner directly.
- Run all server tests (if present): `bun test apps/server`
- Run single test file: `bun test apps/server/src/index.test.ts`
- Run single test case: `bun test apps/server/src/index.test.ts --test-name-pattern "rpc health"`

## HTTP/RPC Conventions

- Keep middleware ordering explicit (`logger`, `cors`, auth routes, RPC/API handlers).
- Keep oRPC handlers configured in one place and reused.
- Keep interceptors (`onError`) active for centralized logging.
- Keep context creation delegated to `@gneissdotrun/api/context`.

## Style And Architecture

- Keep strict TS and explicit types at API boundaries.
- Use `import type` where imports are type-only.
- Import grouping order:
- 1. third-party
- 2. workspace packages (`@gneissdotrun/*`)
- 3. relative imports
- Keep server entrypoint thin; push business logic into `packages/api`.

## Error Handling

- Use typed failures in API layer (`ORPCError` in `packages/api`).
- Avoid broad `try/catch` that swallows errors.
- Prefer returning framework-native responses and preserving status behavior.

## Security/Env

- Never hardcode secrets.
- Read runtime bindings only via typed `env` module.
- Keep CORS and auth settings consistent with infra bindings.

## Delivery Checklist

- Run `bun --filter server run typecheck` after changes.
- Run targeted Bun tests if adding/changing tests.
- Run lint/format on touched paths.
