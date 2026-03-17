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
- For package `tsc -b` scripts, exclude `dist` in workspace `tsconfig.json`; otherwise committed declaration outputs can trigger `TS5055` (output would overwrite input) during Turbo typecheck.
- In Hono tests that call `app.fetch()` without an execution context, accessing `c.executionCtx` can throw; guard access (try/catch) before calling `waitUntil`.
- In `apps/web` component tests with mocked text inputs, `fireEvent` can mutate DOM values without triggering React state updates unless the mock wires both `onChange` and `onInput`; include both handlers for reliable editor typing assertions.
- In `apps/web` component tests, `window.matchMedia` may be undefined in jsdom; guard `matchMedia` checks (`typeof window.matchMedia === "function"`) before calling to avoid runtime failures.
- This repo is greenfield and unpublished; when redesigning systems, prefer deleting dead code and rebuilding only what is needed rather than preserving backward compatibility or minimizing churn.
