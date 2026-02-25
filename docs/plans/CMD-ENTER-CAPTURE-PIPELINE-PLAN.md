# Cmd+Enter Capture Pipeline + Workflow Trigger Coverage Plan

> **Status:** Draft
> **Owner:** Web + Server
> **Scope:** `apps/web`, `apps/server`

---

## Problem Summary

Current behavior diverges from product intent:

1. **Cmd/Ctrl+Enter does not always run capture routing**
   - In `note-editor.tsx`, explicit submit falls back to save-only (`PUT /api/notes/:noteId`) when no slash command lines exist.
   - This bypasses `POST /api/capture` and the Router/Capture pipeline.

2. **Organization refresh is not reliably triggered after note mutation**
   - `PUT /api/notes/:noteId` updates note and index, but does not trigger `run_organize`.
   - Mutations do not consistently reset `processed_at`.

3. **Not all backend workflows have clear frontend trigger surfaces**
   - `FANOUT_WORKFLOW` exists in infra but capture currently uses `queueFanOutInBackground(...)` directly.
   - `CONTRADICTION_WORKFLOW` exists in infra, but no frontend route/surface currently triggers it.

---

## Goals

1. **Cmd/Ctrl+Enter and explicit Run always route through capture pipeline** (`POST /api/capture`).
2. **Manual edits and capture mutations reliably re-enter organization processing**.
3. **Add a Run button in note view** (top-right, left of triple-dot menu).
4. **Ensure every created backend agent/workflow/pipeline has at least one frontend trigger path**.

## Non-goals

- No redesign of note layout beyond adding Run action in note header controls.
- No replacement of current capture route taxonomy.
- No removal of heartbeat safety net.

---

## Target Behavioral Invariants

1. **Explicit Run invariant**
   - Explicit run actions (`Cmd/Ctrl+Enter`, Run button, command-palette run) always call `onCapture(...)`.
   - Save-only remains background/autosave behavior.

2. **Organization freshness invariant**
   - Any note content mutation sets `processed_at = NULL`.
   - Any explicit mutation path best-effort triggers `run_organize` for touched note IDs.

3. **Trigger coverage invariant**
   - Every bound backend workflow/agent has a user-facing entry point (direct or via capture route outcome).

---

## Implementation Plan

## Task 1 — Add explicit Run button in note header controls

**Files**

- `apps/web/src/components/note-editor.tsx`

**Changes**

- Add `Run` button to top-right controls.
- Positioning: `Run` immediately left of existing triple-dot dropdown.
- Disable while `isCapturing`.
- Hook click to same explicit run handler used by Cmd/Ctrl+Enter.

**Acceptance**

- Run button is visible in note content view.
- Control order is `[Run] [⋯]`.

---

## Task 2 — Make explicit run always call capture pipeline

**Files**

- `apps/web/src/components/note-editor.tsx`

**Changes**

- Refactor `runCommandIntent("explicit")`:
  - Current behavior: save-only when no slash command lines.
  - Target behavior: explicit run always calls `onCapture({ noteId, userInput })`.
- Keep editor formatting commands (`/heading`, `/code`, `/quote`, `/bullets`) local.
- For explicit run with no slash commands: send note content as `userInput` to capture pipeline.
- Keep defensive fallback: if capture fails, do `flushSave({ silent: false })`.

**Acceptance**

- Cmd/Ctrl+Enter invokes `POST /api/capture` regardless of slash-command presence.
- Run button uses same path.

---

## Task 3 — Keep autosave semantics, separate from explicit run

**Files**

- `apps/web/src/components/note-editor.tsx`

**Changes**

- Preserve autosave timer behavior (`PUT /api/notes/:noteId`).
- Preserve blur/unmount save fallback.
- Do not convert passive autosave into capture requests.

**Acceptance**

- Background autosave remains lightweight and non-intrusive.
- Explicit run and autosave are clearly separated.

---

## Task 4 — Reset `processed_at` on note updates and trigger organize

**Files**

- `apps/server/src/index.ts`

**Changes**

- In `PUT /api/notes/:noteId`:
  - include `processed_at = NULL` in update SQL.
  - trigger OrganizationAgent `action: "run_organize"` for `[noteId]` (best-effort, non-blocking response path).
- In note revert route (`POST /api/notes/:noteId/revert`):
  - include `processed_at = NULL`.
  - trigger `run_organize` for `[noteId]`.

**Acceptance**

- Any manual edit/revert re-enters organization pipeline promptly.

---

## Task 5 — Reset `processed_at` and trigger organize from capture mutations

**Files**

- `apps/server/src/capture.ts`

**Changes**

- Ensure update mutation paths set `processed_at = NULL` (e.g. `updateNote(...)`).
- After successful mutating outcomes (`new_note`, `update_existing`, `correction`, `split`, `fan_out` primary), collect touched note IDs and trigger organize.
- Keep non-mutating outcomes (`ephemeral_answer`, `duplicate`, `store_preference`, workspace actions that do not mutate note content) as no-op for organize trigger.

**Acceptance**

- Capture-generated content changes consistently re-trigger organization.

---

## Task 6 — Create shared organization refresh helper

**Files**

- `apps/server/src/organization-refresh.ts` (new)
- call sites in `apps/server/src/index.ts`, `apps/server/src/capture.ts`

**Changes**

- Add helper to:
  - normalize + dedupe note IDs,
  - short-circuit empty calls,
  - invoke OrganizationAgent `run_organize` with consistent logging/error handling.

**Acceptance**

- No duplicated organize-trigger boilerplate across routes.

---

## Task 7 — Expose manual organize trigger in frontend

**Files**

- `apps/server/src/index.ts`
- `apps/web/src/components/command-palette.tsx`
- `apps/web/src/components/workspace/canvas-pane.tsx`
- `apps/web/src/components/workspace/workspace-shell.tsx`

**Changes**

- Extend API action surface to support manual organization refresh from UI.
  - Option A: extend `/api/collections/lifecycle` with `action: "run_organize"` and optional `noteIds`.
  - Option B: add dedicated route `/api/workflows/organize/run`.
- Add frontend action: **Run organization now**.

**Acceptance**

- User can trigger organize pass without waiting for heartbeat.

---

## Task 8 — Connect fan-out workflow to an explicit trigger surface

**Files**

- `apps/server/src/capture.ts`
- `apps/server/src/agents/organization-agent.ts` or new workflow route in `apps/server/src/index.ts`
- `apps/web/src/components/command-palette.tsx`

**Changes**

- Replace/augment direct `queueFanOutInBackground(...)` path with explicit `FANOUT_WORKFLOW` trigger path (`runWorkflow("FANOUT_WORKFLOW", ...)`).
- Add frontend action for running fan-out from current note context.

**Acceptance**

- `FANOUT_WORKFLOW` is actually exercised via user-accessible frontend path.

---

## Task 9 — Add contradiction review + trigger surfaces

**Files**

- `apps/server/src/index.ts`
- `apps/web/src/routes/contradictions.tsx` (new)
- `apps/web/src/components/command-palette.tsx`
- `apps/web/src/components/workspace/workspace-shell.tsx`

**Changes**

- Add backend endpoints to:
  - list open contradictions,
  - start contradiction analysis workflow,
  - resolve contradiction (approval path).
- Add frontend review page + actions.
- Add navigation entry under Review and command palette.

**Acceptance**

- `CONTRADICTION_WORKFLOW` has clear user-triggerable path and completion flow.

---

## Task 10 — Add/adjust tests for behavior lock

**Files**

- `apps/web/src/components/note-editor.test.tsx`
- `apps/server/src/ux-hardening.test.ts` (or split into focused files)

**Tests**

- Web:
  - Cmd/Ctrl+Enter on regular content calls capture.
  - Run button calls capture.
- Server:
  - PUT/revert reset `processed_at` and trigger organize.
  - Capture mutating routes trigger organize.
  - Fan-out path hits workflow trigger.
  - Contradiction analyze/resolve route behavior.

**Acceptance**

- Regressions are caught automatically.

---

## Backend Trigger Coverage Matrix (Target State)

| Backend unit          | Trigger path on frontend                                | Expected backend entry                                  |
| --------------------- | ------------------------------------------------------- | ------------------------------------------------------- |
| RouterAgent           | Cmd/Ctrl+Enter, Run button, command palette run actions | `POST /api/capture`                                     |
| Capture pipeline      | Same as above                                           | `executeCapture(...)`                                   |
| IndexAgent            | Note CRUD + capture/organize side effects               | internal index upsert/remove calls                      |
| OrganizationAgent     | Auto from mutations + manual “Run organization now”     | `action: "run_organize"`                                |
| OrganizeWorkflow      | OrganizationAgent                                       | `runWorkflow("ORGANIZE_WORKFLOW", ...)`                 |
| FanOutWorkflow        | Capture fan-out outcome + manual fan-out action         | `runWorkflow("FANOUT_WORKFLOW", ...)`                   |
| ContradictionWorkflow | Contradictions review UI actions                        | `runWorkflow("CONTRADICTION_WORKFLOW", ...)` + approval |
| SurfacingAgent query  | Search surfaces                                         | `POST /api/surfacing/query`                             |
| SurfacingAgent digest | Digest page + Review controls                           | `POST /api/surfacing/digest`                            |

---

## Suggested PR Sequence

### PR 1 (Highest priority)

- Tasks 1–6
- Outcome: explicit Run always uses capture; organization refresh reliability fixed.

### PR 2

- Task 7 + Task 8
- Outcome: manual organize/fan-out workflow trigger coverage.

### PR 3

- Task 9 + remaining Task 10 coverage
- Outcome: contradiction workflow fully triggerable and reviewable from frontend.

---

## Verification Checklist

- [ ] Cmd/Ctrl+Enter always calls capture.
- [ ] Run button present and functional in note top-right nav (left of triple-dot).
- [ ] Mutating note paths set `processed_at = NULL`.
- [ ] Mutating note paths trigger organize best-effort.
- [ ] Organize workflow manually triggerable.
- [ ] Fan-out workflow triggerable from frontend path.
- [ ] Contradiction workflow triggerable + resolvable from frontend path.
- [ ] Tests updated and passing.

---

## Repo checks (after implementation)

From repo root:

- `bun test apps/web/src/components/note-editor.test.tsx`
- `bun test apps/server/src/ux-hardening.test.ts`
- `bun run check`
- `bun run typecheck`
- `bun run build`
