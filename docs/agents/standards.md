# Agent Standards

- Tooling: `oxlint` + `oxfmt`.
- Tests: run `bun test <path>` while iterating.
- For broad changes: run `bun run check` and `bun run typecheck`.
- Treat these as generated unless task requires regeneration: `apps/web/src/routeTree.gen.ts`, `apps/docs/.astro/*`, `packages/db/src/migrations/*`.
- Do not edit secrets or `.env` values unless explicitly requested.
