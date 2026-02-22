# Note Workspace Cleanup Decisions

Date: 2026-02-16

This document summarizes findings from a code-level audit of the current note workspace implementation and recommends concrete product/engineering decisions for each requested cleanup item.

## Method

- Static code review only (no UI runtime session in this pass).
- Primary files reviewed:
  - `apps/web/src/components/workspace/workspace-shell.tsx`
  - `apps/web/src/components/workspace/canvas-pane.tsx`
  - `apps/web/src/components/note-editor.tsx`
  - `apps/web/src/components/command-palette.tsx`
  - `apps/web/src/components/upload-panel.tsx`
  - `apps/web/src/routes/{collections,digest,history}.tsx`
  - `apps/server/src/index.ts`
  - `apps/server/src/capture.ts`
  - `apps/server/src/agents/shared/prompt.ts`

---

## Executive Decisions

1. **Add first-class note delete/archive and restore UX.**
2. **Add explicit note rename UX (inline title editing).**
3. **Remove the separate Interaction box; move command interaction into note editing.**
4. **Fix the More menu crash immediately (wrong menu composition).**
5. **Implement autosave (debounced + flush-on-blur/unmount), keep explicit Run hotkey/button, and run-on-close only when there is pending command intent.**
6. **Keep Cmd+K, but redefine it as an action launcher (execute actions), not just text insertion.**
7. **Ship proper markdown rendering in read mode now; defer Obsidian-like per-line hybrid editing to a later phase.**
8. **Reframe or hide “Optional context” uploads until ingestion into agent context exists.**
9. **Stop generating unresolved `[[links]]`: only emit links to known existing notes.**

---

## 1) Deleting notes

### Findings

- There is **no direct note delete/archive control in web UI**.
- There is **no `DELETE /api/notes/:noteId` endpoint**.
- Soft-delete exists indirectly in capture workspace actions (`capture.ts`) via updating `deleted_at`, but that path expects command interpretation and note IDs and is not user-facing.

### Recommended decision

- Add explicit note archive/delete UI in note header + sidebar row menu.
- Add server endpoint: `DELETE /api/notes/:noteId` (soft delete via `deleted_at`), with optional `POST /api/notes/:noteId/restore`.
- Keep index synchronization behavior (already available via `notifyIndexRemove`).

---

## 2) Renaming notes

### Findings

- Backend already supports title updates via `PUT /api/notes/:noteId` (`title` optional).
- Frontend does not expose title editing. `NoteEditor` receives `title` as read-only text.

### Recommended decision

- Make title inline-editable at top of note.
- Save title through existing `PUT /api/notes/:noteId` route.
- Autosave title with same debounce policy as content.

---

## 3) Interaction should happen inside the note (not separate input below)

### Findings

- `NoteEditor` currently has two distinct regions:
  - note body
  - separate **Interaction** textarea + Save button
- Slash commands are processed from the Interaction box (`classifySlashInstruction`), not from natural in-note editing flow.

### Recommended decision

- Remove the separate Interaction section.
- Support command interaction directly in note editing mode:
  - slash command at cursor / command palette inserts action at cursor
  - command execution is tied to explicit Run (`Cmd+Enter`) or run-on-close for pending command intent
- Keep note content and command intent separate in state, but not separate in UX surface.

---

## 4) “More” button: purpose and crash

### Findings

- Purpose: route to optional review surfaces (`/collections`, `/digest`) and note history (`/history?noteId=...`).
- Crash root cause: menu composition mismatch. In `workspace-shell.tsx`, `DropdownMenu.Label` is used without wrapping group context, while Base UI menu group parts require `Menu.Group` context.
- Error observed is consistent with Base UI group-part usage constraints.

### Recommended decision

- Immediate fix: wrap label/items in `DropdownMenu.Group` (matching `user-menu.tsx` pattern), or remove group-only parts.
- Product cleanup: rename “More” to **Review** or **Workspace tools** to clarify intent.

---

## 5) Autosave + run behavior

### Findings

- Current save model is manual and coupled to Interaction box.
- Direct note edits are local until Save is triggered.
- Switching notes/closing edit mode does not guarantee persistence.
- `onBlur` exits edit mode but does not persist.

### Recommended decision

- Implement autosave for note content/title:
  - debounce 800–1200ms while typing
  - force flush on blur, note switch, unmount, and before capture run
- Keep explicit Run affordance for user clarity:
  - button label: **Run**
  - hotkey: `Cmd+Enter`
- Run-on-close behavior:
  - if pending command intent exists, execute run on note switch/close
  - if only plain text edits exist, autosave only (no rewrite invocation)

This avoids accidental expensive rewrites while still preventing data loss.

---

## 6) What Cmd+K currently does (and whether it works)

### Findings

Current behavior from `command-palette.tsx` and `canvas-pane.tsx`:

- Opens command palette via `Cmd/Ctrl+K`.
- Selecting agent commands inserts slash text (`/ask`, `/summarize`, `/research`, `/link`) into draft/interaction input.
- Selecting navigation commands opens `/collections` or `/digest`.
- It does **not** execute note actions directly; it mostly inserts text.

Additional functional gap:

- `/ask` currently routes to `ephemeral_answer`, which returns the user’s question text as ephemeral content in `executeCapture` rather than performing real QA.

### Recommended decision

- Keep Cmd+K as the primary launcher, but shift semantics from **insert command text** to **execute explicit actions**.
- Example:
  - “Run summarize on current note” executes immediately.
  - “Open note history” navigates immediately.
- If text insertion mode is retained, label it clearly as “Insert command” to avoid false expectation.

---

## 7) Markdown rendering + possible Obsidian-like per-line editing

### Findings

- Current read mode is plain line rendering with custom wiki-link replacement only.
- No general markdown rendering (headings, lists, code blocks, task lists, etc.).
- Editing is textarea-based and full-document plain text.

### Recommended decision

#### Phase 1 (ship now)

- Implement full markdown read rendering using `react-markdown` + `remark-gfm`.
- Add sanitization policy (`rehype-sanitize`) for safety.
- Keep edit mode as raw markdown textarea.

This gives immediate quality improvement with low migration risk.

#### Phase 2 (optional, later)

- Evaluate hybrid per-line/live-preview editing using CodeMirror 6-based approach.
- Treat Obsidian-like behavior as a dedicated editor project, not a quick patch.

Rationale: per-line hybrid editing has much higher complexity (selection, IME, markdown token visibility rules, extension maintenance).

---

## 8) “Optional content” section purpose

### Findings

- This section currently hosts file upload UI (`UploadPanel`).
- Uploads are persisted to object storage + `note_uploads` table.
- There is no evidence in current capture/rewrite prompt assembly that uploaded files are consumed by agents.

### Recommended decision

- If ingestion is not active yet: hide behind feature flag or relabel clearly:
  - “Attachments (saved, not yet used in AI rewrite)”
- If kept visible, add explicit expected behavior text and uploaded-file visibility/history.

Current wording implies context enrichment that is not actually delivered.

---

## 9) Prevent unresolved `[[links]]` from rewrite agent

### Findings

- Rewrite prompt instructs agent to use `[[Wiki Link]]` and add links when grounded in note content.
- Prompt does not include authoritative candidate note titles.
- No post-processing validates whether generated wiki links correspond to existing notes.
- UI renders wiki links as `/collections?query=...`; many can resolve to nothing.

### Recommended decision

- Enforce **existing-note-only** wiki links.

Implementation policy:

1. Before rewrite, provide top-K existing candidate notes (title + id) in prompt context.
2. Post-process generated markdown:
   - keep `[[title]]` only if title maps to an existing note (case-insensitive normalized match)
   - otherwise downgrade to plain text (or standard markdown link without wiki semantics)
3. For `/link` action specifically, require retrieval-backed matches only.

Optional: also persist validated relations into `note_links` for graph integrity.

---

## Suggested Delivery Order

1. **Fix More menu crash** (small, immediate).
2. **Autosave foundation** (prevents data loss).
3. **Delete + rename UX/API completion**.
4. **Inline interaction model migration**.
5. **Markdown read rendering (Phase 1)**.
6. **Cmd+K semantic redesign**.
7. **Wiki-link grounding and validation**.
8. **Optional content surfacing cleanup**.
9. **Per-line hybrid editor spike (Phase 2)**.

---

## External references used for editor/menu research

- Base UI Menu composition and group anatomy: `https://base-ui.com/react/components/menu`
- React Markdown capabilities and security model: `https://github.com/remarkjs/react-markdown`
- CodeMirror Markdown language support: `https://github.com/codemirror/lang-markdown`
- Example hybrid markdown editing exploration (community): `https://discuss.codemirror.net/t/hybrid-markdown-editing-preview-for-unfocused-lines-raw-for-active-line/9660`
