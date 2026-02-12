# Implementation Tasks: Gneiss

> **Status:** Draft

---

## Conventions

- Keep changes aligned with `docs/agents/standards.md` and `docs/agents/workspaces.md`.
- Treat `packages/db/src/migrations/*` as generated outputs.
- Keep `apps/server/src/index.ts` middleware order: logger -> cors -> auth -> agents -> RPC/OpenAPI.

---

## Phase 1: Foundations (Repo Mapping + Core Services)

- [x] Confirm v1 scope as minimal implementations of all planned features in `docs/plans/PRODUCT-VISION.md` and `docs/plans/TECH-SPEC.md`.
- [x] Define core data model naming conventions based on existing schema conventions.
- [x] Add Agents server dependencies to `apps/server/package.json`: `agents`, `@cloudflare/ai-chat`, `hono-agents`, `ai`, `@ai-sdk/google`.
- [x] Add Agents client dependencies to `apps/web/package.json`: `agents`, `@cloudflare/ai-chat/react`, `@ai-sdk/react`.
- [x] Extend `packages/infra/alchemy.run.ts` with Durable Object namespaces + DO SQLite migrations for Rewrite/Index/Router (add Organization/Surfacing when implemented).
- [x] Bind KV for rate limiting + router index cache in `packages/infra/alchemy.run.ts`.
- [x] Bind R2 for uploads in `packages/infra/alchemy.run.ts`.
- [x] Bind Vectorize for embeddings in `packages/infra/alchemy.run.ts` only if semantic retrieval is required.
- [x] Add workflow bindings for `AgentWorkflow` classes in `packages/infra/alchemy.run.ts`.
- [x] Add explicit `dev` port (`3001`) for `apps/web` in `packages/infra/alchemy.run.ts`.
- [x] Verify `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL` are present in infra bindings and loaded before auth initialization.
- [x] Verify `packages/env/env.d.ts` typing still resolves from Alchemy bindings after infra changes.
- [x] Keep worker entrypoint as `apps/server/src/index.ts` (no change; validate during infra edits).
- [x] Run `bun --filter server run typecheck` and `bun --filter web run typecheck` after dependency additions.

---

## Phase 2: Capture Layer (Server + Web Integration)

- [x] Create `apps/server/src/agents/` module structure and export barrel in `apps/server/src/agents/index.ts`.
- [x] Define agent env typings in `apps/server/src/agents/shared/agent-env.ts`.
- [x] Build `RewriteAgent` in `apps/server/src/agents/rewrite-agent.ts` using `AIChatAgent`.
- [x] Implement per-interaction prompt assembly in `RewriteAgent` (note content + routing context, not full `this.messages`).
- [x] Add `IndexAgent` in `apps/server/src/agents/index-agent.ts` for note index and broadcast.
- [x] Add `RouterAgent` in `apps/server/src/agents/router-agent.ts` for routing LLM + dispatch.
- [x] Add shared agent utilities in `apps/server/src/agents/shared/`.
- [x] Add KV-backed router index cache in `apps/server/src/agents/router-index.ts`.
- [x] Register `agentsMiddleware()` for `/agents/*` before RPC/OpenAPI in `apps/server/src/index.ts`.
- [x] Add HTTP fallback with `routeAgentRequest()` for non-WebSocket `/agents/*` requests if needed.
- [x] Add validation middleware for Hono routes using `validator()` + `c.req.valid()`.
- [x] Create note schema tables in `packages/db/src/schema` and update `packages/db/src/schema/index.ts` exports.
- [x] Generate D1 migrations via Drizzle tooling and add to `packages/db/src/migrations`.
- [x] Add blank-note capture UI in `apps/web/src/routes`.
- [x] Add `apps/web/src/lib/agents/client.ts` for agent client configuration.
- [x] Add `apps/web/src/lib/agents/hooks.ts` to wrap `useAgent` + `useAgentChat`.
- [x] Implement note morphing stream UI in `apps/web/src/components/editor/NoteEditor.tsx`.
- [x] Build command palette UI in `apps/web/src/components/command-palette/CommandPalette.tsx`.
- [x] Implement upload route(s) in `apps/server/src/index.ts` to store files in R2 and metadata in D1.
- [x] Add upload UI in `apps/web/src/components` and wire to server upload route(s).

---

## Phase 3: Note-as-Result + Organization Layer

- [ ] Implement slash command parsing in `apps/web/src/components/editor/NoteEditor.tsx`.
- [ ] Persist slash commands in agent conversation history, not the editor surface.
- [ ] Handle optimistic concurrency + conflict resolution between editor state and `RewriteAgent` updates.
- [ ] Build `OrganizationAgent` in `apps/server/src/agents/organization-agent.ts`.
- [ ] Build `OrganizeWorkflow` in `apps/server/src/agents/workflows/organize-workflow.ts`.
- [ ] Build `ContradictionWorkflow` in `apps/server/src/agents/workflows/contradiction-workflow.ts`.
- [ ] Implement Vectorize adapter in `apps/server/src/agents/vectorize.ts` only if embeddings are required.
- [ ] Add extraction/fact/collection schemas in `packages/db/src/schema` and re-export via `packages/db/src/schema/index.ts`.
- [ ] Generate new D1 migrations via Drizzle tooling.
- [ ] Implement dual-write persistence + IndexAgent notifications in `apps/server/src/agents/shared/persistence.ts`.

---

## Phase 4: Surfacing Layer

- [ ] Build `SurfacingAgent` in `apps/server/src/agents/surfacing-agent.ts`.
- [ ] Add digest and collections routes in `apps/web/src/routes`.
- [ ] Implement hybrid search UI in `apps/web/src/components/search/SearchBar.tsx`.
- [ ] Add collection lifecycle endpoints in `apps/server/src/agents/organization-agent.ts` and wire UI actions.
- [ ] Render wiki links inside the editor UI and ensure RewriteAgent outputs include them.

---

## Phase 5: Optional OpenClaw Integration

- [ ] Add `/api/openclaw/*` routes in `apps/server/src/index.ts`.
- [ ] Add OpenClaw token schema in `packages/db/src/schema` and generate migrations.
- [ ] Implement webhook sender in `apps/server/src/agents/openclaw.ts`.
- [ ] Create `packages/skills/gneiss` AgentSkill package with metadata and exports.
- [ ] Optionally expose MCP agent in `apps/server/src/agents/mcp-agent.ts`.

---

## Phase 6: Hardening & Scale

- [ ] Implement KV rate limiting middleware in `apps/server/src/middleware/rate-limit.ts`.
- [ ] Add audit log schema in `packages/db/src/schema/audit-logs.ts` and generate migrations.
- [ ] Persist audit logs from `apps/server/src/agents/shared/persistence.ts`.
- [ ] Add export tooling routes in `apps/server/src/index.ts`.
- [ ] Optimize DO hibernation patterns, Vectorize queries (if enabled), and D1 query plans.
- [ ] Add tests under `apps/server/src/__tests__` for ingest, routing, workflows.
- [ ] Add tests under `apps/web/src/__tests__` for editor + agent hooks.
- [ ] Run `bun run check`, `bun run typecheck`, and targeted `bun test <path>` suites.
