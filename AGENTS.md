# AGENTS.md

`gneissdotrun` is a Cloudflare monorepo managed with `bun` workspaces and `turbo`.

- Repo checks: `bun run check`, `bun run typecheck`, `bun run build`.
- Extra guidance: `docs/agents/standards.md`, `docs/agents/workspaces.md`.

# Learnings

Whenever you learn something new that feels contradictory or that you didn't expect, add it to the list below for future reference.

- In `cloudflare/agents`, `routeAgentRequest()` may not handle plain HTTP requests to `/agents/*` unless they are WebSocket upgrades (tests indicate non-upgrade requests fall through). Plan server routing accordingly.
- In this repo, `bun --filter <workspace> run <script>` may not match workspace names reliably; prefer `bunx turbo -F <workspace> <script>` for build/typecheck commands.
