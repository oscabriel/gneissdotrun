# Markdown Editor Reset Background

> **Status:** Proposed  
> **Scope:** `apps/web`, `apps/server`, `packages/editor-core`, `packages/editor-pm`, `packages/api`  
> **Goal:** Replace the current hybrid markdown/TipTap editor with a simpler system built around canonical markdown, explicit `Source` and `Rich` modes, and aggressive deletion of dead code.

---

## 1) Why We Are Resetting The Editor

The current editor is solving the wrong problem.

Instead of offering two clean editing surfaces over the same note content, it tries to make one TipTap surface behave like both:

1. a raw markdown editor with visible formatting symbols
2. a rendered rich-text editor
3. a markdown-aware command surface for slash commands and agent-written content

That hybrid model created a large custom stack in:

- `apps/web/src/components/pm-markdown-editor.tsx`
- `packages/editor-pm/src/extensions/delimiter-rollover.ts`
- `packages/editor-pm/src/extensions/delimiter-rollover-source-mode.ts`
- `packages/editor-pm/src/extensions/markdown-shortcuts.ts`
- `packages/editor-pm/src/extensions/markdown-paste.ts`
- `packages/editor-pm/src/extensions/fake-selection.ts`
- `packages/editor-pm/src/extensions/list-normalization.ts`
- `packages/editor-pm/src/extensions/slash-command-box.ts`

This approach is no longer the right one for the product.

---

## 2) Product Realities That Drive The Reset

### 2.1 Markdown is still the canonical note format

Agents rewrite notes in markdown today and should continue to do so.

- `apps/server/src/agents/shared/prompt.ts` explicitly instructs agents to emit markdown.
- `apps/web/src/components/note-editor.tsx` already treats note content as a markdown string.
- slash command parsing in `packages/api/src/slash-commands.ts` operates on markdown text, not on a rich-text document model.

So the system must stay markdown-native at the storage and agent boundary.

### 2.2 Human editing should support both raw markdown and rich text

Humans need two different affordances:

- `Source` mode for exact markdown editing
- `Rich` mode for structured visual editing

These should be explicit modes, not one surface pretending to be both at once.

### 2.3 This repo is greenfield

There are no published compatibility requirements and no user base to protect.

That means the correct approach is:

- delete dead code aggressively
- rename packages if the names are now wrong
- rebuild the smallest correct system
- avoid compatibility shims and transitional abstractions unless they are strictly necessary to ship the new model

---

## 3) What Is Wrong With The Current Architecture

### 3.1 It round-trips on every edit

The current editor flow is:

`markdown string -> canonical AST -> ProseMirror JSON -> TipTap editor -> ProseMirror JSON -> canonical AST -> markdown string`

That happens continuously inside `apps/web/src/components/pm-markdown-editor.tsx`.

This makes the editor sensitive to:

- parser gaps
- serializer drift
- selection/history glitches
- performance costs from repeated parse/serialize cycles

### 3.2 It uses a large amount of custom behavior to fake mixed-mode editing

The delimiter rollover stack exists to make rendered text still feel like editable markdown:

- show markdown delimiters as decorations
- special-case cursor movement at delimiter boundaries
- turn rendered blocks back into temporary markdown source paragraphs
- reparse those paragraphs back into rich nodes when focus changes

This is inherently brittle because it is fighting the editor model instead of using it.

### 3.3 It duplicates concerns that should stay separate

Today we have multiple concerns bundled into one runtime:

- markdown parsing/serialization
- rich-text editing
- markdown typing emulation
- markdown paste emulation
- inline markdown delimiter rendering
- fake selection handling
- slash-command visual treatment
- syntax highlighting

These do not need to live together.

### 3.4 The old plan optimized the hybrid system instead of replacing it

`docs/plans/MARKDOWN-EDITOR-GAP-REMEDIATION-PLAN.md` is focused on improving the current hybrid architecture.

That plan is now obsolete because the product decision has changed: we no longer want to perfect the hybrid approach.

---

## 4) Decisions Locked For The New Architecture

These are the design constraints for the reset.

1. Markdown remains the only canonical note format.
2. Agents continue to read and write markdown.
3. The editor offers explicit `Source` and `Rich` modes.
4. `Source` mode is the fidelity-safe editing mode.
5. `Rich` mode is a convenience editor for a supported markdown subset.
6. `Rich` mode is not required to preserve byte-for-byte markdown formatting.
7. If a note cannot be safely represented in `Rich` mode, the app keeps the user in `Source` mode.
8. We do not preserve the current hybrid editor or any of its custom behaviors.
9. We do not keep dead packages or dead abstractions for hypothetical future use.

---

## 5) Target Architecture

### 5.1 Single canonical model

The canonical state everywhere remains a markdown string.

- note storage: markdown
- autosave payloads: markdown
- slash command parsing: markdown
- agent rewrite input/output: markdown

### 5.2 Two editing surfaces over the same markdown string

#### `Source` mode

- implemented with CodeMirror
- edits raw markdown directly
- no parse/serialize loop on every keystroke
- exact representation of agent output and unsupported markdown

#### `Rich` mode

- implemented with TipTap
- imports from markdown when entering rich mode or rehydrating after canonical content changes
- serializes back to markdown on update/save
- supports only the markdown subset we intentionally choose to support

### 5.3 Read-only preview stays separate

`apps/web/src/components/markdown-preview.tsx` remains a read-only renderer.

It should not be part of the editing-runtime architecture beyond preview mode.

---

## 6) Package Strategy

### 6.1 Delete `@gneissdotrun/editor-pm`

`packages/editor-pm` is too tightly shaped around the hybrid model.

Even the parts that seem reusable are packaged around the wrong abstraction boundary.

The clean move is to delete the package and rebuild only what the new design actually needs.

### 6.2 Replace `@gneissdotrun/editor-core` with `@gneissdotrun/editor-markdown`

The current `editor-core` package mixes durable markdown-domain code with behavior-engine experiments that exist only because of the hybrid editor.

The new package should keep only markdown-domain responsibilities:

- canonical document model
- markdown parse/serialize
- markdown artifacts / unsupported-node reporting
- rich-mode support analysis

The behavior-engine files under `packages/editor-core/src/behaviors/` should not survive the reset.

### 6.3 Keep TipTap and CodeMirror app-local until proven otherwise

The new rich editor and source editor only serve `apps/web` right now.

So the default architecture is:

- markdown-domain logic in `packages/editor-markdown`
- UI/editor runtime integration in `apps/web`

If another app eventually needs the same editor runtime, we can extract it later.

---

## 7) Rich Mode Philosophy

The old editor tried to make TipTap markdown-native.

The new rich editor should not do that.

Instead:

- render structured content naturally
- allow normal rich-text editing
- serialize back into canonical markdown
- reject notes that would be unsafe or lossy to edit in rich mode

This means we are explicitly choosing correctness and maintainability over clever mixed-mode behavior.

---

## 8) What Rich Mode Must Support

The minimum supported subset should include:

- paragraphs
- headings
- bold / italic / strike / inline code
- links
- wiki links
- blockquotes
- bullet lists
- ordered lists
- task lists
- code blocks
- tables
- images

Anything outside that subset should keep the note in `Source` mode.

---

## 9) Special Cases We Must Handle Explicitly

### 9.1 Agent-written markdown

Agents will keep producing markdown with formatting symbols.

That is fine because markdown remains canonical.

The new system only needs to answer one question when rendering rich mode:

> Is this markdown safe to open as structured rich content?

If yes, parse and render it.

If no, stay in `Source` mode.

### 9.2 Slash commands

Slash commands are markdown lines with product semantics.

They should remain text-first and canonical-markdown-first.

The simplest rule is:

- pending slash-command lines force `Source` mode
- `Run` continues to operate on the canonical markdown string

This avoids rebuilding slash-command UI as special rich-text nodes.

### 9.3 Wiki links

Wiki links remain important and should survive the reset.

But they should be preserved through the markdown-domain layer first, not through custom hybrid editor tricks.

---

## 10) Success Criteria For The Reset

The reset is successful when:

1. There is no hybrid markdown-in-TipTap editing stack left in the repo.
2. There is no dead editor behavior code left in shared packages.
3. Notes are stored and exchanged only as markdown.
4. Source mode cleanly edits raw markdown.
5. Rich mode cleanly edits the supported markdown subset.
6. Unsupported or lossy notes automatically remain in source mode.
7. Agent-written markdown continues to work without any prompt or protocol changes.

---

## 11) This Document Supersedes

This background replaces the assumptions behind:

- `docs/plans/MARKDOWN-EDITOR-GAP-REMEDIATION-PLAN.md`

That earlier plan should be treated as obsolete once implementation begins.
