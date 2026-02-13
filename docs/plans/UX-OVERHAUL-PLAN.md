# UX Overhaul Plan: Blank Canvas + Ambient Agents

> **Status:** Active
> **Owner:** Product + Web + Server

---

## Purpose

Define the implementation plan to move Gneiss from the current prototype UX to the intended product UX:

- blank note canvas as the primary and default surface
- sidebar showing notes in their rewritten state
- no manual "organize now" workflow in the primary flow
- all agent orchestration running in the background

This plan is focused on UX and product-loop correctness first. Optional OpenClaw expansion and broad hardening remain separate tracks.

---

## Target UX (End State)

The app should feel like:

1. Open app -> see a calm workspace with sidebar + blank canvas.
2. Type thought -> press `Save` (or `Cmd+Enter`).
3. Agent routes and rewrites in-place with streaming.
4. Result appears as a clean note, not a chat transcript.
5. Sidebar updates automatically with rewritten notes.
6. Background organization updates collections/digest without explicit user actions.
7. Advanced views (History, Collections, Digest, Search) are available but secondary.

---

## Non-Goals For This Overhaul

- Building full OpenClaw integration.
- Completing every hardening item in Phase 6.
- Introducing team collaboration.
- Replacing existing auth stack.

---

## Workstreams

## 1) Main Workspace IA and Layout

### Goals

- Make `/` a single workspace shell.
- Keep primary focus on note creation/editing.
- Remove prototype-only sections and duplicated panes.

### Changes

- Replace `apps/web/src/routes/index.tsx` with a workspace shell:
  - left sidebar: rewritten notes list (IndexAgent-driven)
  - right panel: blank canvas or selected note canvas
- Remove visible "Create note session" block.
- Remove side-by-side "Current note" + "Streaming output" split from default layout.
- Keep command palette available via keyboard/modal, not as a permanent card.
- Move Collections and Digest links into secondary nav affordances.

### Acceptance Criteria

- `/` loads directly into sidebar + canvas.
- First-time state shows only blank canvas prompt and `Save` interaction.
- No manual setup step required before writing.

---

## 2) Sidebar as Source of Navigable Note State

### Goals

- Sidebar always reflects rewritten notes.
- Selection and navigation are predictable.
- Works across tabs through IndexAgent updates.

### Changes

- Build note list component fed by `useIndexAgent`.
- Hydrate initial note list from `GET /api/notes` fallback when needed.
- Keep selected note id in route state/search params.
- Clicking a note opens it in the canvas immediately.
- Show update ordering by `updatedAt` from IndexAgent state.

### Acceptance Criteria

- New rewrite promotes note to top of sidebar in real time.
- Selecting any sidebar note opens correct content without extra actions.
- Sidebar remains functional after reconnect/reload.

---

## 3) Canvas-First Editor Behavior

### Goals

- Preserve note-as-result model.
- Keep user-facing surface document-like.
- Keep slash commands ephemeral on the canvas.

### Changes

- Refactor `apps/web/src/components/editor/NoteEditor.tsx` into a single-canvas interaction model:
  - one visible note surface
  - one interaction input affordance
  - one `Save` action
- Keep slash parsing behavior, but ensure slash text never remains in document body after submit.
- Keep streaming rewrite visible as note morphing in the same canvas.
- Keep conflict handling, but simplify UI copy and avoid "developer-state" messaging.

### Acceptance Criteria

- User never sees prompt/response transcript in the note body.
- Slash commands disappear from final rendered note surface.
- Streaming updates modify the same note view (not a separate debug pane).

---

## 4) Route Execution: From Classification to Real Outcomes

### Goals

- Make Router decisions operational, not informational.
- Ensure all route kinds produce intended UX outcomes.

### Changes

- Upgrade server orchestration in `apps/server/src/index.ts` and/or new capture endpoint to:
  - classify
  - execute
  - return normalized client outcome payload
- Implement execution handlers for:
  - `new_note`
  - `update_existing`
  - `correction`
  - `split`
  - `fan_out`
  - `workspace_action`
  - `ephemeral_answer`
  - `store_preference`
  - `duplicate`
- Wire `fan_out` to workflow path (`apps/server/src/agents/workflows/fanout-workflow.ts`) instead of no-op classification.
- Return route result metadata needed for UI transitions/toasts.

### Acceptance Criteria

- Route kinds trigger distinct behavior end-to-end.
- Non-note routes return canvas to blank state automatically.
- Duplicate/preference/action routes avoid polluting note list.

---

## 5) Background Organization Should Stay Background

### Goals

- Remove primary-flow dependence on explicit organization actions.
- Keep heartbeat and post-rewrite organization fully ambient.

### Changes

- Keep rewrite -> organize trigger in backend (`apps/server/src/agents/rewrite-agent.ts`).
- Keep scheduled heartbeat (`apps/server/src/agents/organization-agent.ts`).
- Remove or hide any UI controls that imply "run organization now" for normal flow.
- Keep status signals subtle and peripheral.

### Acceptance Criteria

- Standard capture flow never requires user to trigger organization.
- Collections and digest continue to update based on background processing.

---

## 6) Collections and Digest as Secondary Review Surfaces

### Goals

- Keep both features but demote them from core capture flow.
- Reframe as review surfaces, not required operational steps.

### Changes

- Keep `apps/web/src/routes/collections.tsx` and `apps/web/src/routes/digest.tsx`.
- Reduce CTA prominence on home workspace.
- Add clear copy that these are optional review layers.
- Keep collection lifecycle controls but avoid making them central to daily capture.

### Acceptance Criteria

- User can run full capture/rewrite loop without ever visiting these routes.
- Collections and digest remain accessible and useful when explicitly opened.

---

## 7) Hybrid Search Positioning and Quality Fixes

### Goals

- Keep search available for targeted retrieval.
- Ensure hybrid retrieval is truly hybrid in practice.

### Changes

- Keep search UI secondary to canvas.
- Wire embedding upserts during rewrite/organization flows using `apps/server/src/agents/vectorize.ts`.
- Keep keyword fallback path for reliability.
- Preserve citations + related collections in response payloads.

### Acceptance Criteria

- Search results continue to work without vectors.
- With vectors enabled, semantic matches appear for non-keyword queries.

---

## 8) Uploads in the New Interaction Model

### Goals

- Keep upload capability without cluttering main workspace.
- Treat uploads as part of capture context, not a separate workflow card.

### Changes

- Integrate `apps/web/src/components/uploads/UploadPanel.tsx` as contextual/secondary UI.
- Support attaching upload during active note context.
- Keep backend route unchanged unless response shaping is needed (`POST /api/uploads`).

### Acceptance Criteria

- Upload remains available but does not dominate the primary canvas.
- Upload metadata still links to active note id where present.

---

## 9) History View and Safety UX

### Goals

- Deliver trust and auditability for agent rewrites.
- Keep History secondary, not default.

### Changes

- Add History view per note in web app (raw prompts/actions timeline).
- Persist enough server-side detail to support history rendering and future revert controls.
- Add lightweight version snapshot model for note revert if not already present.

### Acceptance Criteria

- User can inspect what changed and why for each rewrite interaction.
- Default note surface remains clean and transcript-free.

---

## 10) Visual and Interaction System Alignment

### Goals

- Align implementation with design spec direction (serene, minimal, canvas-first).
- Remove prototype/debug visual noise.

### Changes

- Update typography/color tokens toward planned system (`apps/web/src/index.css`).
- Simplify borders/cards where they overwhelm content hierarchy.
- Ensure keyboard-first workflow (`N`, `Cmd+K`, `Cmd+Enter`) is reliable.
- Ensure mobile layout preserves blank-canvas-first behavior.

### Acceptance Criteria

- Main workspace reads as a writing environment, not a dashboard.
- Desktop and mobile both center the same mental model.

---

## 11) Minimal Hardening Required For UX Launch

### Goals

- Add only safeguards needed for the overhauled core loop.

### Changes

- Add basic rate limiting on capture/query/upload endpoints.
- Add basic audit events for routing and rewrite mutations.
- Add focused tests for:
  - route execution outcomes
  - note-as-result behavior
  - sidebar reactivity
  - background organization trigger path

### Acceptance Criteria

- Core UX loop is protected against abuse spikes.
- Critical state transitions are auditable.
- Regressions in routing/canvas/sidebar are test-covered.

---

## Execution Order

1. Workspace IA and layout replacement (`/`).
2. Sidebar reactivity and note selection reliability.
3. Canvas-only editor interaction refactor.
4. Backend route execution for all route kinds.
5. Background behavior cleanup and de-emphasis of manual controls.
6. Secondary surfaces (Collections, Digest, Search) repositioning.
7. Upload UX integration.
8. History/safety view.
9. Visual pass and interaction polish.
10. Minimal hardening + focused tests.

---

## Definition of Done

The UX overhaul is complete when:

- The user can capture from a blank canvas without setup friction.
- The note surface always reflects rewritten output, not transcript artifacts.
- Sidebar shows rewritten notes and updates reactively.
- Routing outcomes execute correctly, including non-note outcomes.
- Organization remains background-only from a normal user perspective.
- Collections/Digest/Search are optional secondary surfaces.
- Core loop has minimal hardening and regression tests.

---

## File Touch Map (Expected)

Primary expected files:

- `apps/web/src/routes/index.tsx`
- `apps/web/src/components/editor/NoteEditor.tsx`
- `apps/web/src/components/command-palette/CommandPalette.tsx`
- `apps/web/src/components/uploads/UploadPanel.tsx`
- `apps/web/src/lib/agents/hooks.ts`
- `apps/server/src/index.ts`
- `apps/server/src/agents/router-agent.ts`
- `apps/server/src/agents/rewrite-agent.ts`
- `apps/server/src/agents/workflows/fanout-workflow.ts`
- `apps/server/src/agents/shared/persistence.ts`
- `apps/server/src/agents/vectorize.ts`
- `apps/web/src/index.css`

Potential new files:

- `apps/web/src/components/workspace/*`
- `apps/web/src/components/sidebar/*`
- `apps/web/src/routes/notes/$noteId.tsx` (if route split is introduced)
- `apps/server/src/middleware/rate-limit.ts` (minimal version)
- `packages/db/src/schema/audit-logs.ts` (minimal version)

---

_Last updated: February 2026_
