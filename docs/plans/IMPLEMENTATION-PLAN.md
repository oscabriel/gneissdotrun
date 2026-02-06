# Implementation Plan: Gneiss

> **Status:** Active

---

## Purpose

Map the Cloudflare Agents backend plan onto the actual repo structure (apps + packages) and current base architecture (Hono worker + TanStack Start + Drizzle D1 + better-auth + alchemy bindings).

---

## Phases

### 1) Foundations (repo mapping + core services)

- Confirm product scope and success criteria
- Finalize core data model and naming conventions
- Keep TanStack Start + Hono layout
- Use `packages/infra/alchemy.run.ts` for D1 + Worker + TanStack Start bindings
- Continue D1 + Drizzle setup in `packages/db/src`
- Keep auth baseline in `packages/auth/src` (better-auth + D1 adapter)
- Add Cloudflare Agents dependencies to `apps/server/package.json`
- Add Cloudflare Agents client deps to `apps/web/package.json`
- Add Worker bindings for agents, KV, R2, Vectorize in `packages/infra/alchemy.run.ts`
- Extend env typings in `packages/env/env.d.ts` and `packages/env/src/server.ts`
- Ensure worker entrypoint remains `apps/server/src/index.ts`

### 2) Capture Layer (server + web integration)

- Create agents module in `apps/server/src/agents/` (Agent classes + workflows)
- Register DO classes + routes in `apps/server/src/index.ts`
- Build RewriteAgent (extends AIChatAgent) in `apps/server/src/agents/rewrite-agent.ts`
- Build IndexAgent in `apps/server/src/agents/index-agent.ts`
- Build RouterAgent in `apps/server/src/agents/router-agent.ts`
- Add shared agent utilities in `apps/server/src/agents/shared/`
- Add routing index cache adapter (KV) in `apps/server/src/agents/router-index.ts`
- Add Hono routes for agent WS + RPC (e.g. `/agents/*`) in `apps/server/src/index.ts`
- Add D1 tables in `packages/db/src/schema` + migrations for notes/entities/etc
- Build blank-page new note UI in `apps/web/src/routes`
- Add agents hooks (useAgent/useAgentChat) to `apps/web/src/lib/agents`
- Implement note morphing stream in `apps/web/src/components/editor`
- Build command palette in `apps/web/src/components/command-palette`
- Add validation middleware in `apps/server/src/index.ts`
- Add file upload flow (R2) using `apps/server/src/index.ts` routes and `apps/web` upload UI

### 3) Note-as-Result + Organization Layer

- Implement slash command parsing in `apps/web/src/components/editor`
- Preserve command text in conversation history (agent DB) not editor surface
- Handle concurrent editing conflicts in editor + RewriteAgent apply
- Build OrganizationAgent in `apps/server/src/agents/organization-agent.ts`
- Build OrganizeWorkflow in `apps/server/src/agents/workflows/organize-workflow.ts`
- Add Vectorize adapter in `apps/server/src/agents/vectorize.ts`
- Add contradiction workflows in `apps/server/src/agents/workflows/contradiction-workflow.ts`
- Persist extractions in `packages/db/src/schema` + migrations
- Implement dual-write + IndexAgent notifications in `apps/server/src/agents/shared/persistence.ts`

### 4) Surfacing Layer

- Build SurfacingAgent in `apps/server/src/agents/surfacing-agent.ts`
- Add digest + collections UI in `apps/web/src/routes`
- Add hybrid search UI in `apps/web/src/components/search`
- Add collection lifecycle actions in `apps/server/src/agents/organization-agent.ts` + UI
- Ensure rewritten notes include wiki links + render in `apps/web/src/components/editor`

### 5) Optional OpenClaw Integration

- Add `/api/openclaw/*` endpoints in `apps/server/src/index.ts`
- Add OpenClaw token schema in `packages/db/src/schema`
- Add webhook sender in `apps/server/src/agents/openclaw.ts`
- Provide a `gneiss` AgentSkill package under `packages/skills/gneiss` (new)
- Optionally expose McpAgent from `apps/server/src/agents/mcp-agent.ts`

### 6) Hardening & Scale

- Rate limiting (KV) in `apps/server/src/middleware/rate-limit.ts`
- Audit logs in `packages/db/src/schema` + server persistence in `apps/server/src/agents/shared/persistence.ts`
- Export tooling via Hono routes in `apps/server/src/index.ts`
- Performance tuning: DO hibernation patterns, Vectorize query optimization, D1 query plans
- Testing coverage for ingest, agent routing, workflows (place tests under `apps/server/src/__tests__` and `apps/web/src/__tests__`)

---

## Reference Implementation Notes (Cloudflare Agents SDK)

- Agent classes live in `packages/agents/src/index.ts` and `packages/ai-chat/src/index.ts` in the upstream repo
- Hono integration is provided by `hono-agents`, which can register `app.use("/agents/*", agentsMiddleware())`
- React hooks (`useAgent`, `useAgentChat`) are exported from `agents/react`
- Core primitives to mirror in our architecture
- `Agent` base class with `initialState`, `setState()`, `sql`, `schedule()`, `scheduleEvery()`
- `@callable()` decorator for client RPC access
- `AIChatAgent` for streaming, resumable chat with persisted messages
- `AgentWorkflow` for durable multi-step pipelines with progress reporting
- `McpAgent` for MCP server support if needed

---

## File And Module Templates

Server (Workers + Agents)

- `apps/server/src/agents/index.ts` re-exports all agent classes and workflows
- `apps/server/src/agents/rewrite-agent.ts` extends `AIChatAgent`, implements `onChatMessage`, `applyUpdate`, `persistNote`
- `apps/server/src/agents/index-agent.ts` extends `Agent`, owns reactive note index + broadcasts
- `apps/server/src/agents/router-agent.ts` extends `Agent`, runs routing LLM + dispatches to rewrite/workflows
- `apps/server/src/agents/organization-agent.ts` extends `Agent`, schedules `heartbeat`, runs workflows
- `apps/server/src/agents/surfacing-agent.ts` extends `Agent`, handles query synthesis + digest
- `apps/server/src/agents/workflows/organize-workflow.ts` extends `AgentWorkflow`, calls extraction steps
- `apps/server/src/agents/workflows/contradiction-workflow.ts` extends `AgentWorkflow`, uses `waitForApproval`
- `apps/server/src/agents/shared/persistence.ts` handles dual-write + IndexAgent notifications
- `apps/server/src/agents/shared/agent-env.ts` defines agent env type for bindings (D1, KV, R2, Vectorize)
- `apps/server/src/index.ts` registers agents middleware + DO routing

Web (TanStack Start + React)

- `apps/web/src/lib/agents/client.ts` configures agent client + helper factory
- `apps/web/src/lib/agents/hooks.ts` wraps `useAgent` and `useAgentChat`
- `apps/web/src/components/editor/NoteEditor.tsx` streams note morphing + slash commands
- `apps/web/src/components/command-palette/CommandPalette.tsx` handles global commands
- `apps/web/src/components/search/SearchBar.tsx` for hybrid search results
- `apps/web/src/routes/notes/$noteId.tsx` connects RewriteAgent to editor
- `apps/web/src/routes/index.tsx` renders home + capture UI

Data + Schema

- `packages/db/src/schema/notes.ts` core note entities and metadata
- `packages/db/src/schema/entities.ts` entity extraction tables
- `packages/db/src/schema/facts.ts` fact + contradiction tables
- `packages/db/src/schema/collections.ts` collection + join tables
- `packages/db/src/schema/actions.ts` action items + workflow tables
- `packages/db/src/schema/audit-logs.ts` audit logs
- `packages/db/src/migrations/*` create D1 tables + indexes

## Exit Criteria (per phase)

- **Functionality:** key deliverables are usable end-to-end
- **Safety:** auth, scopes, and rate limits are enforced
- **Reliability:** workflow retry, idempotency, and error reporting in place
- **Observability:** Workers logs and workflow status tracking cover critical paths
