# Product Vision: Gneiss

> **You do the thinking. Let the agents do the organizing.**
>
> An ambient knowledge capture system that turns your loose thoughts into organized, actionable insights.

---

## Table of Contents

1. [[#The Thesis]]
2. [[#Core Principles]]
3. [[#Architecture Overview]]
4. [[#User Experience]]
5. [[#Feature Roadmap]]
6. [[#Technical Implementation]]
7. [[#Open Questions]]

---

## The Thesis

### The Problem

Capturing thoughts is easy. Organizing them is hard. Reviewing them at the right time is nearly impossible.

Knowledge workers spend **80% of their cognitive energy on filing and retrieval** rather than actual thinking. They:

- Struggle to find the right folder while the thought slips away
- Create notes that never get linked, tagged, or reviewed
- Capture ideas on one device that can't be accessed on another
- Drown in unsorted captures but can't trust the "AI-organized" mess

The result: **ideas get lost, insights get buried, and your brain becomes the bottleneck**.

### The Opportunity

What if organization wasn't your job? What if you could just _think out loud_ and let agents handle the rest?

**Your workflow becomes:**

1. **Capture** — Dump thoughts from any device, in any format, with zero friction
2. **Trust** — Agents organize, link, and prioritize in the background
3. **Review** — Surface findings when _you're_ ready, not when the system demands

```
┌─────────────────────────────────────────────────────────────┐
│                    THE GNEISS VISION                        │
│                                                             │
│   CAPTURE → ORGANIZE → SURFACE → ACT                        │
│                                                             │
│   You:                                                      │
│   • Voice memo in the car                                   │
│   • Quick thought on your phone                             │
│   • Meeting notes after a call                              │
│   • Screenshot from a book                                  │
│                                                             │
│   Agents (background, async):                               │
│   • Extract entities and facts                              │
│   • Cluster related captures                                │
│   • Detect emerging priorities                              │
│   • Flag contradictions and open loops                      │
│   • Synthesize weekly digests                               │
│                                                             │
│   You (on your schedule):                                   │
│   • Review "3 priorities surfaced this week"                │
│   • Approve auto-created connections                        │
│   • Act on surfaced insights                                │
│   • Dive into organized collections when needed             │
└─────────────────────────────────────────────────────────────┘
```

### The Tagline

> **You do the thinking. Let the agents do the organizing.**

---

## Core Principles

### 1. Capture-First, Zero Friction

The hardest part of knowledge work is getting thoughts out of your head. Remove every barrier:

- No folders to choose, no templates to fill
- The blank page IS the capture surface — open the app, start typing
- No categorization—just dump it and move on
- One button ("Save") to capture and let the agent handle the rest
- Every note is both a capture and a conversation with the agent

**Anti-pattern:** Opening an app, choosing a folder, writing a title, tagging, choosing between "note" or "chat"
**Our pattern:** Blank page → brain dump → Save → agent handles the rest

### 2. Organization is the Agent's Job

Humans think in streams. Agents think in structures. Let each do what they're good at:

- Agents cluster, link, and categorize in the background
- No folder structure is the user's problem (though they can browse it)
- Organization happens asynchronously, not blocking capture
- User reviews and approves connections, not creates them

### 3. Review on Human Time, Not System Time

Push, don't pull. The system surfaces findings; the user reviews when ready:

- Daily: "3 captures organized, 1 action item detected"
- Weekly: "Emerging theme: 'API redesign' (mentioned 7 times)"
- Monthly: "4 old projects resurfaced with new context"

No notification fatigue—digest-style summaries when you choose to look.

### 4. Ambient Interface via OpenClaw

Your knowledge system should be as accessible as messaging a friend:

- "Hey, just had a thought about the Q2 roadmap..." → captured and organized
- "What did I say about the auth system?" → surfaced findings, not raw search
- Voice memos, quick texts, screenshots—all valid input

OpenClaw is the capture layer; Gneiss is the organization engine.

### 5. Ephemeral Threads, Durable Notes

Most "agentic" apps treat the conversation thread as the primary object. Users manage threads, worry about context windows, and create new threads when the old one gets stale. In Gneiss, the **note** is the source of truth — the thread is disposable infrastructure the user never sees.

Every time a user interacts with a note — brain dump, slash command, correction — a fresh background agent thread spins up just for that task. The thread receives the note (the source of truth) plus whatever context it needs, does its job (rewrite, research, link), updates the note, and is discarded. The user never re-enters an old conversation. There is no "context left" to worry about, no stale thread to abandon, no decision about when to start fresh.

- The note accumulates knowledge across interactions; the thread does not
- Context management is the system's problem, solved by keeping threads minimal and task-scoped
- The user's mental model is "I'm talking to my note," not "I'm in a conversation with an AI"
- This is why the History view exists: it's the archaeological record of all the disposable threads that shaped the note

**Anti-pattern:** "You have 12 messages left in this context window. Start a new chat?"
**Our pattern:** Every interaction is a fresh agent. The note remembers everything. The threads remember nothing.

### 6. Trust Through Transparency

You don't need to micromanage the organization, but you should be able to see it:

- Browse the auto-generated structure anytime
- See how captures were clustered and why
- Approve or override agent decisions
- Export everything—your data, your structure, your rules

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                           GNEISS ARCHITECTURE                      │
│                                                                    │
│  ┌──────────────┐     ┌──────────────┐     ┌─────────────────────┐ │
│  │   Web App    │     │  Mobile PWA  │     │   OpenClaw Gateway  │ │
│  │ (TanStack)   │     │  (future)    │     │ (WhatsApp/Telegram) │ │
│  └──────┬───────┘     └──────┬───────┘     └──────────┬──────────┘ │
│         │                    │                        │            │
│         └────────────────────┼────────────────────────┘            │
│                              ▼                                     │
│                    ┌─────────────────┐                             │
│                    │  Hono Router    │  ◄── /api/*, /agents/*      │
│                    │  (Workers)      │                             │
│                    └────────┬────────┘                             │
│                             ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │              CLOUDFLARE AGENTS (Durable Objects)             │  │
│  │                                                              │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐   │  │
│  │  │ IndexAgent  │  │  Rewrite    │  │   Router Agent      │   │  │
│  │  │ (per user)  │◄─┤  Agent      │◄─┤   (per user)        │   │  │
│  │  │  reactive   │  │ (per note)  │  │   classifies input  │   │  │
│  │  │  sidebar    │  │ AIChatAgent │  │                     │   │  │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘   │  │
│  │         ▲                                                    │  │
│  │         │          ┌─────────────┐  ┌─────────────────────┐  │  │
│  │         └──────────┤Organization │  │  Surfacing Agent    │  │  │
│  │                    │  Agent      │  │  (per user)         │  │  │
│  │                    │ (per user)  │  │  digests + queries  │  │  │
│  │                    └─────────────┘  └─────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Shared Cloudflare Services                                  │  │
│  │  D1 (SQLite)  — notes, entities, facts, collections, users   │  │
│  │  Vectorize    — note + entity embeddings                     │  │
│  │  R2           — audio, images, PDFs                          │  │
│  │  KV           — sessions, rate limits, cached routing index  │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### Key Components

| Component           | Technology                           | Purpose                                        |
| ------------------- | ------------------------------------ | ---------------------------------------------- |
| **Web App**         | TanStack Start + React               | Primary UI for editing and browsing            |
| **API Router**      | Hono on Workers                      | HTTP routes, agent routing, SSR                |
| **Agent Framework** | `agents` SDK + `@cloudflare/ai-chat` | Stateful agents with WebSocket, streaming, SQL |
| **Agents**          | Durable Objects                      | Per-note and per-user stateful agents          |
| **Database**        | D1 (SQLite) + per-DO SQLite          | Relational storage + co-located agent state    |
| **Vector Search**   | Vectorize                            | Semantic search across notes and entities      |
| **File Storage**    | R2                                   | Audio, images, PDFs                            |
| **Sessions/Cache**  | KV                                   | Session tokens, rate limits, routing cache     |
| **OpenClaw Bridge** | Hono HTTP endpoints                  | Bidirectional communication with OpenClaw      |
| **Auth**            | `better-auth` via D1/KV              | User authentication                            |
| **Deploy**          | Cloudflare Workers                   | Unified: frontend + backend + agents           |

---

## User Experience

### The Core Loop: CAPTURE → ORGANIZE → SURFACE → ACT

**Throughout the week:**

- You dump thoughts, voice memos, and notes with zero organization
- Agents cluster, link, and prioritize in the background
- You review surfaced findings when you're ready
- You act on priorities, not hunt for them

---

### Scenario 1: Frictionless Capture (Web App)

**You just got off a call. Press `N` (or tap `+` on mobile). Blank page. Start typing:**

> Just wrapped with Sarah. She's worried about the Q2 deadline but still thinks we can hit it if we cut the API redesign scope. Also, mobile app is now the priority. Need to update the roadmap doc before Friday.

**Hit Save.** Move on with your day — or stay and watch.

**If you leave:** Come back later and the note has been transformed. Your brain dump is gone. In its place: a clean, structured note titled "Sarah Meeting: Q2 Scope Decision" with organized sections, wiki links to [[API Redesign Scope]] and [[Q2 Roadmap]], and a detected action item (update roadmap by Friday).

**If you stay:** Watch the agent rewrite the note in real time. Your raw text morphs into structured content — headings appear, links materialize, action items surface. Like watching someone organize your desk while you sit there.

**Either way:** The note is the result, not the transcript. Your original brain dump is preserved in the conversation history (accessible via a "History" view), but the note itself is always the clean, cumulative output.

### Scenario 1b: Frictionless Capture (Voice via OpenClaw)

**You're in the car. Send a voice memo to OpenClaw:**

> _[30-second voice]_ "Just wrapped with Sarah. She's worried about the Q2 deadline but still thinks we can hit it if we cut the API redesign scope. Also, mobile app is now the priority. Need to update the roadmap doc before Friday."

**That's it.** No app to open, no folder to choose. Just think out loud and move on.

- Voice transcribed and stored as a note
- Agent processes it the same as any other note
- **User receives:** "Got it. 1 action item detected. Will surface in your Friday digest."

---

### Scenario 2: Background Organization

**During the week, you've dumped 15 captures:**

- 3 voice memos about various projects
- 2 screenshots of interesting articles
- 5 quick text thoughts via WhatsApp
- 1 email forward with feedback
- 4 meeting notes

**Every 6 hours, the organization heartbeat runs:**

1. **Clustering**: Groups captures about similar topics
   - 4 captures about "Q2 Roadmap" → clustered
   - 3 captures about "API concerns" → clustered
   - 2 captures about "Sarah 1:1s" → clustered

2. **Linking**: Connects related clusters
   - Q2 Roadmap ↔ API concerns (contradiction detected: timeline vs scope)
   - Sarah 1:1s ↔ Q2 Roadmap (decision maker relationship)

3. **Priority Detection**: Surfaces what needs attention
   - "Update roadmap by Friday" → action item, due soon
   - API scope mentioned 5 times → emerging priority
   - Sarah's concern mentioned 3 times → stakeholder attention needed

4. **Structure Created** (for your later review, not your immediate attention):
   ```
   Auto-Generated Collections:
   ├── Q2 Roadmap (4 captures, 1 action item)
   ├── API Design Discussion (3 captures, emerging theme)
   └── Sarah: Stakeholder Updates (2 captures, sentiment: concerned)
   ```

**No notifications.** No interruptions. The organization happens silently.

---

### Scenario 3: Review on Your Time (Weekly Digest)

**Friday evening, you open Gneiss for your weekly review:**

**The Dashboard Shows:**

```
This Week: 15 captures → 3 organized collections

Priority Actions (1):
• Update Q2 roadmap document (due today, from 3 captures)

Emerging Themes (2):
• API scope reduction (mentioned 5 times across 4 days)
• Stakeholder concern: Sarah on timeline (3 mentions, sentiment: worried)

New Connections Made:
• 12 auto-links created between related captures
• 1 contradiction flagged: "API redesign" vs "cut API scope"

Trends:
• You captured most on Tuesday (5 captures)
• Voice memos: 60% of input (consider voice-first workflow?)
```

**You:**

1. Click "Q2 Roadmap" collection → see 4 related captures organized chronologically
2. See the contradiction clearly flagged → decide: "Yes, we're cutting API scope"
3. Click action item → one-click generate updated roadmap from captures
4. Archive the collection as "resolved" or keep active for next week

---

### Scenario 4: Deep Dive (When You Need It)

**Two weeks later:** "What was Sarah's concern about the timeline?"

**Option A: Browse the organized structure:**

1. Navigate to "Sarah" collection (auto-generated from captures mentioning her)
2. See timeline of all Sarah-related notes
3. Filter by "concerns" sentiment → find the specific note
4. See it's linked to Q2 Roadmap, API scope, and 3 other related notes

**Option B: Open a new note and ask directly:**

Press `N`, type: "What were Sarah's concerns about Q2?" Hit Save.

Your question disappears. The note transforms into a clean summary:

> **Sarah's Q2 Concerns**
>
> Sarah expressed concern about the Q2 deadline in 3 notes between Jan 15-20. Main worry: API redesign scope. Her sentiment: worried but optimistic if scope is reduced.
>
> Sources: [[Sarah 1:1 Jan 15]], [[Q2 Roadmap Discussion]], [[API Scope Decision]]

Type `/ask Did we ever resolve the API scope question?` — the slash command disappears, and the note grows with the answer woven into the existing structure. Each interaction refines the note into a more complete research document.

**Option C: Ask OpenClaw via messaging** — same synthesis, delivered to WhatsApp/Telegram.

---

### Scenario 4b: Smart Routing (Not Everything is a New Note)

**You already have a grocery list note. You press N and type:**

> Also need milk and eggs from the store

**Hit Save.** The blank page doesn't become a new note. Instead: a toast appears — "Added to [[Grocery List]]" — and the blank page resets. The agent recognized the input belonged to an existing note and routed it there. Your grocery list now includes milk and eggs, woven into the existing structure.

**Or you type:**

> Archive all the quarterly review notes from last year

**Hit Save.** No note is created. The agent executes the workspace action. Toast: "Archived 12 notes from Q1-Q4 2025." The blank page resets. The action is logged in your activity history.

**Or you type:**

> I met with Sarah about Q2 scope and separately I had a design idea for the landing page

**Hit Save.** Two notes are created — [[Sarah Meeting: Q2 Scope]] and [[Landing Page Design Idea]]. You're navigated to the first. Toast: "Also created: [[Landing Page Design Idea]]."

**Or you type:**

> What time is it in Tokyo?

**The answer appears in the editor space.** No note is saved. It dismisses on next user input or after `8000ms` idle, then the blank page resets, ready for the next thought. Your note list isn't polluted with trivia.

---

### Scenario 5: Proactive Surfacing (Heads Up)

**Monday morning, Gneiss surfaces:**

```
Your Week Ahead (auto-surfaced):

Based on your captures, this week you mentioned:
• "Client presentation" 4 times → likely priority
• "Budget review" with a question mark → needs decision
• "Follow up with Alex" twice, no resolution → action item?

From Last Week:
• You said you'd "update roadmap by Friday" → completed
• "Need to research competitors" → no captures since → remind?

Pattern Detected:
• You capture most on Monday/Tuesday, then drop off.
• Consider: mid-week check-in prompt?
```

**You:** Can ignore, click for details, or reply "remind me Wednesday about competitors" → scheduled.

---

### Scenario 6: The Full Loop (Week in Review)

**How a typical week flows:**

| Day | You Do                                                                  | Agents Do                              |
| --- | ----------------------------------------------------------------------- | -------------------------------------- |
| Mon | Voice memo about project X                                              | Transcribe, extract entities           |
| Tue | Screenshot + quick text about same project                              | Cluster with Monday's capture          |
| Wed | Meeting notes mentioning project X again                                | Link all 3, detect emerging priority   |
| Thu | Quick thought about unrelated topic                                     | Start new cluster                      |
| Fri | **Review dashboard** → see Project X has 3 captures, click to organize  | Surface findings, suggest action items |
| Sat | **Act on surfaced priority** → generate proposal from captured thoughts | Archive cluster as "in progress"       |

**Result:** 10 seconds to capture, 5 minutes to review, organized output ready to use.

---

### Key UX Principles in Practice

1. **The blank page is the only input surface**
   - No floating input bars, no chat panels, no separate capture widgets
   - Every note starts as a blank page — brain dump, query, or conversation
   - One "Save" button; agent infers intent

2. **The note is the result, not the transcript**
   - User prompts are consumed by the agent and replaced with organized output
   - Slash commands disappear after processing; new content is folded into the note logically
   - The note always looks like a clean document — never a chat log
   - The raw conversation (every prompt, every agent action) is preserved in a "History" view underneath
   - The knowledge graph builds itself through wiki links the agent inserts

3. **Capture is instant, organization is invisible**
   - No loading states during capture
   - No "processing..." spinners
   - User never waits for organization

4. **Structure is browsable, not required**
   - Auto-generated collections are there if you want them
   - You can ignore the structure and just review digests
   - But you can also dive deep when needed

5. **Push, not pull**
   - System surfaces what needs attention
   - User decides when to review
   - No "inbox zero" anxiety

---

## Feature Roadmap

The roadmap follows the three-layer architecture: **CAPTURE → ORGANIZE → SURFACE**

### Phase 1: Capture Layer

**Goal:** Frictionless input from any device, zero organization required

- [ ] **Cloudflare backend:** Workers + Hono router + D1 database + Durable Object agents
- [ ] **Agent framework:** `agents` SDK with AIChatAgent for streaming conversations
- [ ] **Auth:** `better-auth` backed by D1/KV
- [ ] **Blank page capture UI:** New note as primary input surface
  - Full-screen blank page with "Save" button
  - `N` key shortcut (desktop), `+` button (mobile top bar)
  - `Cmd+K` command palette (first option: new note)
  - Agent infers intent from content (note vs. query)
- [ ] **Note-as-result model:** Agent rewrites/extends notes on each interaction
  - User input consumed and replaced with organized output
  - Slash commands (`/ask`, `/research`, `/link`, `/summarize`) disappear after processing; freeform `/...` runs only when the slash token is unknown to editor formatting commands
  - Agent folds new content into existing note structure logically
  - Real-time content morphing animation when user stays to watch
  - Resumable streaming — if connection drops mid-rewrite, reconnects and continues
- [ ] **Conversation history:** Git-log-style "History" view per note
  - Preserves every raw user prompt and agent action
  - Version revert support
  - Secondary view, never the default
  - Stored automatically by AIChatAgent in per-note DO SQLite
- [ ] **Schema:** D1 `notes` table (cross-note queryable)
  - id, user_id, title, summary, tags, content_hash, created_at, updated_at, processed
- [ ] **OpenClaw ingest:** `POST /api/openclaw/ingest` — receive raw messages
  - Store as notes, not separate captures
  - Return immediate confirmation ("Got it")
  - No blocking organization during capture
- [ ] **Voice transcription:** Store raw transcripts alongside notes
- [ ] **Multi-source capture:** Web app blank-page, email forwarding, screenshots

### Phase 2: Organization Layer (Background Processing)

**Goal:** Async agent processing that clusters, links, and structures captures

- [ ] **OrganizationAgent heartbeat:** Scheduled every 6 hours via `this.schedule()`
  - Query unprocessed notes from D1
  - Extract: entities, facts, sentiment, action items, deadlines
  - Create/update collections (auto-generated clusters)
  - Mark notes as processed
  - Uses AgentWorkflow for durable multi-step execution with per-step retry
- [ ] **Clustering engine:** Group related captures
  - Entity overlap (people, projects, topics mentioned)
  - Keyword + structured overlap first (launch default)
  - Temporal proximity (same-day captures)
  - Optional semantic similarity (Vectorize embeddings) when enabled
- [ ] **Linking engine:** Connect collections
  - Cross-reference entities between collections
  - Detect contradictions (same topic, different claims)
  - Track emerging themes (topic mentioned 3+ times)
- [ ] **Facts extraction:** Pull durable facts from captures
  - Store in D1 `facts` table with metadata (source note, confidence, timestamp)
  - Link facts to collections
  - Track fact evolution (superseded_by pattern)
- [ ] **Tacit knowledge layer:** Learn user patterns
  - Communication preferences (voice vs text, verbosity)
  - Capture habits (when, how, what topics)
  - Decision patterns (how user resolves contradictions)

### Phase 3: Surfacing Layer (Review & Action)

**Goal:** Digest-style summaries and browsable collections, not search

- [ ] **Review dashboard:** Weekly digest view
  - Stats: captures this week, collections created, connections made
  - Priority actions (detected action items with deadlines)
  - Emerging themes (trending topics)
  - Contradictions flagged (requires user decision)
- [ ] **Collections browser:** View auto-generated structure
  - Timeline view: captures chronologically
  - Collection view: clustered by topic
  - Entity view: all captures mentioning a person/project
  - Filter by: date range, sentiment, action items
- [ ] **Action workflow:** Convert surfaced items to output
  - One-click generate document from collection
  - Export to PDF, copy to clipboard, share via OpenClaw
  - Mark as "resolved" to archive collection
- [ ] **Query interface:** Ask questions, get synthesized answers
  - "What were Sarah's concerns?" → surfaced findings, not raw search
  - Natural language queries over organized collections
  - Citations link back to source captures

### Phase 4: OpenClaw Integration (Ambient Interface)

**Goal:** Capture and query without opening the app

- [ ] **Capture via messaging:**
  - Voice memos → transcribed → stored as captures
  - Quick texts → stored immediately
  - Confirmations: "Got it. 1 action item detected."
- [ ] **Query via messaging:**
  - "What did I say about the API?" → summary response
  - "Show me this week's captures" → digest link
  - "Remind me about X" → scheduled reminder
- [ ] **Proactive pushes:**
  - Daily: "3 captures organized today"
  - Weekly: digest summary with priorities
  - Urgent: "Action item due tomorrow: update roadmap"
- [ ] **Auth & security:**
  - Token-based OpenClaw authentication
  - Scoped permissions (capture-only vs full access)

### Phase 5: Intelligence & Refinement

**Goal:** Smarter organization, less user intervention

- [ ] **Memory decay:** Hot/Warm/Cold fact tiers
  - Access tracking on collections
  - Recency-weighted surfacing
  - Cold collections archived but searchable
- [ ] **Contradiction resolution:** User teaches agent their logic
  - When flagged, user clarifies which capture is correct
  - Agent learns user's decision patterns
  - Future contradictions auto-resolved based on past choices
  - Uses AgentWorkflow with `waitForApproval()` for human-in-the-loop
- [ ] **Predictive surfacing:** Surface before user asks
  - "You're meeting Sarah today — here's what you last said about the project"
  - Calendar integration: pre-surface relevant captures
- [ ] **Collaboration:** Shared collections
  - Invite others to view specific collections
  - Comments/annotations on captures
  - Shared fact base (team knowledge)

### Phase 6: Scale & Platform

**Goal:** Robust, fast, accessible everywhere

- [ ] **Performance:**
  - Parallel heartbeat processing
  - Incremental collection updates (don't reprocess everything)
  - Optimized vector search for large capture volumes
  - DO hibernation for cost-efficient idle notes
- [ ] **Mobile PWA:**
  - Capture-first mobile UI
  - Offline capture with sync
  - Quick review dashboard
- [ ] **Data portability:**
  - Export: captures, collections, facts as markdown/JSON
  - Import from Obsidian, Notion (as raw captures to be organized)
  - API for third-party integrations
  - D1 is SQLite, R2 is S3-compatible — data is portable
- [ ] **Monetization:**
  - Free tier: limited captures, basic organization
  - Pro: unlimited captures, advanced clustering, collaboration
  - Usage-based: pay for processing/heavy AI usage

---

## Technical Implementation

### D1 Schema (Source of Truth)

```sql
-- ==================== LAYER 1: NOTES (The Result) ====================

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  tags TEXT, -- JSON array
  content_hash TEXT,
  source TEXT DEFAULT 'web', -- 'web', 'openclaw_text', 'openclaw_voice', 'email_forward'
  source_message_id TEXT,
  dedupe_key TEXT,
  processed INTEGER DEFAULT 0,
  processed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_notes_user ON notes(user_id);
CREATE INDEX idx_notes_user_processed ON notes(user_id, processed);
CREATE INDEX idx_notes_user_updated ON notes(user_id, updated_at DESC);
CREATE UNIQUE INDEX idx_notes_dedupe ON notes(user_id, dedupe_key);

-- ==================== LAYER 2: ORGANIZE (Structured Output) ====================

CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  status TEXT DEFAULT 'active', -- 'active', 'archived'
  first_capture_at INTEGER,
  last_capture_at INTEGER,
  last_accessed_at INTEGER,
  access_count INTEGER DEFAULT 0
);
CREATE INDEX idx_collections_user ON collections(user_id);
CREATE INDEX idx_collections_user_status ON collections(user_id, status);

CREATE TABLE collection_notes (
  collection_id TEXT NOT NULL REFERENCES collections(id),
  note_id TEXT NOT NULL REFERENCES notes(id),
  PRIMARY KEY (collection_id, note_id)
);

CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'person', 'project', 'company', 'topic'
  summary TEXT,
  first_mentioned_at INTEGER,
  last_mentioned_at INTEGER,
  mention_count INTEGER DEFAULT 0
);
CREATE INDEX idx_entities_user ON entities(user_id);
CREATE INDEX idx_entities_user_type ON entities(user_id, type);

CREATE TABLE facts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  entity_id TEXT REFERENCES entities(id),
  fact TEXT NOT NULL,
  category TEXT, -- 'relationship', 'milestone', 'status', 'preference'
  source_note_id TEXT REFERENCES notes(id),
  timestamp INTEGER,
  status TEXT DEFAULT 'active', -- 'active', 'superseded'
  superseded_by TEXT REFERENCES facts(id),
  confidence REAL DEFAULT 1.0
);
CREATE INDEX idx_facts_user_entity ON facts(user_id, entity_id);
CREATE INDEX idx_facts_user_status ON facts(user_id, status);

CREATE TABLE note_links (
  from_note_id TEXT NOT NULL REFERENCES notes(id),
  to_note_id TEXT NOT NULL REFERENCES notes(id),
  link_type TEXT, -- 'wiki_link', 'related', 'contradiction', 'dependency'
  confidence REAL DEFAULT 1.0,
  PRIMARY KEY (from_note_id, to_note_id, link_type)
);

CREATE TABLE action_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  note_id TEXT REFERENCES notes(id),
  description TEXT NOT NULL,
  deadline INTEGER,
  status TEXT DEFAULT 'pending', -- 'pending', 'completed'
  detected_at INTEGER,
  completed_at INTEGER
);
CREATE INDEX idx_actions_user ON action_items(user_id);
CREATE INDEX idx_actions_user_status ON action_items(user_id, status);

-- ==================== LAYER 3: USER PREFERENCES (Tacit Knowledge) ====================

CREATE TABLE user_preferences (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  category TEXT, -- 'communication', 'workflow', 'organization'
  preference TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  detected_at INTEGER
);
CREATE INDEX idx_prefs_user ON user_preferences(user_id, category);

-- ==================== SYSTEM TABLES ====================

CREATE TABLE openclaw_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  permissions TEXT, -- JSON array: ['capture', 'query', 'push']
  created_at INTEGER,
  last_used_at INTEGER
);
CREATE INDEX idx_tokens_token ON openclaw_tokens(token);

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent TEXT,
  action TEXT,
  note_id TEXT,
  timestamp INTEGER,
  details TEXT -- JSON
);
CREATE INDEX idx_audit_user ON audit_logs(user_id, timestamp DESC);
```

### Per-Note DO SQLite (Co-located in RewriteAgent)

Each note's RewriteAgent DO automatically stores:

- **Conversation history** — managed by AIChatAgent (`cf_ai_chat_agent_messages` table)
- **Stream chunks** — for resumable streaming (auto-managed)
- **Note versions** — custom table for revert support:
  ```sql
  CREATE TABLE note_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    title TEXT,
    created_at INTEGER NOT NULL
  );
  ```

### OpenClaw HTTP Endpoints

```typescript
// Hono router on Workers

const app = new Hono<{ Bindings: Env }>();

// CAPTURE: Fast, non-blocking. Store raw, organize later.
app.post("/api/openclaw/ingest", async (c) => {
	const { token, message, messageType, audioUrl } = await c.req.json();

	// Validate token
	const connection = await c.env.DB.prepare("SELECT * FROM openclaw_tokens WHERE token = ?")
		.bind(token)
		.first();
	if (!connection?.permissions?.includes("capture")) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	// Create note in D1
	const noteId = crypto.randomUUID();
	await c.env.DB.prepare(
		"INSERT INTO notes (id, user_id, content_hash, source, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
	)
		.bind(
			noteId,
			connection.user_id,
			"",
			messageType === "voice" ? "openclaw_voice" : "openclaw_text",
			Date.now(),
			Date.now(),
		)
		.run();

	// Notify IndexAgent for reactive sidebar update
	const index = getAgentByName(c.env.INDEX_AGENT, connection.user_id);
	await index.noteUpdated({
		id: noteId,
		title: "",
		summary: message.slice(0, 100),
		updatedAt: Date.now(),
	});

	return c.json({
		status: "captured",
		noteId,
		message: "Got it. Will organize and surface in your next digest.",
	});
});

// QUERY: Return synthesized findings, not raw notes
app.post("/api/openclaw/query", async (c) => {
	const { token, query } = await c.req.json();
	// ... validate, synthesize, return summary
});

// DIGEST: Request summary
app.post("/api/openclaw/digest", async (c) => {
	const { token, period } = await c.req.json();
	// ... validate, generate digest, return
});

// Agent routing
app.all("/agents/*", (c) => routeAgentRequest(c.req.raw, c.env));

export default app;
```

### Agent Architecture

```
IndexAgent          (1 per user)   — reactive cross-note index, broadcasts to all tabs
RouterAgent         (1 per user)   — input classification + routing decisions
RewriteAgent        (1 per note)   — AIChatAgent: conversation, streaming, note morphing
OrganizationAgent   (1 per user)   — background clustering, linking, extraction
SurfacingAgent      (1 per user)   — query synthesis, digests
```

### React Integration

```tsx
import { useAgent, useAgentChat } from "agents/react";

function App({ userId }) {
	// Global reactivity: sidebar, note list, collections, action items
	const index = useAgent<IndexState>({
		agent: "IndexAgent",
		name: userId,
		onStateUpdate: (state) => {
			/* re-render sidebar */
		},
	});

	return (
		<Layout
			sidebar={<Sidebar notes={index.state?.notes} collections={index.state?.collections} />}
			editor={<NoteEditor userId={userId} noteId={activeNoteId} />}
		/>
	);
}

function NoteEditor({ userId, noteId }) {
	// Per-note reactivity: content, streaming, conversation history
	const agent = useAgent({ agent: "RewriteAgent", name: `${userId}:${noteId}` });
	const chat = useAgentChat({ agent, resume: true });

	// chat.messages = full conversation history (auto-persisted in DO)
	// chat.append() triggers agent rewrite → streams back to client
	// Resumable: if connection drops mid-stream, reconnects and continues
}
```

---

## Open Questions

### Product

1. **Organization frequency?** — Real-time vs. batch? Every 6 hours vs. daily?
2. **Collection ownership?** — Can users rename/delete auto-generated collections, or just archive?
3. **Contradiction resolution UI?** — How to present conflicting captures for user decision?
4. **Surfacing noise floor?** — How many captures before a collection surfaces? (3? 5? Variable?)
5. **Data portability?** — Export captures+collections+facts as markdown bundle?

### Technical

1. **Clustering algorithm?** — HDBSCAN vs. simple threshold on embeddings vs. entity overlap?
2. **Heartbeat scale?** — Per-user scheduled job or global batch processor?
3. **LLM costs?** — Organization layer is AI-heavy; how to cap costs per user?
4. **Vector index strategy (optional enhancement)?** — If vectors are enabled, one Vectorize index for notes + collections, or separate?
5. **OpenClaw protocol?** — Webhook for capture, but what about proactive pushes?
6. **Vectorize maturity (optional enhancement)?** — If vectors are enabled post-launch, are they production-ready for our embedding dimensions? Evaluate Turbopuffer as alternative.
7. **D1 row limits?** — 10GB per database. Fine for single-user; at scale, may need per-user D1 databases.
8. **DO cold start latency?** — ~50-100ms for hibernated DOs. Test with full agent initialization.

### Security

1. **Capture verification?** — How to verify OpenClaw capture authenticity?
2. **Data retention?** — Keep raw captures forever, or purge after processing?
3. **Collection privacy?** — Are collections user-private or can they be shared selectively?

---

## Next Steps

### Phase 1: Capture Layer

1. **Set up Cloudflare project** — Hono + Workers + D1 + agents SDK + wrangler.jsonc
2. **Build RewriteAgent** (extends AIChatAgent) — core note morphing interaction with resumable streaming
3. **Build IndexAgent** — reactive note index, WebSocket broadcast to all tabs
4. **Build RouterAgent** — input classification, routing taxonomy
5. **Create D1 schema** — notes, entities, facts, collections
6. **Build blank-page capture UI** — Full-screen new note with "Save" button, `N` key / `+` button shortcuts
7. **Build command palette** — `Cmd+K`, first option "New note"
8. **Test capture flow** — Web app blank page → Save → Router → RewriteAgent → stream to client

### Phase 2: Organization Layer

1. **Build OrganizationAgent** — scheduled heartbeat via `this.schedule()`
2. **Build OrganizeWorkflow** — durable multi-step pipeline with per-step retry
3. **Implement entity/fact extraction** — Detect people, projects, topics
4. **Create clustering logic** — Group related notes via entity/keyword overlap first; add Vectorize embeddings only when enabled
5. **Build collection creation** — Auto-generate from clusters, write to D1
6. **Test full loop** — Capture → Heartbeat → Collection created → IndexAgent notified

### Phase 3: Surfacing Layer

1. **Build review dashboard** — Weekly digest view
2. **Implement query synthesis** — Answer questions with collections
3. **Add collections browser** — View/browse auto-generated structure
4. **Create action items view** — Surface detected tasks
5. **Test end-to-end** — Capture → Organize → Review via web + OpenClaw

---

_Last updated: February 2026_
