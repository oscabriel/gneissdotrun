# Cloudflare Agents 0.5 Enhancement Plan

> Status: Implemented

## Objective

Adopt the most relevant `cloudflare/agents` 0.5.x improvements in `gneissdotrun` to increase routing correctness, background-task reliability, and AI chat resilience while keeping current product behavior stable.

## Current Baseline

- Server depends on `agents@^0.5.0`, `@cloudflare/ai-chat@^0.1.1`, and `hono-agents@^3.0.4` in `apps/server/package.json`.
- Web depends on `agents@^0.5.0` and `@cloudflare/ai-chat@^0.1.1` in `apps/web/package.json`.
- Agent routing is configured in two places in `apps/server/src/index.ts`:
  - `app.use("/agents/*", agentsMiddleware(...))`
  - `app.all("/agents/*", async (c) => routeAgentRequest(...))`
- Scheduled background work exists in:
  - `apps/server/src/agents/organization-agent.ts`
  - `apps/server/src/agents/surfacing-agent.ts`
- The only existing server test file is `apps/server/src/ux-hardening.test.ts`.

## Design Principles

- Keep one authoritative routing path for `/agents/*`.
- Prefer built-in SDK retries (`this.retry`, per-task retry options) over ad-hoc retry logic.
- Keep chat streaming resumable-safe and message-storage-safe.
- Add tests for behavior that can silently regress (routing edge cases, retries, resume flows).
- Avoid experimental APIs (`agents/experimental/forever`, `@cloudflare/ai-chat/experimental/forever`) for production paths.

## PR Slices

### PR 1: Agent Routing Contract and Tests

#### Scope

Make `/agents/*` routing deterministic and testable.

#### Files

- `apps/server/src/index.ts`
- `apps/server/src/ux-hardening.test.ts` (or new `apps/server/src/agents-routing.test.ts`)
- `AGENTS.md` (only if we learn a new routing invariant)

#### Tasks

- Remove duplicate routing ambiguity by choosing one canonical path for `/agents/*` handling.
- Keep explicit non-matched behavior (`404`) for agent routes.
- Verify behavior for:
  - WebSocket upgrade requests
  - Plain HTTP requests to `/agents/*`
  - CORS/preflight behavior for cross-domain clients
- Add tests that assert expected behavior for each request shape.

#### Verification

- `bun test apps/server/src/ux-hardening.test.ts`
- `bunx turbo -F server typecheck`

#### Exit Criteria

- `/agents/*` behavior is consistent in one code path.
- Tests fail if HTTP vs WebSocket behavior changes unexpectedly.

### PR 2: Retry Adoption in Background Agents

#### Scope

Use `agents@0.5` retry features in scheduled/background work.

#### Files

- `apps/server/src/agents/organization-agent.ts`
- `apps/server/src/agents/surfacing-agent.ts`

#### Tasks

- Add class-level retry defaults via `static options = { retry: ... }`.
- Add per-schedule retry configuration to existing `schedule(...)` calls where appropriate.
- Wrap transient external calls with `this.retry()` and `shouldRetry` guards:
  - LLM calls
  - Embedding/vector retrieval calls
  - External network requests
- Ensure permanent failures do not retry indefinitely.

#### Verification

- Add retry-focused tests (new test file or extend existing server tests).
- `bunx turbo -F server typecheck`

#### Exit Criteria

- Scheduled and transient failure paths retry predictably.
- Retry exhaustion surfaces clear errors in logs and returns safe responses.

### PR 3: Chat Stream/Data-Part Contract for Rewrite Flow

#### Scope

Align rewrite chat behavior with latest ai-chat patterns (resumable-safe streaming + typed data parts).

#### Files

- `apps/server/src/agents/rewrite-agent.ts`
- `apps/web/src/lib/agents/hooks.ts`
- Any UI consumer that renders rewrite stream state

#### Tasks

- Keep `onChatMessage()` stream output compatible with resumable streaming semantics.
- Expand typed `data-*` events where useful (for routing metadata and transient UI hints).
- Add client-side handlers for transient data parts (when needed), not just message text.
- Ensure no duplicated UI state on refresh/reconnect.

#### Verification

- Add/extend tests for reconnect and partial stream updates.
- `bunx turbo -F web typecheck`
- `bunx turbo -F server typecheck`

#### Exit Criteria

- Rewrite stream state is stable across reconnects.
- Routing metadata is visible in UI without polluting persisted chat history.

### PR 4: Observability and Error Envelope Hardening

#### Scope

Standardize logs around retries, schedule executions, and workflow progress.

#### Files

- `apps/server/src/agents/organization-agent.ts`
- `apps/server/src/agents/surfacing-agent.ts`
- `apps/server/src/capture.ts`

#### Tasks

- Emit structured log fields on retry attempts and failures:
  - `agentName`, `workflowId` (when present), `routeKind`, `noteId`, attempt counters
- Keep client-visible errors stable while improving server diagnostic details.
- Ensure fallback code paths preserve current UX contracts.

#### Verification

- Manual verification in local logs while triggering retry/failure paths.
- `bunx turbo -F server typecheck`

#### Exit Criteria

- Failures are diagnosable from logs without adding noisy duplicate events.

### PR 5: Dependency and Peer Dependency Hygiene

#### Scope

Keep package-level compatibility explicit and reduce install-time surprises.

#### Files

- `apps/server/package.json`
- `apps/web/package.json`
- `docs/agents/workspaces.md` (if docs update is needed)

#### Tasks

- Confirm aligned versions for `agents`, `@cloudflare/ai-chat`, and `hono-agents`.
- Document peer dependency expectations for isolated installs (`@ai-sdk/react` concerns from ai-chat release updates).
- Keep runtime deps minimal in server-only contexts.

#### Verification

- `bun install`
- `bunx turbo -F server build`
- `bunx turbo -F web build`

#### Exit Criteria

- Dependency graph is predictable across workspace and isolated app installs.

### PR 6: Server Test Harness Expansion

#### Scope

Add focused tests for new behavior and make local execution easy.

#### Files

- `apps/server/package.json`
- `apps/server/src/ux-hardening.test.ts`
- New focused test files as needed (`apps/server/src/*-agent.test.ts`)

#### Tasks

- Add a `test` script to `apps/server/package.json` if missing.
- Extend test coverage for:
  - `/agents/*` routing matrix
  - Retry behavior for scheduled/background tasks
  - Chat stream edge cases where practical
- Keep the existing Bun mocking pattern for `agents` imports to avoid `cloudflare:email` runtime issues.

#### Verification

- `bun test apps/server/src`
- `bunx turbo -F server typecheck`

#### Exit Criteria

- Core agent platform behavior is regression-tested in CI-friendly form.

## Cross-Cutting Checklist

- Preserve current API contracts for capture/surfacing endpoints.
- Avoid introducing `experimental/forever` APIs into production paths.
- Update docs when behavior changes, especially routing assumptions.
- Keep edits scoped by PR slice to simplify review and rollback.

## Completion Definition

This plan is complete when all PR slices ship with passing typechecks/builds and the new routing + retry behavior is validated by tests and local end-to-end checks.
