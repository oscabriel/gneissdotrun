# AGENTS.md

`gneissdotrun` is a monorepo managed with `bun` workspaces and `turbo`.

- Repo checks: `bun run check`, `bun run typecheck`, `bun run build`.
- Extra guidance: `docs/agents/standards.md`, `docs/agents/workspaces.md`.

# Learnings

Whenever you learn something new that you are asked to remember, that feels contradictory, or that you didn't expect, add it to the list below for future reference.

- In `cloudflare/agents`, `routeAgentRequest()` may not handle plain HTTP requests to `/agents/*` unless they are WebSocket upgrades (tests indicate non-upgrade requests fall through). Plan server routing accordingly.
- In this repo, `bun --filter <workspace> run <script>` may not match workspace names reliably; prefer `bunx turbo -F <workspace> <script>` for build/typecheck commands.
- In `apps/web`, use kebab-case for component filenames (for example, `app-shell.tsx`) and PascalCase for component names inside those files.
- Running `bun test` against modules that import `agents` may fail in local Bun runtime due unresolved `cloudflare:email`; in tests, mock `agents`/`agents/workflows` before dynamically importing those modules.
- In `apps/server`, keep `/agents/*` on a single `routeAgentRequest` code path with explicit `404` fallback for non-upgrade HTTP; CORS preflight still succeeds via the global `cors` middleware.
- After adding a new workspace package, run `bun install` before Turbo commands; otherwise Turbo may warn that the workspace is missing from `bun.lock`.
