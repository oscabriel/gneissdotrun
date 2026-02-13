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
- [x] Add explicit `dev` port (`3001`) for `apps/web` in `apps/web/vite.config.ts` (not infra bindings).
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

- [x] Implement slash command parsing in `apps/web/src/components/editor/NoteEditor.tsx`.
- [x] Persist slash commands in agent conversation history, not the editor surface.
- [x] Handle optimistic concurrency + conflict resolution between editor state and `RewriteAgent` updates.
- [x] Build `OrganizationAgent` in `apps/server/src/agents/organization-agent.ts`.
- [x] Build `OrganizeWorkflow` in `apps/server/src/agents/workflows/organize-workflow.ts`.
- [x] Build `ContradictionWorkflow` in `apps/server/src/agents/workflows/contradiction-workflow.ts`.
- [x] Implement Vectorize adapter in `apps/server/src/agents/vectorize.ts` only if embeddings are required.
- [x] Add extraction/fact/collection schemas in `packages/db/src/schema` and re-export via `packages/db/src/schema/index.ts`.
- [x] Generate new D1 migrations via Drizzle tooling.
- [x] Implement dual-write persistence + IndexAgent notifications in `apps/server/src/agents/shared/persistence.ts`.

---

## Phase 4: Surfacing Layer

- [x] Build `SurfacingAgent` in `apps/server/src/agents/surfacing-agent.ts`.
- [x] Add digest and collections routes in `apps/web/src/routes`.
- [x] Implement hybrid search UI in `apps/web/src/components/search/SearchBar.tsx`.
- [x] Add collection lifecycle endpoints in `apps/server/src/agents/organization-agent.ts` and wire UI actions.
- [x] Render wiki links inside the editor UI and ensure RewriteAgent outputs include them.

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

---

## UX Overhaul Backlog (Discrete Task IDs)

This backlog maps directly to `docs/plans/UX-OVERHAUL-PLAN.md` and is designed as a discrete, trackable execution list.

### A) Core Capture Contract (Ship First)

- [ ] `UX-001` Add shared `RouteExecutionOutcome` type (web/server): `kind`, `uiAction`, `noteId?`, `toast?`, `ephemeral?`, `secondaryEffects[]`.
- [ ] `UX-002` Add a single capture endpoint (`POST /api/capture`) that performs classify + execute + normalized outcome.
- [ ] `UX-003` Keep `POST /api/notes/route` as compatibility-only (internal) or remove after migration.
- [ ] `UX-004` Update home submit flow to call capture endpoint before note creation.
- [ ] `UX-005` Ensure non-note outcomes never create note records.
- [ ] `UX-006` Add deterministic outcome->UI mapper (navigate, reset canvas, ephemeral answer, toast).
- [ ] `UX-007` Standardize capture error envelope: `error.code`, `error.message`, `recoverable`.
- [ ] `UX-008` Emit audit/telemetry event for every route decision and execution outcome.

### B) Workspace IA and Layout (`/`)

- [ ] `UX-009` Replace `apps/web/src/routes/index.tsx` with a workspace shell route.
- [ ] `UX-010` Add `apps/web/src/components/workspace/WorkspaceShell.tsx`.
- [ ] `UX-011` Add `apps/web/src/components/sidebar/NotesSidebar.tsx`.
- [ ] `UX-012` Add `apps/web/src/components/workspace/CanvasPane.tsx`.
- [ ] `UX-013` Remove visible "Create note session" and "New note session" flows from home.
- [ ] `UX-014` Remove prototype dashboard cards from primary workspace surface.
- [ ] `UX-015` Keep command palette modal/keyboard-based (`Cmd+K`), not a permanent card.
- [ ] `UX-016` Move Collections/Digest links into secondary nav affordances.

### C) Sidebar as Navigable Source of Truth

- [ ] `UX-017` Drive sidebar list from `useIndexAgent` state as primary source.
- [ ] `UX-018` Hydrate fallback from `GET /api/notes` when index state is cold/empty.
- [ ] `UX-019` Persist selected note in route search params (`noteId`) with validation.
- [ ] `UX-020` Restore selection from URL on reload/reconnect/new tab.
- [ ] `UX-021` Open selected sidebar note in canvas immediately without extra confirmation.
- [ ] `UX-022` Enforce sidebar ordering by `updatedAt DESC` from IndexAgent state.
- [ ] `UX-023` Keep sidebar fully functional after reconnect/refresh.
- [ ] `UX-024` Add first-time/empty-state sidebar prompt copy.

### D) Canvas-First Editor Behavior

- [ ] `UX-025` Refactor `NoteEditor` to one visible note surface.
- [ ] `UX-026` Remove split "Current note" + "Streaming output" default layout.
- [ ] `UX-027` Keep one interaction affordance and one `Save` action (`Cmd+Enter`).
- [ ] `UX-028` Ensure slash command text is never persisted in final note body.
- [ ] `UX-029` Render streaming rewrite as in-place note morph on the same canvas.
- [ ] `UX-030` Replace developer-state/conflict messaging with user-safe copy.
- [ ] `UX-031` Keep conflict handling with clear apply/dismiss semantics.
- [ ] `UX-032` Preserve wiki-link rendering and navigation on the note surface.

### E) Route Execution Completeness (Server)

- [ ] `UX-033` Implement execution handler for `new_note`.
- [ ] `UX-034` Implement execution handler for `update_existing`.
- [ ] `UX-035` Implement execution handler for `correction`.
- [ ] `UX-036` Implement execution handler for `split`.
- [ ] `UX-037` Implement execution handler for `fan_out`.
- [ ] `UX-038` Wire `fan_out` execution to `apps/server/src/agents/workflows/fanout-workflow.ts`.
- [ ] `UX-039` Implement execution handler for `workspace_action`.
- [ ] `UX-040` Implement execution handler for `ephemeral_answer`.
- [ ] `UX-041` Implement execution handler for `store_preference`.
- [ ] `UX-042` Implement execution handler for `duplicate`.
- [ ] `UX-043` Return explicit UI intent metadata for each route outcome.
- [ ] `UX-044` Ensure non-note outcomes return canvas to blank-ready state.

### F) Background Organization Must Stay Ambient

- [ ] `UX-045` Keep rewrite->organize trigger in `RewriteAgent`.
- [ ] `UX-046` Keep scheduled heartbeat in `OrganizationAgent`.
- [ ] `UX-047` Remove/hide manual "organize now" controls from core capture flow.
- [ ] `UX-048` Add idempotent persistence/upserts for org outputs to avoid duplicate rows.
- [ ] `UX-049` Keep status signals subtle/peripheral in workspace chrome.
- [ ] `UX-050` Preserve IndexAgent broadcast updates for collections/action-items/contradictions.

### G) Secondary Surfaces Positioning

- [ ] `UX-051` Keep `apps/web/src/routes/collections.tsx` as optional review surface.
- [ ] `UX-052` Keep `apps/web/src/routes/digest.tsx` as optional review surface.
- [ ] `UX-053` Reduce home CTA prominence for Collections/Digest/Search.
- [ ] `UX-054` Keep search available but secondary to canvas-first capture.
- [ ] `UX-055` Add command-palette entries for quick access to secondary surfaces.

### H) Search Positioning + Retrieval Quality

- [ ] `UX-056` Use typed route search validation for search query state.
- [ ] `UX-057` Standardize search-state updates through router navigation helpers.
- [ ] `UX-058` Wire embedding upserts into rewrite/organization pipelines.
- [ ] `UX-059` Preserve keyword fallback path for reliability.
- [ ] `UX-060` Preserve citations + related collections in query responses.

### I) Uploads in the New Interaction Model

- [ ] `UX-061` Integrate `UploadPanel` as contextual secondary UI in workspace/canvas.
- [ ] `UX-062` Keep uploads available but non-dominant in primary writing flow.
- [ ] `UX-063` Preserve upload->active-note linkage via `noteId` when present.
- [ ] `UX-064` Show lightweight upload success/error feedback without stealing focus.
- [ ] `UX-065` Keep backend upload route contract unchanged unless response shaping is required.

### J) History and Safety UX

- [ ] `UX-066` Add per-note History route/view as secondary surface.
- [ ] `UX-067` Persist version snapshots required for revert.
- [ ] `UX-068` Render timeline entries: prompt, route/action summary, timestamp.
- [ ] `UX-069` Add revert-to-version action with safe confirmation + audit event.
- [ ] `UX-070` Keep primary note surface transcript-free.

### K) Visual + Interaction System Alignment

- [ ] `UX-071` Update `apps/web/src/index.css` tokens toward the stone palette system.
- [ ] `UX-072` Align typography: Libre Baskerville (content), Geist Mono (UI/chrome/input).
- [ ] `UX-073` Remove forced dark-only root mode and support intentional light/dark parity.
- [ ] `UX-074` Reduce border/card noise in home workspace hierarchy.
- [ ] `UX-075` Ensure keyboard reliability for `N`, `Cmd+K`, `Cmd+Enter`.
- [ ] `UX-076` Ensure mobile preserves blank-canvas-first mental model.

### L) coss UI Consistency

- [ ] `UX-077` Standardize home/editor/sidebar/search/upload on `@/components/ui/*` primitives.
- [ ] `UX-078` Replace raw controls where they break token/accessibility consistency.
- [ ] `UX-079` Enforce semantic token usage (`muted`, `foreground`, `border`, `accent`) in workspace components.
- [ ] `UX-080` Ensure icon-only controls have `aria-label` and size consistency.

### M) Minimal Hardening + Focused Tests

- [ ] `UX-081` Add rate limiting middleware for capture/query/upload endpoints.
- [ ] `UX-082` Add `audit_logs` schema + persistence for routing/rewrite mutations.
- [ ] `UX-083` Add server tests for route execution outcomes across all route kinds.
- [ ] `UX-084` Add web tests for note-as-result behavior (no transcript artifacts in final note body).
- [ ] `UX-085` Add tests for sidebar reactivity ordering + reconnect behavior.
- [ ] `UX-086` Add tests for background organization trigger path.
- [ ] `UX-087` Add keyboard interaction tests (`N`, `Cmd+K`, `Cmd+Enter`).
- [ ] `UX-088` Add mobile workspace smoke tests for blank-canvas-first behavior.
