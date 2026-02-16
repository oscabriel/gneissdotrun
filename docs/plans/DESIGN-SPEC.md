# Design Specification: Gneiss

> **Status:** Active — Design decisions locked in  
> **Last Updated:** February 2026

---

## Table of Contents

1. [[#Design Philosophy]]
2. [[#Competitive Design Landscape]]
3. [[#Visual Hierarchy]]
4. [[#Typography]]
5. [[#Color System]]
6. [[#Layout & Spacing]]
7. [[#Note Relationships (No Folders)]]
8. [[#Editor & Markdown]]
9. [[#Background Process Visibility]]
10. [[#Capture & Interaction Model]]
11. [[#Mobile / PWA Considerations]]
12. [[#Micro-interactions & Motion]]
13. [[#Share Page]]
14. [[#Resolved Design Decisions]]

---

## Design Philosophy

**One word: Zen.**

Gneiss is a personal knowledge workspace. Not a collaboration tool. Not a project manager. A private place where your thinking happens and agents quietly organize it.

### Core Design Principles

| Principle                      | Meaning                                                                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Serene by default**          | The UI should feel like a blank notebook. Minimal chrome, generous whitespace, nothing competing for attention.                                       |
| **Honest visibility**          | Background agent activity is never hidden but never intrusive. The user always knows what's happening without being interrupted.                      |
| **Clean input points**         | Every capture surface (quick input, editor, voice) should be immediately obvious and friction-free. One clear affordance per context.                 |
| **Content is king**            | Notes and their relationships are the primary visual. Navigation, toolbars, and metadata are secondary or hidden until needed.                        |
| **Personal, not performative** | No avatars, no presence indicators, no "shared with" badges. This is your space. The only collaboration feature is a share-page for individual notes. |

### Design Inspirations

**From the screenshots provided:**

- **Obsidian** — Graph view showing note relationships as a spatial network. Clean markdown rendering. Sidebar with flat/tree note list. Backlinks and `[[wiki links]]` as first-class citizens. Tag pills (`#evergreen`). Breadcrumb navigation (`Ideas / Writing is telepathy`). Stats bar (backlinks, word count, char count).
- **Bear** — Three-pane layout (sidebar tags, note list with previews, editor). Rich typography in editor. Hashtag-based organization with nested tags. Floating toolbar for formatting. Image previews inline with note list. Clean, warm aesthetic.

**From research — apps with relevant design patterns:**

| App                | Stars                                                                               | Design Takeaway for Gneiss                                                     |
| ------------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Logseq** (41k)   | Outliner-first, block references, graph view. Daily journal as default entry point. | Block-level linking without folders. Journal/daily capture as a natural entry. |
| **SiYuan** (41k)   | Block-level WYSIWYG, two-way links, graph. Privacy-first, self-hosted.              | Rich block editor with clean markdown rendering. Personal/private positioning. |
| **AFFiNE** (62k)   | Docs + whiteboard hybrid. Edgeless canvas. Local-first.                             | Spatial thinking canvas. Notes as objects you can arrange.                     |
| **AppFlowy** (68k) | Notion-like blocks, clean UI, Flutter/Rust.                                         | Structured but clean block layout. Database views.                             |
| **Standard Notes** | Extreme minimalism. Three-pane. Security-first. E2E encryption.                     | Proof that radical simplicity works for personal notes. No bells.              |

---

## Visual Hierarchy

The hierarchy of visual prominence in Gneiss, from most to least:

```
1. THE BLANK PAGE        — The new note view IS the primary input surface.
   (largest, most space, richest typography, full screen)

2. NOTE CONTENT          — The cumulative result of user + agent collaboration.
   (same space as above — always a clean, unified document)

3. NOTE TITLE            — Clear, bold, top of viewport
   (large but not overwhelming; inferred or agent-generated)

4. RELATIONSHIPS         — Tags, backlinks, related notes, wiki links
   (visible but secondary; soft colors, smaller type)

5. AGENT STATUS          — What's happening in the background
   (ambient, peripheral; status bar or subtle indicator)

6. NAVIGATION            — Sidebar, search, collection browser
   (collapsible, out of the way on mobile)

7. CHROME / TOOLBARS     — Formatting, settings, actions
   (hidden until focused or hovered; floating or contextual)

8. CONVERSATION HISTORY  — The raw thread behind the note (diff view)
   (secondary view, accessed on demand; never the default)
```

### Key Insight

The blank page is the invitation. There is no separate input bar, no capture widget, no chat panel. The new note view IS the capture surface. The emptiness itself is the affordance. Bear's three-pane with rich previews is compelling for scanning; Obsidian's graph view is compelling for spatial understanding. Gneiss has both but defaults to the simpler list view, with graph as opt-in exploration.

---

## Typography

Typography is the single highest-leverage design decision for a note-taking app. The editor font is where users spend 90% of their time.

### Font System

| Element                | Font              | Notes                                                               |
| ---------------------- | ----------------- | ------------------------------------------------------------------- |
| **Body text (editor)** | Libre Baskerville | Bookish serif. Generous line-height (~1.6-1.75). Max-width ~680px.  |
| **Headings**           | Libre Baskerville | Same family. Clear size scale (h1 > h2 > h3).                       |
| **UI chrome**          | Geist Mono        | Clean monospace for all non-editor UI — sidebar, metadata, buttons. |
| **AI input / capture** | Geist Mono        | Monospace reinforces the "thinking tool" feel for the input bar.    |
| **Code blocks**        | Geist Mono        | Unified monospace. Subtle background tint.                          |
| **Tags/metadata**      | Geist Mono        | Small size. Muted color. Pill-shaped badges.                        |

This is an opinionated default. Themes and user-selectable fonts will come later.

---

## Color System

### Zen Color Philosophy

The palette should feel like natural materials: stone, paper, ink, water. Not plastic, neon, or corporate blue. Gneiss is a striped rock with dark and light bands — the light/dark mode duality maps directly to this.

### Color Family: Tailwind `stone`

All UI colors stay within the **near-monochrome `stone` family**. No saturated accent colors. Warmth comes from the stone tones themselves — cream/newspaper backgrounds in light mode, deep charcoal in dark mode. Lower contrast than typical apps; the effect should feel like reading on quality paper, not a backlit screen.

```
Light Mode (warm stony cream):
  --surface-primary      stone-50 / stone-100  (page background — warm cream)
  --surface-secondary    stone-200             (sidebar, cards)
  --surface-elevated     white / stone-50      (modals, popovers)
  --text-primary         stone-800             (body copy — warm near-black)
  --text-secondary       stone-500             (metadata, timestamps)
  --text-tertiary        stone-400             (placeholders, disabled)
  --accent-primary       stone-700             (links, active states)
  --accent-secondary     stone-500             (tags, badges)
  --border-subtle        stone-200             (dividers — barely visible)
  --border-focus         stone-400             (input focus ring)

Dark Mode (deep charcoal stone):
  --surface-primary      stone-900 / stone-950 (page background)
  --surface-secondary    stone-800             (sidebar, cards)
  --surface-elevated     stone-800 / stone-750 (modals, popovers)
  --text-primary         stone-100             (body copy)
  --text-secondary       stone-400             (metadata, timestamps)
  --text-tertiary        stone-500             (placeholders, disabled)
  --accent-primary       stone-300             (links, active states)
  --accent-secondary     stone-400             (tags, badges)
  --border-subtle        stone-700             (dividers)
  --border-focus         stone-500             (input focus ring)

Status (both modes):
  --status-processing    stone-500 with pulse  (agent working)
  --status-complete      stone-400 brief flash (agent done)
  --status-attention     warm stone / amber-ish tone (contradiction, action needed)
  --status-error         muted red             (rare)
```

### Dark Mode

Co-equal priority. Both light and dark modes are first-class. Our target users (Obsidian + Claude Code users) split roughly 50/50 or lean dark. Both must feel intentional, not derived.

---

## Layout & Spacing

### Desktop Layout (Primary)

```
┌─────────────────────────────────────────────────────┐
│ [sidebar]  [note list / graph]  [editor / reader]   │
│                                                     │
│  Collapsible   Optional middle    Primary content   │
│  nav + search  pane (list or      area. Full-width  │
│  + agent       graph view)        when middle pane  │
│  status                           is collapsed.     │
│                                                     │
│  Width: 240px  Width: 280px       Width: remaining  │
│  (collapsible) (collapsible)      (min ~600px)      │
└─────────────────────────────────────────────────────┘
```

Bear-style three-pane on desktop. Sidebar collapses on narrow viewports. Middle pane (note list) collapses to give editor full width.

### Spacing Scale

Use a consistent 4px base:

- `4px` — tight (inline elements)
- `8px` — compact (form elements, small gaps)
- `16px` — standard (paragraph spacing, card padding)
- `24px` — comfortable (section spacing)
- `32px` — generous (major section breaks)
- `48px+` — breathing room (page margins, hero areas)

The editor content area should have extra-generous margins — think `48-64px` on each side on desktop — to create that "zen" centered-content feel.

---

## Note Relationships (No Folders)

This is a core differentiator. Notes exist in relation to each other, not in a hierarchy.

### Relationship Types

| Mechanism                    | UI Representation                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **Tags**                     | Pill badges on notes. Clicking a tag shows all notes with that tag. Tags can be nested (`#projects/gneiss`). Bear's approach. |
| **Backlinks**                | "Linked from" section at bottom of note. Shows all notes that reference this one. Obsidian's approach.                        |
| **Wiki links**               | `[[note title]]` inline. Rendered as clickable links. Creates bidirectional relationship.                                     |
| **Agent-generated clusters** | Collections auto-created by the organization agent. Shown as a "Related" section or in sidebar under "Collections".           |
| **Graph view**               | Optional spatial view showing notes as nodes, relationships as edges. Not default — it's an exploration tool.                 |

### Navigation Without Folders

Instead of a folder tree, the sidebar shows:

```
SIDEBAR
├── Search
├── Recent (last ~10 notes)
├── Tags
│   ├── #projects
│   ├── #ideas
│   └── #reading
├── Collections (agent-generated)
│   ├── Q2 Roadmap (4 notes)
│   └── Auth Patterns (3 notes)
├── Action Items (detected tasks)
└── All Notes (flat list, sorted by recency)
```

---

## Editor & Markdown

### Tiptap as the Foundation

Tiptap (ProseMirror-based) provides:

- Block-based editing with clean DOM output
- Markdown input/output
- Slash commands (`/heading`, `/code`, `/todo`)
- Collaborative extensions (future-proofing, even if not for v1)
- Plugin architecture for custom blocks

### Editor UX Goals

| Goal                 | Implementation                                                                |
| -------------------- | ----------------------------------------------------------------------------- |
| **WYSIWYG markdown** | Type markdown syntax, see rendered output immediately. No split-pane preview. |
| **Slash commands**   | `/` to insert blocks. Minimal, discoverable.                                  |
| **Floating toolbar** | Select text to see formatting options. Not a persistent toolbar.              |
| **Wiki links**       | Type `[[` to trigger note search/autocomplete.                                |
| **Tag input**        | Type `#` to trigger tag autocomplete.                                         |
| **Code blocks**      | Syntax highlighting. Language selector. Copy button.                          |
| **Tables**           | Basic table support. Not spreadsheet-level.                                   |
| **Checklists**       | `- [ ]` renders as interactive checkboxes.                                    |
| **Images**           | Drag-and-drop or paste. Inline display with optional caption.                 |
| **Block handles**    | Subtle drag handle on hover for reordering blocks.                            |

### What "Functional Markdown" Means

The editor should handle these well:

- Headers (h1-h6) with clear visual hierarchy
- Bold, italic, strikethrough, inline code
- Ordered/unordered lists with nesting
- Blockquotes with visual distinction
- Horizontal rules
- Code blocks with syntax highlighting
- Tables
- Task lists
- Images with alt text
- Links (both regular and wiki-style)
- Footnotes (stretch)
- Math/LaTeX (stretch)

---

## Background Process Visibility

Users should always know what agents are doing without being interrupted.

### Agent Status Design

```
AGENT STATUS BAR (bottom of sidebar or bottom of screen)
┌─────────────────────────────────────────┐
│  ● Organizing 3 captures...             │  ← subtle dot + text
│    Last organized: 2h ago               │  ← timestamp
└─────────────────────────────────────────┘
```

### Status States

| State                | Visual                                                                |
| -------------------- | --------------------------------------------------------------------- |
| **Idle**             | Small dot (muted). "All caught up" or nothing.                        |
| **Processing**       | Gentle pulse animation on dot. Brief text: "Organizing 3 captures..." |
| **Completed**        | Brief flash/checkmark. Fades back to idle within 3-5 seconds.         |
| **Attention needed** | Warm-colored dot. "1 contradiction detected" — clickable.             |
| **Error**            | Red dot. Expandable error details. Rare.                              |

### Key Design Rules

1. **No modals for status.** Never block the user.
2. **No notification badges with counts.** This isn't email.
3. **No sounds.** Ever.
4. **Peripheral, not central.** Status lives at the edge of the viewport.
5. **Expandable on demand.** Click to see details of what was organized.

---

## Capture & Interaction Model

### The Blank Page (Primary Interaction)

There is no floating input bar. No chat widget. No capture overlay. The new note view IS the primary capture surface — a full-screen blank page where the user brain dumps via typing, voice, or paste. Every thought enters through the same door.

```
Desktop (new note):
┌─────────────────────────────────────────────────────┐
│  [← back]                                    [Save]   │  ← minimal top bar
│                                                     │
│                                                     │
│     What's on your mind?                            │  ← faint placeholder (Geist Mono)
│     _                                               │  ← cursor, already focused
│                                                     │
│                                                     │
│                                                     │
│                                                     │
└─────────────────────────────────────────────────────┘

Mobile (new note):
┌────────────────────┐
│  [←]         [Save]  │  ← minimal top bar
│                    │
│  What's on your    │
│  mind?             │
│  _                 │
│                    │
│                    │
│                    │
└────────────────────┘
```

### The "Save" Button

One button. The user writes, then hits **Save** (or `Cmd+Enter` on desktop). The agent takes over.

The user's input is **consumed** by the agent. It does not persist as-is. The agent reads the brain dump, infers intent, and **replaces the content** with the result — a clean, organized note. The user's raw text is gone from the surface. What remains is the product of the agent's work: structured content, wiki links, detected action items, related context.

The user can stay and watch the agent rewrite the note in real time (content morphing like a live document edit), or leave and come back to the finished result.

### The Note is the Result, Not the Transcript

**This is the core model.** The note is not a conversation log. It is the cumulative artifact produced by the conversation between the user and the agent.

- User brain dumps → agent replaces the dump with organized content
- User issues a slash command → the slash command disappears, and the agent **folds new content into the existing note** logically, restructuring as needed
- Every interaction refines the note. It doesn't append to it.
- The note always looks like a clean, shareable document — because it IS the product, not the process

There are no visible dividers, no "agent · 3m ago" labels, no collapsible response blocks. The note is just a note. Clean Libre Baskerville body text. Indistinguishable from something a human wrote by hand.

### Slash Commands (Instructions to the Agent)

Within any note, the user can type a slash command on a new line to instruct the agent:

- `/ask [question]` — agent answers using the note + broader knowledge base as context
- `/research [topic]` — agent pulls from other notes and external sources, integrates findings
- `/link` — agent finds and inserts relevant `[[wiki links]]`
- `/summarize` — agent condenses and restructures the note
- `/` + natural language only when the slash token is not a known editor formatting command

**The slash command is ephemeral.** After the agent processes it, the command text disappears. The note is rewritten/extended with the result. The user never sees their prompt and the agent's response side by side — they only see the resulting note.

```
Example — what the user sees over time:

STEP 1: User types and hits Save:
┌─────────────────────────────────────────────────────┐
│  Just met with Sarah. She's worried about Q2 but    │
│  thinks we can hit it if we cut API redesign scope.  │
│  Mobile is now the priority. Update roadmap Friday.  │
└─────────────────────────────────────────────────────┘

STEP 2: Agent rewrites. User comes back to:
┌─────────────────────────────────────────────────────┐
│  # Sarah Meeting: Q2 Scope Decision                  │
│                                                     │
│  Sarah is concerned about the Q2 deadline but       │
│  believes it's achievable if API redesign scope     │
│  is reduced. Mobile app is now the top priority.    │
│                                                     │
│  ## Related Context                                 │
│  - [[API Redesign Scope]] — David considers scope   │
│    negotiable (potential conflict with Sarah)        │
│  - [[Q2 Roadmap]] — 4 other notes this week         │
│                                                     │
│  ## Action Items                                    │
│  - [ ] Update roadmap document (due Friday)          │
└─────────────────────────────────────────────────────┘

STEP 3: User types "/ask What did David say exactly?"
        Command disappears. Note grows:
┌─────────────────────────────────────────────────────┐
│  # Sarah Meeting: Q2 Scope Decision                  │
│                                                     │
│  Sarah is concerned about the Q2 deadline but       │
│  believes it's achievable if API redesign scope     │
│  is reduced. Mobile app is now the top priority.    │
│                                                     │
│  ## Conflicting Positions                           │
│  - **Sarah (Engineering):** API redesign is          │
│    non-negotiable for quality                        │
│  - **David (CEO):** "We need to ship mobile by Q2;  │
│    scope the API if needed." ([[David 1:1 Jan 15]])  │
│                                                     │
│  ## Related Context                                 │
│  - [[API Redesign Scope]] — ongoing discussion       │
│  - [[Q2 Roadmap]] — 4 other notes this week         │
│                                                     │
│  ## Action Items                                    │
│  - [ ] Update roadmap document (due Friday)          │
│  - [ ] Resolve Sarah/David conflict on API scope     │
└─────────────────────────────────────────────────────┘
```

Notice: the note restructured itself. "Related Context" became "Conflicting Positions" + "Related Context" because the agent recognized the David/Sarah tension was the more important structure. The note is always the best current version of the knowledge.

### Conversation History (Diff View)

The raw conversation — every user prompt and every agent action — is preserved underneath, accessible via a secondary "History" view. This is like git log for the note.

```
History view for the note above:

┌─────────────────────────────────────────────────────┐
│  CONVERSATION HISTORY                                │
│                                                     │
│  [1] User (2:30 PM)                                 │
│  Just met with Sarah. She's worried about Q2 but    │
│  thinks we can hit it if we cut API redesign scope.  │
│  Mobile is now the priority. Update roadmap Friday.  │
│                                                     │
│  [2] Agent (2:30 PM)                                │
│  → Rewrote note: added title, structured sections,  │
│    linked to [[API Redesign Scope]] and [[Q2         │
│    Roadmap]], detected 1 action item                 │
│                                                     │
│  [3] User (3:15 PM)                                 │
│  /ask What did David say exactly?                    │
│                                                     │
│  [4] Agent (3:15 PM)                                │
│  → Restructured note: added "Conflicting Positions" │
│    section with David's quote from [[David 1:1]],   │
│    added second action item                          │
└─────────────────────────────────────────────────────┘
```

The history view lets users:

- See the raw prompts they wrote (even though they're gone from the note)
- See what the agent changed at each step
- Understand how the note evolved over time
- Optionally revert to a previous version

### Agent Routing: Not Everything Becomes a New Note

The default pipeline is: user types → hits Save → agent creates a new note from the input. But not all inputs fit this pattern. The agent's first job is to **route** the input to the right outcome.

#### Routing Taxonomy

| Route                  | Input Pattern                                                                                                                 | Result                                                   | UI Feedback                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------- |
| **New note**           | New topic, brain dump, query, research request                                                                                | New note created from input                              | Default — user sees note morph                                          |
| **Update existing**    | Content belongs to an existing note (append/amend)                                                                            | Existing note updated                                    | Navigate to updated note, or toast: "Added to [[Grocery List]]"         |
| **Multi-note split**   | Input contains distinct unrelated topics                                                                                      | Multiple notes created                                   | Primary note shown, toast: "Also created: [[Other Note]]"               |
| **Multi-note fan-out** | Input touches several existing notes                                                                                          | New note created + existing notes updated in background  | New note shown, toast: "Also updated: [[Note A]], [[Note B]], 3 others" |
| **Workspace action**   | Allowlisted action request (`archive_note(s)`, `mark_collection_resolved`, `rename_collection`, `link_notes`, `unlink_notes`) | Action executed, no note created                         | Toast confirmation + entry in activity log                              |
| **Ephemeral answer**   | Quick lookup, trivia, no lasting value                                                                                        | Answer shown in canvas until next input or `8000ms` idle | Then canvas resets to blank-ready state. No note saved.                 |
| **Preference/meta**    | Instructions about agent behavior ("always include action items")                                                             | Preference stored, no note created                       | Toast: "Preference saved"                                               |
| **Correction**         | Amends a specific fact in an existing note ("deadline is Wednesday, not Friday")                                              | Existing note updated with corrected fact                | Toast: "Updated [[note name]]"                                          |
| **Duplicate**          | Redundant with existing content                                                                                               | No new note created                                      | Toast: "Already captured in [[note name]]" with link                    |

#### Edge Case Details

**Multi-note split.** "I met with Sarah about Q2 and separately I had an idea for the new homepage design." One brain dump, two unrelated topics. The agent creates two notes. The user is navigated to the first/primary note. A toast says "Also created: [[Homepage Design Idea]]." Each note's conversation history records the relevant portion of the original input.

**Multi-note fan-out.** "Meeting with the team: Sarah is taking over the API project, David is moving to mobile, and we pushed the deadline to March." This touches [[Sarah]], [[API Project]], [[David]], [[Mobile]], and [[Q2 Roadmap]]. The agent creates one new meeting note AND updates the existing notes in the background. User sees the meeting note; toast lists what else was updated.

**Ephemeral answer.** "What time zone is Tokyo in?" The user doesn't want a note called "Tokyo Time Zone." The answer appears in the editor space and is dismissed on next user input or after `8000ms` idle, then the blank page resets. No note is saved. No note list pollution. If the user wants to keep it, they can hit Save again or just start writing — the act of continuing to type signals "actually, make this a note."

**Correction/amendment.** "Actually, the deadline isn't Friday — it's next Wednesday." The agent finds the note with the Friday deadline, updates it, and navigates the user there (or toasts). No new note needed. The correction is logged in the destination note's conversation history.

**Duplicate detection.** "Sarah is worried about Q2" — but this was captured three days ago. The agent recognizes the redundancy: "Already captured in [[Sarah Meeting: Q2 Scope Decision]]." The user can click through to the existing note or add new context.

**Preference/meta instructions.** "From now on, always include action items at the bottom of my meeting notes." Not content — a meta-instruction. The agent stores it as a user preference, confirms via toast, and the blank page resets. Preferences are visible in a settings section, not in notes.

#### What the User Always Sees

Regardless of routing, the blank page is always the starting point. After hitting Save:

- If a new note is created → the blank page transforms into the note (morphing animation)
- If an existing note is updated → the user is navigated to that note (crossfade transition), or stays on the blank page with a toast + link
- If an action is executed or a preference is stored → toast confirmation, blank page resets, ready for the next thought
- If an ephemeral answer is shown → it dismisses on next user input or after `8000ms` idle, then blank page resets

The blank page is the universal entry point. It always returns to its empty state after non-note interactions, ready for the next thought.

### Accessing New Notes

**Desktop:**

- Press `N` when not actively typing in the editor → instant new blank note. Context-aware: if cursor is in the editor, `N` types the letter normally.
- `Cmd+K` opens a **command palette** (first option: "New note"). Also surfaces search, go-to-collection, and other power-user actions.
- The new note loads instantly — no transition animation, no loading state. Cursor is focused and blinking by the time the user's finger lifts off the key.

**Mobile:**

- `+` button in the top bar — always visible, always one tap away.
- Tapping `+` opens a blank note immediately with keyboard ready.

### Voice Capture (via OpenClaw)

- Not in the web app initially
- OpenClaw sends voice memo → transcription → stored as a note
- Web app shows transcribed note with "via voice" source label
- Agent processes the transcription the same as any other note

---

## Mobile / PWA Considerations

### Mobile Layout

Single-pane. Stack vertically. Sidebar is an overlay, collapsed by default. No floating input bars or FABs — the top bar is the only persistent chrome.

```
Viewing note list:
┌────────────────────┐
│  [☰]  Notes   [+]  │  ← minimal top bar: menu, title, new note
├────────────────────┤
│                    │
│  Note list OR      │  ← swipe between views
│  Graph OR          │
│  Digest            │
│                    │
│                    │
│                    │
└────────────────────┘

Viewing/editing a note:
┌────────────────────┐
│  [←]  Note title [+]│  ← back, title (truncated), new note
├────────────────────┤
│                    │
│  Note content      │
│  (full screen)     │
│                    │
│                    │
│            [Save]    │  ← appears when editing; bottom-right, above keyboard
└────────────────────┘

New note:
┌────────────────────┐
│  [←]         [Save]  │  ← back + Save button
├────────────────────┤
│                    │
│  What's on your    │
│  mind?             │
│  _                 │  ← cursor, keyboard already open
│                    │
│                    │
└────────────────────┘
```

### Touch Considerations

- Large tap targets (44px minimum)
- Swipe gestures: swipe right to go back, swipe left on note to archive
- Bottom sheet for actions (not dropdown menus)
- `+` in the top bar is fixed position — not a floating action button. Quieter, always reachable, doesn't obscure content on scroll
- Three elements max in top bar at any time

---

## Micro-interactions & Motion

### Motion Philosophy

Motion should be **purposeful and subtle**. Like a stone dropped in still water — brief ripple, then calm.

| Interaction                | Animation                                                                                                   |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Page transitions**       | Crossfade, 150-200ms. No slide-in/out.                                                                      |
| **Sidebar collapse**       | Smooth width transition, 200ms ease-out.                                                                    |
| **Agent status pulse**     | Slow opacity pulse on status dot (2s cycle). Not bouncing.                                                  |
| **Note morphing**          | After Save: content smoothly rewrites — text fades/shifts as agent restructures. Like watching a live edit. |
| **Slash command consumed** | Command text fades out, note content shifts to accommodate new structure. Smooth, not jarring.              |
| **Note appear in list**    | Subtle fade-in from top. 150ms.                                                                             |
| **Tag/link creation**      | Pill animates in from inline text. 200ms.                                                                   |

### What to Avoid

- Bouncing animations
- Spring physics (too playful for zen)
- Parallax scrolling
- Loading skeletons everywhere (use them sparingly)
- Progress bars for agent processing (use ambient indicators)

---

## Share Page

The one "collaboration" feature: share any individual note as a public read-only page.

### Design

- Clean, minimal public page. No app chrome.
- Note title, content, and tags displayed.
- "Made with Gneiss" footer link (subtle).
- No comments, no reactions, no edit access.
- Shareable URL: `gneiss.run/share/{noteId}` or custom slug.
- Toggle to enable/disable sharing per note.

---

## Resolved Design Decisions

All design questions have been answered. This table is the canonical reference.

| #   | Decision                 | Resolution                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | **Color temperature**    | Warm stony/cream. Tailwind `stone` family. Lower contrast. Newspaper/stone paper feel.                                                                                                                                                                                                                                                                                                                             |
| 2   | **Sidebar style**        | Collapsible. Visible on desktop by default, collapsed on mobile. Overlay on mobile.                                                                                                                                                                                                                                                                                                                                |
| 3   | **Note list style**      | All four views available: compact list, preview cards, timeline feed, graph. Four-button switcher in top bar.                                                                                                                                                                                                                                                                                                      |
| 4   | **Graph prominence**     | Secondary view. Optional tab in sidebar top bar. Not a default nav mode.                                                                                                                                                                                                                                                                                                                                           |
| 5   | **Editor font**          | Libre Baskerville (bookish serif). UI/AI input: Geist Mono. Opinionated default, themes later.                                                                                                                                                                                                                                                                                                                     |
| 6   | **Density**              | Adaptive. Compact sidebar/list, airy editor. The editor is where zen lives.                                                                                                                                                                                                                                                                                                                                        |
| 7   | **Accent color**         | Near-monochrome only. Tailwind `stone` family for everything. No saturated accents.                                                                                                                                                                                                                                                                                                                                |
| 8   | **Dark mode**            | Co-equal priority. Both light and dark are first-class. Target audience splits 50/50.                                                                                                                                                                                                                                                                                                                              |
| 9   | **Branding**             | No in-app branding except optional small wordmark in sidebar footer. Branded landing page only.                                                                                                                                                                                                                                                                                                                    |
| 10  | **Primary input**        | No floating input bar. The new note blank page IS the primary capture surface. One "Save" button. Agent infers intent.                                                                                                                                                                                                                                                                                             |
| 11  | **Tag system**           | TBD. May be replaced with a more flexible system. Not locked in yet.                                                                                                                                                                                                                                                                                                                                               |
| 12  | **New note behavior**    | Blank page, full screen, cursor focused. THE primary entry point. `N` key on desktop, `+` in top bar on mobile.                                                                                                                                                                                                                                                                                                    |
| 13  | **Note-as-result**       | The note is the RESULT of the conversation, not the transcript. User prompts are consumed by the agent and replaced with clean, organized output. Slash commands disappear after processing. The note is always a unified document.                                                                                                                                                                                |
| 14  | **Agent rewrites**       | Agent replaces/restructures note content on each interaction. No visible dividers, no "agent" labels, no collapsible blocks. The note looks like a note, not a chat log. Content morphs in real time if user stays to watch.                                                                                                                                                                                       |
| 15  | **Conversation history** | Raw thread (every user prompt + every agent action) preserved in a secondary "History" view — like git log for the note. Accessible on demand, never the default view. Supports revert to previous versions.                                                                                                                                                                                                       |
| 16  | **Mobile top bar**       | Minimal: 3 elements max. Note title + `+` button (fixed, not floating FAB). Back arrow when navigated in.                                                                                                                                                                                                                                                                                                          |
| 17  | **Command palette**      | `Cmd+K` on desktop. First option: new note. Also surfaces search, go-to-collection, power-user actions.                                                                                                                                                                                                                                                                                                            |
| 18  | **Agent routing**        | Not all inputs create new notes. Agent routes to: new note, update existing, correction, multi-note split, multi-note fan-out, workspace action, ephemeral answer, preference storage, or duplicate detection. Blank page resets after non-note interactions.                                                                                                                                                      |
| 19  | **Ephemeral threads**    | Every user interaction spawns a fresh, disposable agent thread — not a persistent conversation. The note is the source of truth; the thread is invisible infrastructure. The user never thinks about context windows, stale threads, or "starting a new chat." Each LLM call receives: current note + new input + compact context. Full message history is retained only for the History view, not as LLM context. |

---

## Next Steps

1. ~~Answer design questions~~ — All 18 resolved (see table above)
2. **Apply Tailwind theme** — Switch from `neutral` to `stone`, add Libre Baskerville + Geist Mono fonts
3. **Build static component library** — Sidebar, note list (4 view modes), blank-page new note, editor shell, agent status bar, command palette, Save button
4. **Prototype the editor** with Tiptap + Libre Baskerville + markdown features + agent slash commands
5. **Prototype note morphing** — Real-time content rewrite animation after Save/slash command. Smooth text transitions as agent restructures the document.
6. **Design the conversation history view** — Git-log-style diff view showing raw prompts + agent actions over time, with version revert
7. **Design the graph view** as secondary exploration tool
