# User Stories: Gneiss

> **Purpose:** Define the types of users, their motivations, and the exact workflows we're supporting.

---

## Table of Contents

1. [[#Personas]]
2. [[#Core User Flows]]
3. [[#Detailed Scenarios]]
4. [[#Success Metrics per Persona]]

---

## Personas

### 1. **The Product Manager (PM)**

**Profile:**

- Runs cross-functional projects; constantly in meetings and on calls
- Takes notes everywhere (phone, laptop, during calls) but never reviews them
- Drowns in Slack, email, meeting notes; loses context between sessions
- Wants to surface emerging priorities without hunting for them

**Primary Pain:**

- "I captured it somewhere, but can't find it"
- "I'm noticing a pattern (deadline pressure, stakeholder concern) but not systematically"
- "By Friday, I've forgotten what was urgent on Monday"

**Core Need:**

- Lightweight capture (voice memo, quick text, screenshot)
- Auto-organization without adding overhead
- Proactive digest: "Here's what surfaced this week that needs your attention"

---

### 2. **The Researcher / Knowledge Worker**

**Profile:**

- Spends time reading, exploring, synthesizing (writers, analysts, engineers, designers)
- Collects articles, tweets, ideas, snippets scattered across tools
- Wants to build connections over time (what did I read about X three weeks ago?)
- Values having a "second brain" they can query

**Primary Pain:**

- "I read something relevant but can't remember where"
- "These three ideas feel related but I haven't linked them"
- "Building something from scratch when I know I've thought about it before"

**Core Need:**

- Screenshot + text capture workflow
- Searchable, linkable, structured (not just a pile)
- Able to query knowledge from any device

---

### 3. **The Ambient Worker (via OpenClaw)**

**Profile:**

- Always on messaging (WhatsApp, Telegram, Slack)
- Captures thoughts where they already are (chat)
- Doesn't want to switch to a new app
- Wants results delivered back to the chat interface

**Primary Pain:**

- "Opening Gneiss is friction; I'm already in WhatsApp"
- "I capture in chat but never review it elsewhere"
- "I want to ask my assistant a question via messaging"

**Core Need:**

- Voice memo capture via WhatsApp/Telegram
- Quick response (not blocking)
- Digest surfacing + query answering via messaging

---

## Core User Flows

### Flow 1: CAPTURE (Friction-Free)

**Initiating Actor:** Any user  
**Duration:** <30 seconds

```
User has a thought / attends a meeting / reads something interesting
    ↓
Press N (desktop) or tap + (mobile) → blank page, cursor blinking
    ↓
Brain dump: type, paste, whatever. No title, no folder, no tags.
    ↓
Hit Save (or Cmd+Enter)
    ↓
Agent consumes the input. The brain dump is replaced with organized output.
User's raw text is preserved in conversation history, not on the note surface.
    ↓
User: Leave (come back to finished note) or stay (watch the note morph in real time)
```

**Alternative capture methods:**

- Voice memo via OpenClaw (WhatsApp/Telegram) → stored as note → agent rewrites
- Screenshot attached to note
- Email forward → stored as note → agent rewrites

**Success Criteria:**

- Blank page appears in <200ms after N/+ press
- No folders, tags, or categories required
- One button ("Save") — no choice between save and send
- User's raw input is consumed and replaced with clean output
- Raw input always preserved in conversation history for later reference

---

### Flow 1b: REFINE (Slash Commands Within Notes)

**Initiating Actor:** Any user  
**Duration:** Ongoing, within a single note

```
User has a note (the clean result of previous interactions)
    ↓
User types a slash command on a new line:
  /ask What did I say about this last month?
  /research passwordless authentication patterns
  /link (agent finds and inserts relevant wiki links)
  /summarize (agent condenses the note)
  / [natural language instruction] (only when slash token is unknown to editor formatting commands)
    ↓
The slash command disappears. The agent rewrites/extends the note:
  • New content is folded into the existing structure logically
  • The note may restructure itself (new headings, reordered sections)
  • Wiki links to other notes are inserted where relevant
  • The note is always a clean, unified document
    ↓
User sees:
  • The note, updated. No chat artifacts, no "agent" labels.
  • The note looks like it was always this comprehensive.
  • Raw slash command preserved in conversation history only.
```

**Success Criteria:**

- Slash command triggers note rewrite within 1-2 seconds (streaming)
- Agent has full context: current note + conversation history + broader knowledge base
- Slash command text disappears from the note surface
- New content is integrated, not appended — note may restructure
- Note always looks like a clean, human-written document
- Conversation history preserves every interaction for transparency

---

### Flow 1c: ROUTE (Agent Decides Where Content Goes)

**Initiating Actor:** Agent (after user hits Save)  
**Duration:** <1 second for routing decision

```
User hits Save on the blank page
    ↓
Router Agent classifies input against:
  • Existing note titles, summaries, tags
  • User preferences / meta-instructions
  • Input structure and language patterns
    ↓
Routing decision (one of):
  a) new_note → Rewrite Agent creates new note (default path)
  b) update_existing → Rewrite Agent updates target note, user navigated there
  c) split → Multiple notes created, user sees primary, toast lists others
  d) fan_out → New note + background updates to existing notes
  e) workspace_action → Action executed, toast, blank page resets
  f) ephemeral_answer → Temporary answer shown until next user input or `8000ms` idle timeout, no note saved
  g) store_preference → Preference saved, toast, blank page resets
  h) correction → Existing note fact updated, toast
  i) duplicate → Redundancy flagged, link to existing note
    ↓
Blank page either:
  • Transforms into a note (routes a, c, d)
  • Navigates to an existing note (routes b, h)
  • Resets to empty (routes e, f, g, i)
```

**Success Criteria:**

- Routing decision resolves in <1 second
- User never has to choose the route — agent decides
- Existing notes are updated rather than duplicated when appropriate
- Workspace actions execute without creating unnecessary notes
- Ephemeral answers don't pollute the note list

---

### Flow 2: ORGANIZE (Background, Async)

**Initiating Actor:** System (scheduled heartbeat)  
**Frequency:** Every 6 hours (configurable)  
**Duration:** Minutes to hours (background)

```
Heartbeat triggers → Collects new unprocessed captures
    ↓
Agent Core processes each capture:
  • Extract entities (people, projects, topics)
  • Detect action items and deadlines
  • Identify sentiment and urgency
  • Generate embedding for semantic search
    ↓
Clustering & Linking:
  • Group similar captures into collections
  • Link related collections (e.g., "Q2 Roadmap" ↔ "API Concerns")
  • Detect contradictions (same entity, conflicting facts)
    ↓
Persist collection structure (for later review, not immediate)
```

**Success Criteria:**

- Organization is non-blocking (doesn't slow capture)
- No user interaction required during org phase
- Captures linked within relevant topical collections
- Contradictions flagged (not auto-resolved)

---

### Flow 3: SURFACE (Pull, Not Push)

**Initiating Actor:** User (weekly digest view OR query)  
**Duration:** On user's schedule

```
User opens Gneiss dashboard OR requests digest via OpenClaw
    ↓
System surfaces:
  • 3-5 action items (detected deadlines, tasks)
  • 2-3 emerging themes (topics mentioned 5+ times)
  • 1-2 contradictions needing resolution
  • Related collections when relevant
    ↓
Citations included:
  • Which collection each finding came from
  • When it was captured
  • Who was involved
    ↓
User action:
  • Review action items (mark done, snooze, ignore)
  • Dive into a collection for full context
  • Browse timeline for raw captures
  • Mark collections as resolved/archived
```

**Success Criteria:**

- Digest is curated (not a firehose of all captures)
- User finds something they'd forgotten about
- Collections feel semantically coherent
- User can drill down to see the "why" (citations, raw captures)

---

### Flow 4: ACT (User Takes Ownership)

**Initiating Actor:** User  
**Output:** External artifact or decision

```
User reviews surfaced findings
    ↓
User decides:
  • "I need to write up the Q2 roadmap update" → Opens collection, exports as doc
  • "Sarah and I disagree on API scope" → Marks contradiction, pins for meeting
  • "Mobile is now the priority" → Creates action item, sets deadline
  • "I've handled this" → Archives collection
    ↓
Optional: User can override agent decisions:
  • "This doesn't belong here" → Move capture to different collection
  • "This is wrong" → Supersede a fact
  • "This should be higher priority" → Rerank
```

**Success Criteria:**

- User feels ownership over the organization
- Can act on findings outside the app (export, share, etc.)
- Can override agent decisions when wrong

---

## Detailed Scenarios

### Scenario A: "Frictionless Capture + Living Note" (PM)

**Context:** Product Manager just left a meeting with Sarah. Opens Gneiss, presses N.

```
PM: [Types on blank page]
    "Just wrapped with Sarah. She's worried about Q2 deadline but we can hit it
     if we cut API redesign scope. Mobile app is now the priority. Need to update
     the roadmap before Friday."

PM: Hits Save.

The brain dump disappears. The note transforms into:

  # Sarah Meeting: Q2 Scope Decision

  Sarah is concerned about the Q2 deadline but believes it's achievable
  if API redesign scope is reduced. Mobile app is now the top priority.

  ## Related Context
  - [[API Redesign Scope]] — David considers scope negotiable
  - [[Q2 Roadmap]] — 4 other notes this week

  ## Action Items
  - [ ] Update roadmap document (due Friday)

PM can leave now (note is done) or dig deeper:

  PM types: /ask What did David say about the API scope?

  The slash command disappears. The note restructures:

  # Sarah Meeting: Q2 Scope Decision

  Sarah is concerned about the Q2 deadline...

  ## Conflicting Positions
  - **Sarah (Engineering):** API redesign is non-negotiable
  - **David (CEO):** "Ship mobile by Q2; scope the API if needed"
    ([[David 1:1 Jan 15]])

  ## Action Items
  - [ ] Update roadmap document (due Friday)
  - [ ] Resolve Sarah/David conflict on API scope

The note grew and restructured. "Related Context" became
"Conflicting Positions" because the agent recognized the tension.
The PM's raw brain dump and slash commands are in History view.
```

**Value:** Zero friction capture. The note is always the clean result. The PM never has to organize, structure, or hunt for context — the agent does it. Each interaction makes the note more complete.

---

### Scenario A2: "Smart Routing" (PM)

**Context:** PM has a running [[Action Items]] note. Types into a new blank page:

```
PM: "Also need to schedule the design review with Alex before end of month"

Agent routes: update_existing → [[Action Items]]

PM sees: Toast "Added to [[Action Items]]", blank page resets.
The action items note now includes "Schedule design review with Alex (due end of month)."

Later, PM types: "Actually, the Sarah meeting is Wednesday not Friday"

Agent routes: correction → [[Sarah Meeting: Q2 Scope Decision]]

PM sees: Toast "Updated [[Sarah Meeting: Q2 Scope Decision]]"
The deadline in that note is now Wednesday.
```

**Value:** The user doesn't have to navigate to the right note, open it, find the right section, and edit. They just say what they need from the blank page and the agent handles the rest.

---

### Scenario B: "Research → Synthesis" (Researcher)

**Context:** Researcher reading about a new authentication pattern. Wants to connect it to past research.

```
Day 1: Researcher screenshots article about "passwordless auth", pastes into Gneiss with "interesting for our auth redesign"
Day 2: Researcher screenshots blog post about "biometric security", pastes again
Day 3: Researcher reads whitepaper on "zero-knowledge proofs", pastes

By Day 4 (next heartbeat):
- Agent clusters all 3 → "Authentication: Emerging Patterns" collection
- Agent detects entity: "passwordless auth" (3 mentions, new topic)
- Agent finds related collection from 2 months ago: "Auth System Redesign"
- Links the two: "Emerging patterns relevant to current redesign scope"

Researcher: Opens Gneiss, sees "Auth System Redesign" has new related captures
          Clicks to "Emerging Patterns" collection, sees all 3 sources together
          Exports as markdown with citations, writes summary doc
```

**Value:** No manual linking. No folder hierarchy. Just capture → search → synthesis.

---

### Scenario C: "Contradiction Detection" (PM + Stakeholders)

**Context:** PM captures contradictory feedback from two stakeholders about scope.

```
Week 1:
- Sarah (Engineering Lead): "API redesign is non-negotiable; can't skip it"
- David (CEO): "We need to ship mobile app by Q2; scope the API if needed"

Agent (during heartbeat):
- Extracts facts:
  * Sarah: "API redesign is required"
  * David: "API scope is negotiable"
- Detects contradiction: Same topic (API scope), conflicting requirements, time proximity
- Creates decision task: "Contradiction: API scope requirement. Sarah vs David. Last mentioned: today."

PM (Friday digest):
- Sees: "1 contradiction detected: API scope — conflicting viewpoints"
- Clicks → sees both quotes, dates, who said what
- Uses this in Monday 1:1 with Sarah to resolve

```

**Value:** Agent surfaces problems early. PM doesn't have to notice the conflict manually.

---

### Scenario D: "Always-On Query" (Ambient Worker via OpenClaw)

**Context:** User at a coffee shop, wants to remember something without opening Gneiss.

```
User (via WhatsApp): "What did I say about the auth system?"

OpenClaw → Gneiss: Calls /openclaw/query endpoint

Gneiss Agent:
- Searches "Auth System" collections
- Synthesizes findings from latest 5 captures in that area
- Surfaces action items related to auth
- Cites specific collections and dates

Response (via WhatsApp):
"Based on your notes:
- Auth redesign is in scope for Q2 (Sarah's requirement)
- Considering passwordless + zero-knowledge approaches
- Action: Design decision needed by Jan 31

Collections: 'API Redesign Scope', 'Passwordless Auth', 'Zero-Knowledge Proofs'
Reply 'details' for full context."
```

**Value:** Query answered from the chat interface. No app switching. Results are synthesized, not raw captures.

---

## Success Metrics per Persona

### PM: Capture → Remember → Act

| Metric                      | Target                                                   |
| --------------------------- | -------------------------------------------------------- |
| **Capture friction**        | <10 seconds per capture (voice/text/screenshot)          |
| **Capture-to-collection**   | 80% of captures auto-linked to a collection within 24h   |
| **Digest value**            | PM finds ≥1 item per week they'd forgotten about         |
| **Action item accuracy**    | ≥90% of detected deadlines are real (no false positives) |
| **Contradiction surfacing** | Avg 1-2 contradictions/month caught that PM missed       |
| **Digest review frequency** | ≥3x per week user opens digest or dashboard              |

---

### Researcher: Collect → Link → Synthesize

| Metric                       | Target                                                      |
| ---------------------------- | ----------------------------------------------------------- |
| **Collection coherence**     | ≥80% of captures in a collection feel thematically related  |
| **Cross-collection linking** | ≥50% of collections have ≥1 link to other collections       |
| **Search success**           | User finds what they searched for in top 3 results          |
| **Export utility**           | User exports findings for external synthesis (markdown doc) |
| **Repeat queries**           | Same query not needed twice (collection structure sticky)   |

---

### Ambient Worker (OpenClaw): Capture + Query from Chat

| Metric                   | Target                                                      |
| ------------------------ | ----------------------------------------------------------- |
| **Capture via OpenClaw** | Voice/text message → stored within 5 seconds                |
| **Query latency**        | Question asked → answer synthesized within 10 seconds       |
| **Chat-native workflow** | User never opens Gneiss app; operates entirely via WhatsApp |
| **Digest delivery**      | Optional daily/weekly digests pushed to OpenClaw            |

---

## Not in Scope (Initial)

These user flows are **explicitly not supported** in Phase 1-3:

- **Collaboration:** Sharing collections with teammates
- **Real-time sync:** Mobile editing while offline, then sync on reconnect
- **Native apps:** Separate iOS/Android codebases (PWA instead)
- **Calendar integration:** Task management, deadline sync with Google Calendar
- **Email capture:** Auto-ingest from forwarded emails (only manual paste initially)
- **Full-text indexing:** Large-scale full-text search (semantic search first)

---

## Open Questions

1. **Organization frequency:** Is 6-hour heartbeat right, or should it be real-time/daily?
2. **Digest frequency:** Should digests be daily, weekly, or user-configurable?
3. **Collection naming:** Should users be able to rename auto-generated collections, or just archive them?
4. **Contradiction UI:** How to present conflicting captures in digest vs. detailed view?
5. **Priority threshold:** How many captures before a collection surfaces in digest? (3? 5? 10?)

---

_Last updated: February 2026_
