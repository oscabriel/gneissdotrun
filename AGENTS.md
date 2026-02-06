# AGENTS.md

## Purpose

- This file is for coding agents working in the `gneissdotrun` monorepo.
- Follow repository conventions exactly; prefer existing patterns over invention.
- Keep changes scoped, typed, and consistent with existing architecture.

## Monorepo Layout

- `apps/web` - TanStack Start + React frontend (Cloudflare-targeted Vite app)
- `apps/server` - Hono server entrypoint, oRPC handlers, auth/http wiring
- `apps/docs` - Astro Starlight docs site
- `packages/api` - oRPC procedures/routers and API context
- `packages/auth` - Better Auth configuration
- `packages/db` - Drizzle schema and DB client
- `packages/env` - Typed runtime env access (`server` and `web`)
- `packages/infra` - Alchemy Cloudflare deployment config
- `packages/config` - Shared TS config package

## Toolchain And Defaults

- Package manager: `bun` (`bun@1.3.8`)
- Task runner: `turbo`
- Lint: `oxlint`
- Format: `oxfmt` (tabs, semicolons, double quotes)
- Language: strict TypeScript (`moduleResolution: bundler`)

## Install And Bootstrap

- Install deps: `bun install`
- Start all dev tasks: `bun run dev`
- Start web only: `bun run dev:web`
- Start server only: `bun run dev:server`
- Start infra dev worker orchestration: `bun --filter @gneissdotrun/infra run dev`

## Build Commands

- Build all configured targets: `bun run build`
- Build web only: `bun --filter web run build`
- Build server only: `bun --filter server run build`
- Build docs only: `bun --filter docs run build`

## Lint And Format Commands

- Repo lint + format (mutating): `bun run check`
- Lint only: `bunx oxlint`
- Format only (mutating): `bunx oxfmt --write`
- Lint one workspace: `bunx oxlint apps/web`
- Format one workspace: `bunx oxfmt --write apps/web`

## Typecheck Commands

- Typecheck all configured workspaces: `bun run typecheck`
- Typecheck web: `bun --filter web run typecheck`
- Typecheck server: `bun --filter server run typecheck`
- Typecheck docs: `bun --filter docs run typecheck`
- Typecheck package API: `bun --filter @gneissdotrun/api run typecheck`

## Database And Infra Commands

- Generate migrations: `bun run db:generate`
- Push schema: `bun run db:push`
- Deploy cloud resources: `bun run deploy`
- Destroy cloud resources: `bun run destroy`

## Test Commands

- Current state: there are no workspace `test` scripts defined yet.
- Use Bun test runner directly when adding/running tests.
- Run all discovered tests: `bun test`
- Run tests in one workspace path: `bun test apps/web`
- Run a single test file: `bun test apps/web/src/routes/todos.test.tsx`
- Run a single test by name: `bun test apps/web/src/routes/todos.test.tsx --test-name-pattern "toggles todo"`

## Single-Test Guidance (Important)

- Prefer file-targeted test runs while iterating.
- Always pass a direct file path first, then add `--test-name-pattern` if needed.
- Avoid full-repo test runs unless the change is cross-cutting.

## General Code Style

- Keep strict TypeScript; do not weaken compiler options.
- Prefer explicit types at public boundaries; infer locals when obvious.
- Use `import type` for type-only imports.
- Keep imports grouped: third-party first, then workspace/alias imports, then relative imports.
- Use existing path aliases where configured (`@/` in app projects).
- Use named exports for shared utilities; default exports are acceptable for route/components when already used.
- Avoid adding comments unless logic is non-obvious.
- Do not add new dependencies when existing stack already covers the need.

## Formatting Conventions

- Tabs for indentation.
- Semicolons enabled.
- Double quotes for strings.
- Trailing commas where formatter applies them.
- Let `oxfmt` own formatting decisions; do not hand-format against it.

## Naming Conventions

- Components/classes/types: `PascalCase`
- Functions/variables/hooks: `camelCase`
- Constants: `UPPER_SNAKE_CASE` for true constants only
- File names: existing local convention is mostly `kebab-case` for components/utils and framework-specific route names (for example `__root.tsx`).
- Drizzle schema columns use `snake_case` DB names with typed TS accessors.

## Error Handling Conventions

- Validate inputs with Zod/oRPC `.input(...)` at API boundaries.
- Use `ORPCError` for auth/procedure-level API failures.
- Keep server interceptors (`onError`) active for centralized logging.
- In web UI, surface user-facing failures with toast notifications.
- Fail fast on missing/invalid env via typed env modules.

## Framework-Specific Guidance

- TanStack Router: keep route data loading in route lifecycle (`beforeLoad`/`loader`) when applicable.
- TanStack Query: centralize query client behavior in existing utility modules.
- Hono: keep middleware ordering explicit and minimal.
- Drizzle: define schema in `packages/db/src/schema`, re-export via schema index.
- Better Auth: keep auth config centralized in `packages/auth/src/index.ts`.

## Generated/Derived Files

- Treat these as generated or tool-managed; avoid manual edits unless required:
- `apps/web/src/routeTree.gen.ts`
- `apps/docs/.astro/*`
- `packages/db/src/migrations/*`

## Workspace AGENTS Files

- Each app/package has its own `AGENTS.md` with local commands and extra rules.
- If rules conflict, prefer the closest `AGENTS.md` to the file being changed.

## Change Checklist For Agents

- Run `bun run check` and `bun run typecheck` before finishing substantial edits.
- Run the narrowest relevant typecheck/build/test command for touched area.
- Keep edits minimal and avoid unrelated refactors.
- Do not edit secrets or `.env` values unless explicitly requested.
