# Workspace Notes

- `apps/web`: routes in `apps/web/src/routes`; server functions in `apps/web/src/functions`; middleware in `apps/web/src/middleware`; prefer `beforeLoad`/`loader`; reuse `orpc`/`queryClient` from route context.
- `apps/server`: preserve middleware order (`logger`, `cors`, auth routes, RPC/API handlers); use `@gneissdotrun/api/context`; keep business logic in `packages/api`.
- `apps/docs`: keep frontmatter metadata (`title`, `description`), nav aligned with `apps/docs/astro.config.mjs`, and docs task-oriented with runnable commands.
- `packages/api`: keep `publicProcedure`/`protectedProcedure` boundaries, validate external input with `.input(...)`, compose routers in `packages/api/src/routers/index.ts`, keep typed context in `packages/api/src/context.ts`.
- `packages/auth`: keep setup centralized in `packages/auth/src/index.ts`; keep trusted origins/cookie behavior aligned with infra/env bindings.
- `packages/config`: treat edits as high-impact; keep `strict: true`; prefer additive, backward-compatible changes.
- `packages/db`: keep schema in `packages/db/src/schema`, re-export via `packages/db/src/schema/index.ts`, prefer generated migrations.
- `packages/env`: keep centralized validation with split server/client modules; require `VITE_` for client-visible keys; avoid direct `process.env` in app code.
- `packages/infra`: keep env loading/bindings explicit and resource naming deterministic; avoid destructive changes unless explicitly requested.
