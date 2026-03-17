# Slash Command Alignment Plan

> **Status:** Implemented  
> **Scope:** `apps/web`, `apps/server`, `packages/api`, `packages/editor-pm`  
> **Goal:** Align slash command behavior with the product vision: pending in-note slash prompts stay visible as local editor affordances until `Run`, then disappear and the note becomes the rewritten result.

---

## 1) Product Decisions Locked For This Plan

These are the implementation choices this plan assumes.

1. Slash commands in an existing note are explicit note-refinement instructions, not chat messages.
2. A slash command typed on its own line renders as a pending command box in the editor.
3. The raw slash text remains editable inside that box and disappears only when the user executes `Run`.
4. Deleting the slash text removes the pending box immediately.
5. Pending slash commands are local editing-state affordances and must not persist into durable note content.
6. `Run` is the only action that executes pending slash commands in notes; closing/unmounting the editor must not auto-run them.
7. In-note `/ask` rewrites the note. Ephemeral answers remain available only for blank-page/direct question flows.
8. v1 allows multiple pending editor-format commands, but only one pending agent/freeform command per run.

---

## 2) Current Gaps To Close

1. In-note `/ask` currently routes to `ephemeral_answer` instead of rewriting the note.
2. Slash commands are parsed only loosely and are not first-class request data shared between client and server.
3. Known agent commands (`/ask`, `/research`, `/link`, `/summarize`) do not yet have explicit command-aware execution paths.
4. The editor has no dedicated visual treatment for pending slash commands.
5. Pending slash commands can auto-run on editor unmount, which breaks the intended explicit `Run` model.
6. History stores prompt text, but not enough slash-specific metadata to explain what happened.
7. The active note flow still uses the generic capture pipeline instead of the intended fresh-per-interaction `RewriteAgent` path.

---

## 3) Target UX Model

### 3.1 In-note slash command lifecycle

1. User types a slash command on its own line, for example `/ask What changed since last week?`.
2. That line is visually transformed into a pending command box:
   - soft highlighted container
   - slash text stays visible but muted
   - command type label (Ask, Research, Summarize, Link, Custom)
   - focused styling when cursor is inside the line
3. User can continue editing the note around it.
4. User can delete characters from the slash text; once the line no longer matches slash-command syntax, the box disappears.
5. User presses `Run`.
6. The pending slash box disappears from the visible note content immediately.
7. The note streams into the rewritten result.
8. History records the slash command and the resulting rewrite.

### 3.2 Persistence model

- Persisted note content never includes pending slash-command lines.
- Pending slash boxes are derived from the current local editor document.
- Stored history preserves the raw slash command prompt and the resulting note version.

### 3.3 Behavioral rules

- Known editor-format commands stay local-only.
- Known agent/freeform commands become explicit note refinement requests.
- Blank-page question flows may still resolve to ephemeral answers when no note rewrite is intended.
- A note run with both editor-format and agent commands executes in this order:
  1. apply editor-format transforms locally
  2. remove pending slash lines from the visible note
  3. execute one agent/freeform command against the cleaned note

---

## 4) Implementation Plan (Phased)

## Phase A - Shared Slash Command Contract

### A.1 Create shared slash-command parser/types

**Files**

- `packages/api/src/slash-commands.ts` (new)
- `packages/api/src/capture-contract.ts`

**Changes**

- Add a shared slash-command model used by both client and server.
- Export:
  - slash-line regex/predicate
  - `SlashCommandIntent`
  - `SlashCommandKind` (`editor`, `agent`, `freeform`)
  - `parseSlashCommandLine()`
  - `extractSlashCommandLines()`
  - `stripSlashCommandLines()`
- Distinguish known commands:
  - editor: `heading`, `code`, `quote`, `bullets`
  - agent: `ask`, `research`, `link`, `summarize`
  - freeform: unknown `/...`

**Acceptance**

- Client and server use the same slash-command classification rules.
- Unknown slash commands are treated as freeform instructions.
- Non-slash lines and inline `/foo` text are ignored.

**Tests**

- Add parser unit tests in `packages/api/src/slash-commands.test.ts`.
- Cover known editor commands, known agent commands, unknown slash commands, malformed input, and own-line-only behavior.

---

### A.2 Extend capture request contract for explicit slash intent

**Files**

- `packages/api/src/capture-contract.ts`
- web/server request typing sites that import capture types

**Changes**

- Extend capture input contract with explicit metadata for note runs, for example:
  - `invocationSource: "note_run" | "blank_capture" | "palette_run"`
  - `pendingCommands?: SlashCommandIntent[]`
  - `runMode?: "content_only" | "slash_only" | "content_and_slash"`
- Keep backward compatibility for existing callers during migration.

**Acceptance**

- Server can tell whether a request came from a note run versus a blank-page capture.
- Server can distinguish freeform content capture from explicit slash-command refinement.

**Tests**

- Add/expand contract typing tests where applicable.

---

## Phase B - Editor Pending Slash Box UI

### B.1 Add slash-command decoration extension

**Files**

- `packages/editor-pm/src/extensions/slash-command-box.ts` (new)
- `packages/editor-pm/src/extensions/bundle.ts`
- `packages/editor-pm/src/extensions/index.ts`

**Changes**

- Add a ProseMirror decoration extension that detects slash-command lines in text blocks.
- Decorate matching lines with a node/class treatment such as:
  - `pm-slash-command-box`
  - `data-command-kind`
  - `data-command-name`
- Optionally add a widget/label chip at the start of the line.
- Keep the underlying text editable and unchanged.
- Restrict decoration to own-line slash commands only.

**Acceptance**

- Typing `/ask hello` on its own line immediately shows a pending command box.
- Editing the text updates the decoration live.
- Deleting or invalidating the slash syntax removes the box.
- Normal paragraphs are unaffected.

**Tests**

- Add extension tests in `packages/editor-pm/src/integration.test.ts` or a dedicated `slash-command-box.test.ts`.
- Cover add/update/remove decoration behavior.

---

### B.2 Expose command metadata to the web editor wrapper

**Files**

- `apps/web/src/components/pm-markdown-editor.tsx`

**Changes**

- Ensure the editor bundle includes the new slash-command extension.
- Keep existing markdown typing behavior intact.
- If needed, expose lightweight callbacks for pending-command count/validation state from the wrapper to `NoteEditor`.

**Acceptance**

- Existing editor features continue to work.
- Slash box decorations render in the web editor without breaking serialization.

**Tests**

- Add web-level editor tests in `apps/web/src/components/pm-markdown-editor.test.tsx` for rendering and removal of pending slash boxes.

---

### B.3 Add slash box styling

**Files**

- `apps/web/src/index.css`

**Changes**

- Add styles for:
  - pending slash box container
  - muted slash text
  - focused state
  - command-type variants (`agent`, `editor`, `freeform`)
  - invalid/multiple-agent-command warning state if we expose one
- Keep styling consistent with the existing editor look and avoid chat-bubble aesthetics.

**Acceptance**

- Slash boxes are visually distinct but still feel like note editing, not chat.
- Focused and unfocused states are clear on desktop and mobile widths.

---

## Phase C - Note Run Behavior In The Web App

### C.1 Centralize note-run slash orchestration

**Files**

- `apps/web/src/components/note-editor.tsx`

**Changes**

- Replace local slash parsing helpers with shared parser utilities from `packages/api`.
- On `Run`:
  - collect pending slash commands in document order
  - apply local editor-format commands first
  - strip all pending slash lines from visible content
  - validate agent/freeform command count
  - send structured slash intent metadata with the capture request
- Keep note content synchronized so the pending box disappears before streamed rewrite content arrives.

**Acceptance**

- `Run` executes explicit note refinement behavior, not generic slash text submission.
- Pending slash boxes disappear at run start.
- Editor-format commands still work without a server roundtrip.

**Tests**

- Expand `apps/web/src/components/note-editor.test.tsx` to cover:
  - mixed editor + agent commands
  - stripping pending slash lines before capture
  - only one agent/freeform command allowed in v1

---

### C.2 Remove auto-run on unmount

**Files**

- `apps/web/src/components/note-editor.tsx`

**Changes**

- Remove the unmount behavior that currently runs pending slash commands on close.
- On unmount, only perform a normal silent save of durable content.
- Pending slash lines stay local and are discarded if the user navigates away before `Run`.

**Acceptance**

- Pending slash commands never execute unless the user explicitly presses `Run` or `Mod+Enter`.
- Closing the editor cannot unexpectedly trigger note mutation.

**Tests**

- Add regression test ensuring unmount does not call `onCapture` for pending slash commands.

---

### C.3 Adjust command palette behavior

**Files**

- `apps/web/src/components/command-palette.tsx`
- `apps/web/src/components/workspace/workspace-shell.tsx`

**Changes**

- Change note-scoped slash actions from "execute immediately" to "insert pending slash command into active note".
- Keep history/digest/collection navigation items as-is.
- If no note is selected, decide per action:
  - create/open blank note and insert command, or
  - show toast warning for note-scoped commands
- Recommended default: if no note is selected, create/open a blank note and insert the pending slash command.

**Acceptance**

- Choosing `Run summarize on active note` inserts `/summarize` into the note as a pending slash box.
- Palette does not bypass the explicit `Run` mental model.

**Tests**

- Add workspace-shell tests for palette insertion behavior.

---

## Phase D - Server-Side Slash Command Execution

### D.1 Add explicit slash-command execution layer

**Files**

- `apps/server/src/slash-commands.ts` (new)
- `apps/server/src/capture.ts`

**Changes**

- Add a server execution layer that receives structured slash intents.
- Define explicit handlers for:
  - `/ask`
  - `/research`
  - `/link`
  - `/summarize`
  - freeform `/...`
- For note-scoped slash commands, bypass heuristic routing and force note mutation.
- Reserve `ephemeral_answer` for blank-page/direct-question flows only.

**Acceptance**

- In-note `/ask` no longer returns `show_ephemeral`.
- Known note-scoped slash commands always target note rewrite behavior.
- Blank-page question behavior remains available where intended.

**Tests**

- Expand `apps/server/src/ux-hardening.test.ts` for:
  - in-note `/ask` -> `update_existing`
  - blank-page `/ask` -> `ephemeral_answer`
  - note-scoped `/summarize`, `/link`, `/research`, freeform `/...`

---

### D.2 Add command-aware rewrite prompt builders

**Files**

- `apps/server/src/agents/shared/prompt.ts`
- optionally split into:
  - `apps/server/src/agents/shared/prompts/ask.ts`
  - `apps/server/src/agents/shared/prompts/research.ts`
  - `apps/server/src/agents/shared/prompts/link.ts`
  - `apps/server/src/agents/shared/prompts/summarize.ts`

**Changes**

- Replace the single generic rewrite prompt with command-aware prompt builders.
- Each builder should specify:
  - note mutation goal
  - expected integration behavior (fold into existing structure, do not append chat response)
  - citation/wiki-link behavior
  - whether external research is allowed/required

**Acceptance**

- `/summarize` condenses and restructures the current note.
- `/link` prioritizes grounded wiki-link insertion.
- `/ask` integrates the answer into the note instead of producing a Q/A block.

**Tests**

- Add prompt builder unit tests for command-specific instructions.

---

### D.3 Add command-aware context assembly

**Files**

- `apps/server/src/slash-commands.ts`
- `apps/server/src/capture.ts`
- supporting query/helpers as needed

**Changes**

- Build command-specific context input from:
  - current note content
  - recent note history
  - relevant recent notes / wiki-link candidates
  - collections/facts when available
- Start with lightweight context assembly and keep cost bounded.

**Acceptance**

- Slash-command execution has more context than the current generic note + prompt flow.
- Context loading remains bounded and deterministic.

**Tests**

- Add focused server tests for context selection and fallback behavior.

---

## Phase E - History And Transparency

### E.1 Store slash-specific history metadata

**Files**

- `apps/server/src/history.ts`
- `apps/server/src/capture.ts`

**Changes**

- Extend history event schema or payload to store:
  - `interactionType` (`capture`, `slash_command`, `workspace_action`)
  - `commandName`
  - `commandArgument`
  - optional cited/source note ids
- Continue storing the raw prompt text and note version snapshot.

**Acceptance**

- History can distinguish a slash command from a normal capture.
- History retains the raw slash prompt that triggered the rewrite.

**Tests**

- Expand history persistence tests in `apps/server/src/ux-hardening.test.ts` and/or `apps/server/src/workflow-routes.test.ts`.

---

### E.2 Improve history view presentation

**Files**

- `apps/web/src/routes/history.tsx`

**Changes**

- Render slash-specific metadata clearly, for example:
  - `Slash command: /ask`
  - command argument preview
  - action summary
  - version snapshot metadata
- Keep history as a secondary review surface.

**Acceptance**

- Users can understand what slash command was run and what it changed.

---

## Phase F - Move Slash Runs Onto RewriteAgent

### F.1 Route note refinement through per-interaction agent threads

**Files**

- `apps/server/src/agents/rewrite-agent.ts`
- `apps/server/src/capture.ts`
- `apps/web/src/lib/agents/hooks.ts`
- any note-run wiring in `apps/web/src/components/workspace/workspace-shell.tsx`

**Changes**

- Once slash command semantics are stable, route note refinement runs through `RewriteAgent`.
- Treat each note run as a fresh task-scoped interaction.
- Preserve the note as the durable artifact and the agent thread as disposable infrastructure.
- Keep resumable streaming behavior where possible.

**Acceptance**

- A slash run uses the intended fresh-thread model from the product vision.
- The note remains the durable result.
- History reflects the interaction without exposing a chat UI.

**Tests**

- Add integration coverage for slash-run streaming and persistence.

---

## 5) Rollout Strategy

### Milestone 1 - Correctness

- Shared parser/types
- note-scoped slash commands bypass heuristic misrouting
- in-note `/ask` rewrites notes
- no auto-run on unmount

### Milestone 2 - UX

- pending slash box decorations
- command palette inserts pending slash commands instead of executing immediately
- run-time slash removal + streaming rewrite

### Milestone 3 - Intelligence

- command-aware prompts
- command-aware context assembly
- better history metadata

### Milestone 4 - Architecture alignment

- note refinement routed through `RewriteAgent`

---

## 6) End-To-End Acceptance Checklist

- [x] Typing `/ask What changed?` on its own line shows a pending slash box immediately.
- [x] Deleting the slash text removes the box immediately.
- [x] Autosave never persists pending slash-command lines into stored note content.
- [x] Clicking `Run` removes pending slash boxes before streamed rewrite content arrives.
- [x] In-note `/ask` rewrites the note instead of showing an ephemeral answer.
- [x] Blank-page `/ask` can still return an ephemeral answer where intended.
- [x] `/summarize` restructures the current note.
- [x] `/link` inserts grounded `[[wiki links]]` only when targets exist.
- [x] `/research` can pull broader context and fold findings into the note.
- [x] Freeform `/...` behaves like a note-refinement instruction.
- [x] Closing the editor does not execute pending slash commands.
- [x] Command palette note actions insert pending slash commands rather than executing immediately.
- [x] History clearly shows slash command interactions and resulting rewrites.

---

## 7) Suggested Execution Order

1. Phase A.1 - shared parser/types
2. Phase C.2 - remove auto-run on unmount
3. Phase D.1 - force note-scoped slash commands into note mutation behavior
4. Phase B.1/B.2/B.3 - pending slash box UI
5. Phase C.1/C.3 - explicit note-run orchestration and palette insertion flow
6. Phase D.2/D.3 - command-aware prompts and context
7. Phase E - history improvements
8. Phase F - move note refinement onto `RewriteAgent`

This order gets the semantics correct before we invest in polishing the UI and architecture migration.
