## UX Overhaul Backlog (Discrete Task IDs)

This backlog maps directly to `docs/plans/UX-OVERHAUL-PLAN.md` and keeps the same execution order as the plan.
Locked decisions `D-01` through `D-16` are implementation defaults for these tasks.

### Task ID -> Workstream Map

| Workstream | Plan Section                                     | Task IDs                                   |
| ---------- | ------------------------------------------------ | ------------------------------------------ |
| 1          | Main Workspace IA and Layout (`/`)               | `UX-009` to `UX-016`                       |
| 2          | Sidebar as Source of Navigable Note State        | `UX-017` to `UX-024`                       |
| 3          | Canvas-First Editor Behavior                     | `UX-025` to `UX-032`                       |
| 4          | Route Execution and Capture Contract             | `UX-001` to `UX-008`, `UX-033` to `UX-044` |
| 5          | Background Organization Must Stay Ambient        | `UX-045` to `UX-050`                       |
| 6          | Secondary Surfaces (Collections, Digest, Search) | `UX-051` to `UX-060`                       |
| 7          | Uploads in the New Interaction Model             | `UX-061` to `UX-065`                       |
| 8          | History and Safety UX                            | `UX-066` to `UX-070`                       |
| 9          | Visual + Interaction System Alignment            | `UX-071` to `UX-076`                       |
| 10         | Minimal Hardening + Focused Tests                | `UX-081` to `UX-088`                       |
| Follow-up  | Additive (Non-Blocking for Overhaul DoD)         | `UX-077` to `UX-080`                       |

### 1) Main Workspace IA and Layout (`/`)

- [x] `UX-009` Replace `apps/web/src/routes/index.tsx` with a workspace shell route.
- [x] `UX-010` Add `apps/web/src/components/workspace/workspace-shell.tsx`.
- [x] `UX-011` Add `apps/web/src/components/sidebar/notes-sidebar.tsx`.
- [x] `UX-012` Add `apps/web/src/components/workspace/canvas-pane.tsx`.
- [x] `UX-013` Remove visible "Create note session" and "New note session" flows from home.
- [x] `UX-014` Remove prototype dashboard cards from primary workspace surface.
- [x] `UX-015` Keep command palette modal/keyboard-based (`Cmd+K`), not a permanent card.
- [x] `UX-016` Move Collections/Digest links into secondary nav affordances.

### 2) Sidebar as Navigable Source of Truth

- [x] `UX-017` Drive sidebar list from `useIndexAgent` state as primary source.
- [x] `UX-018` Hydrate fallback from `GET /api/notes` when index state is cold/empty.
- [x] `UX-019` Persist selected note in workspace query param (`?noteId=`) with validation.
- [x] `UX-020` Restore selection from URL on reload/reconnect/new tab.
- [x] `UX-021` Open selected sidebar note in canvas immediately without extra confirmation.
- [x] `UX-022` Enforce sidebar ordering by `updatedAt DESC` from IndexAgent state.
- [x] `UX-023` Keep sidebar fully functional after reconnect/refresh.
- [x] `UX-024` Add first-time/empty-state sidebar prompt copy.

### 3) Canvas-First Editor Behavior

- [x] `UX-025` Refactor `NoteEditor` to one visible note surface.
- [x] `UX-026` Remove split "Current note" + "Streaming output" default layout.
- [x] `UX-027` Keep one interaction affordance and one `Save` action (`Cmd+Enter`).
- [x] `UX-028` Ensure slash command text is never persisted in final note body, with editor-command precedence (`/heading`, `/code`, etc.) and agent commands (`/ask`, `/research`, `/link`, `/summarize`) plus freeform slash only when command is unknown to editor formatting.
- [x] `UX-029` Render streaming rewrite as in-place note morph on the same canvas.
- [x] `UX-030` Replace developer-state/conflict messaging with user-safe copy.
- [x] `UX-031` Keep conflict handling with clear apply/dismiss semantics.
- [x] `UX-032` Preserve wiki-link rendering and navigation on the note surface.

### 4) Route Execution and Capture Contract

#### Capture contract (`D-01` to `D-05`)

- [x] `UX-001` Add shared `RouteExecutionOutcome` type (web/server): `kind`, `uiAction`, `noteId?`, `toast?`, `ephemeral?`, `secondaryEffects[]`.
- [x] `UX-002` Add a single public capture endpoint (`POST /api/capture`) that performs classify + execute + normalized outcome.
- [x] `UX-003` Keep `POST /api/notes/route` compatibility-only (internal) during migration, then remove after cutover.
- [x] `UX-004` Update home submit flow to call capture endpoint before note creation.
- [x] `UX-005` Ensure non-note outcomes never create note records.
- [x] `UX-006` Add deterministic outcome->UI mapper using the canonical route->UI behavior table (navigate, reset canvas, ephemeral answer, toast).
- [x] `UX-007` Standardize capture error envelope: `error.code`, `error.message`, `recoverable`.
- [x] `UX-008` Emit audit/telemetry event for every route decision and execution outcome (`eventId`, `userId`, `routeKind`, `uiAction`, `noteId?`, `secondaryEffects[]`, `success`, `errorCode?`, `timestamp`).

#### Route execution completeness (`D-06` to `D-11`)

- [x] `UX-033` Implement execution handler for `new_note`.
- [x] `UX-034` Implement execution handler for `update_existing`.
- [x] `UX-035` Implement execution handler for `correction`, including confidence gating (high execute, medium execute + explicit toast/link context, low fallback to `new_note`).
- [x] `UX-036` Implement execution handler for `split`, including deterministic primary note selection (router relevance -> most recently touched -> first created).
- [x] `UX-037` Implement execution handler for `fan_out` with accepted-then-background behavior and `secondaryEffects: [{ type: "queued_fanout" }]`, plus deterministic primary note selection.
- [x] `UX-038` Wire `fan_out` execution to `apps/server/src/agents/workflows/fanout-workflow.ts`.
- [x] `UX-039` Implement execution handler for `workspace_action` with v1 allowlist-only enforcement (`archive_note(s)`, `mark_collection_resolved`, `rename_collection`, `link_notes`, `unlink_notes`).
- [x] `UX-040` Implement execution handler for `ephemeral_answer` with lifecycle: dismiss on next input or `8000ms` idle timeout.
- [x] `UX-041` Implement execution handler for `store_preference`.
- [x] `UX-042` Implement execution handler for `duplicate`, including confidence gating (high execute, medium execute + explicit toast/link context, low fallback to `new_note`).
- [x] `UX-043` Return explicit UI intent metadata for each route outcome.
- [x] `UX-044` Ensure non-note outcomes return canvas to blank-ready state.

### 5) Background Organization Must Stay Ambient

- [x] `UX-045` Keep rewrite->organize trigger in `RewriteAgent`.
- [x] `UX-046` Keep scheduled heartbeat in `OrganizationAgent`.
- [x] `UX-047` Remove/hide manual "organize now" controls from core capture flow.
- [x] `UX-048` Add idempotent persistence/upserts for org outputs to avoid duplicate rows.
- [x] `UX-049` Keep status signals subtle/peripheral in workspace chrome.
- [x] `UX-050` Preserve IndexAgent broadcast updates for collections/action-items/contradictions.

### 6) Secondary Surfaces (Collections, Digest, Search)

#### Collections and digest positioning

- [x] `UX-051` Keep `apps/web/src/routes/collections.tsx` as optional review surface.
- [x] `UX-052` Keep `apps/web/src/routes/digest.tsx` as optional review surface.
- [x] `UX-053` Reduce home CTA prominence for Collections/Digest/Search.
- [x] `UX-054` Keep search available but secondary to canvas-first capture.
- [x] `UX-055` Add command-palette entries for quick access to secondary surfaces.

#### Search positioning and retrieval quality (`D-16`)

- [x] `UX-056` Use typed route search validation for search query state.
- [x] `UX-057` Standardize search-state updates through router navigation helpers.
- [x] `UX-058` Wire embedding upserts into rewrite/organization pipelines.
- [x] `UX-059` Preserve keyword fallback path for reliability.
- [x] `UX-060` Preserve citations + related collections in query responses.

### 7) Uploads in the New Interaction Model

- [x] `UX-061` Integrate `UploadPanel` as contextual secondary UI in workspace/canvas.
- [x] `UX-062` Keep uploads available but non-dominant in primary writing flow.
- [x] `UX-063` Preserve upload->active-note linkage via `noteId` when present.
- [x] `UX-064` Show lightweight upload success/error feedback without stealing focus.
- [x] `UX-065` Keep backend upload route contract unchanged unless response shaping is required.

### 8) History and Safety UX

- [x] `UX-066` Add per-note History route/view as secondary surface.
- [x] `UX-067` Persist version snapshots required for revert.
- [x] `UX-068` Render timeline entries: prompt, route/action summary, timestamp.
- [x] `UX-069` Add revert-to-version action with safe confirmation + audit event.
- [x] `UX-070` Keep primary note surface transcript-free.

### 9) Visual + Interaction System Alignment

- [x] `UX-071` Update `apps/web/src/index.css` tokens toward the stone palette system.
- [x] `UX-072` Align typography: Libre Baskerville (content), Geist Mono (UI/chrome/input).
- [x] `UX-073` Remove forced dark-only root mode and support intentional light/dark parity.
- [x] `UX-074` Reduce border/card noise in home workspace hierarchy.
- [x] `UX-075` Ensure keyboard reliability for `N`, `Cmd+K`, `Cmd+Enter`.
- [x] `UX-076` Ensure mobile preserves blank-canvas-first mental model.

### 10) Minimal Hardening + Focused Tests

- [x] `UX-081` Add rate limiting middleware for capture/query/upload endpoints.
- [x] `UX-082` Add `audit_logs` schema + persistence for routing/rewrite mutations.
- [x] `UX-083` Add server tests for route execution outcomes across all route kinds.
- [ ] `UX-084` Add web tests for note-as-result behavior (no transcript artifacts in final note body).
- [ ] `UX-085` Add tests for sidebar reactivity ordering + reconnect behavior.
- [x] `UX-086` Add tests for background organization trigger path.
- [ ] `UX-087` Add keyboard interaction tests (`N`, `Cmd+K`, `Cmd+Enter`).
- [ ] `UX-088` Add mobile workspace smoke tests for blank-canvas-first behavior.

### Additive Follow-Ups (Non-Blocking for Overhaul DoD)

- [x] `UX-077` Standardize home/editor/sidebar/search/upload on Kumo primitives and shared local wrappers.
- [x] `UX-078` Replace raw controls where they break token/accessibility consistency in Kumo-based surfaces.
- [x] `UX-079` Enforce semantic token usage (`text-kumo-*`, `bg-kumo-*`, `border-kumo-*`) in workspace components.
- [x] `UX-080` Ensure icon-only controls have `aria-label` and size consistency.
