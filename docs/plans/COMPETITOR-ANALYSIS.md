# Competitor Analysis: Gneiss

> **Status:** Active  
> **Last Updated:** February 2026

---

## Table of Contents

1. [[#Executive Summary]]
2. [[#Market Map]]
3. [[#Detailed Competitor Profiles]]
   - [[#Obsidian (Native)]]
   - [[#Obsidian + Claude Code]]
   - [[#OpenClaw for Knowledge Management]]
   - [[#Notion]]
   - [[#Mem.ai]]
   - [[#Tana]]
   - [[#Bear]]
   - [[#Craft]]
   - [[#Capacities]]
   - [[#Reflect]]
   - [[#Roam Research]]
4. [[#Feature Comparison Matrix]]
5. [[#Pricing Comparison]]
6. [[#Where Gneiss Wins]]
7. [[#Positioning Strategy]]

---

## Executive Summary

The note-taking/PKM market splits into three tiers:

1. **Traditional note apps with AI bolted on** — Notion, Bear, Craft, Roam. AI is a feature, not the architecture.
2. **AI-native note apps** — Mem.ai, Tana, Reflect. AI is integrated but still user-initiated.
3. **DIY agent stacks** — Obsidian + Claude Code, OpenClaw + filesystem. Powerful but fragile, technical, desktop-only.

**Gneiss occupies a fourth position that doesn't exist yet: agent-first knowledge management.** The agent isn't a feature or a plugin — it's the core architecture. Notes are the _output_ of agent processing, not the input to it. No other product treats the agent as the primary organizer with the user as the reviewer.

The closest competitors are Mem.ai (has "Heads Up" proactive surfacing) and the Obsidian + Claude Code community (has the right workflow instincts but uses duct tape). Gneiss is what both of those are trying to be.

---

## Market Map

```
                    AGENT AUTONOMY
                         ^
                         |
        OpenClaw+FS  ●   |   ● GNEISS
        (fragile)        |   (purpose-built)
                         |
    Obsidian+Claude  ●   |   ● Mem.ai
    (duct-taped)         |   (partial)
                         |
              Tana   ●   |
              (user-     |
               configured)
                         |
 ─────────────────────────────────────────────> AI DEPTH
         Roam ●    Bear ●   |  Notion ●  Reflect ●
         (none)    (none)    |  (add-on)  (useful)
                             |
                    Craft ●  |  Capacities ●
                    (basic)  |  (moderate)
```

---

## Detailed Competitor Profiles

### Obsidian (Native)

**What it is:** Local-first markdown editor with 1,500+ community plugins. Closed-source app, open file format. ~8-person team, no investors, 100% user-supported.

**AI approach:** Zero native AI. All AI comes from community plugins:

| Plugin            | Stars | What it does                         |
| ----------------- | ----- | ------------------------------------ |
| Copilot           | 6.1k  | Chat with vault, agent mode, BYOM    |
| Smart Connections | 4.5k  | Semantic note linking via embeddings |
| Note Companion    | 791   | Auto-organize, transcribe, chat      |

**Pricing:**

| Tier                    | Cost                         |
| ----------------------- | ---------------------------- |
| Core app                | Free (personal + commercial) |
| Sync                    | $4-5/mo                      |
| Publish                 | $8-10/mo/site                |
| Catalyst (early access) | $25 one-time                 |

**Strengths:**

- Free and extremely powerful
- Local markdown files = true data ownership
- Plugin ecosystem is massive (1,500+)
- Graph view, backlinks, wiki links, Canvas
- Passionate community (r/ObsidianMD: 207k members)
- No vendor lock-in on data

**Weaknesses:**

- Closed-source app (contradicts "local-first" philosophy)
- No native AI — fragmented plugin experience
- AI plugins send notes to external APIs, undermining privacy promise
- Plugin security model trusts plugins implicitly
- Mobile experience is mediocre
- Sync is paid and proprietary
- Setup complexity grows with plugins

**How Gneiss compares:**

| Dimension           | Obsidian                        | Gneiss                                |
| ------------------- | ------------------------------- | ------------------------------------- |
| AI                  | Plugin (fragmented)             | Native (core architecture)            |
| Organization        | Manual (user creates structure) | Agent-driven (automatic)              |
| Capture friction    | Open app, choose folder, write  | Blank page, brain dump, Go            |
| Mobile              | Mediocre                        | Mobile-first PWA                      |
| Proactive surfacing | None                            | Digests, contradictions, action items |
| Data format         | Local markdown                  | Cloud (D1 SQLite + R2), exportable    |

**Gneiss advantage:** Obsidian users who want AI organization must install 3-5 plugins, configure API keys, and still get a fragmented experience. Gneiss is what Obsidian would be if the agent was built in from day one.

**Obsidian advantage:** Local files, massive plugin ecosystem, free, mature. Users who want full control and don't need AI will stay with Obsidian.

---

### Obsidian + Claude Code

**What it is:** A growing community pattern (~221 GitHub repos, ~9,000+ combined stars) where users connect the Obsidian markdown editor with Claude Code (Anthropic's CLI coding agent) for AI-powered knowledge management.

**Integration approaches (ranked by adoption):**

1. **Direct filesystem** — Point Claude Code at vault directory. Simple but dangerous.
2. **Claudian plugin** (1.9k stars) — Full embedded Claude Code sidebar with diff preview, @-mentions, skills, MCP support.
3. **MCP server** (2.8k stars for top repo) — Connects via Obsidian's Local REST API plugin. Structured tool access.
4. **Agent Client Protocol** (575 stars) — Supports Claude Code, Codex, Gemini CLI in one plugin.

**Popular workflows:**

| Workflow                | What it does                                             |
| ----------------------- | -------------------------------------------------------- |
| `/resume` + `/compress` | Session memory — load/save context across sessions       |
| `/daily-note`           | Morning routine → structured daily note                  |
| `/meeting-note`         | Transcript → structured frontmatter'd note               |
| `/weekly-review`        | Summarize week from daily notes                          |
| Auto-linking            | Agent wraps concepts in `[[wiki links]]`, graph explodes |
| Vault auditing          | Agent fixes broken links, files inbox items              |
| Voice → notes           | SuperWhisper → Claude → structured Obsidian note         |

**Pain points (from Reddit/GitHub):**

1. **Data destruction** — Claude can delete/overwrite private notes with filesystem access. No undo. Referenced: `anthropics/claude-code/issues/10577`.
2. **Session context fades** — The entire `/resume`/`/compress` pattern exists to work around ephemeral memory.
3. **No approval UI** — Unlike VS Code, Obsidian has no native diff/approve for AI changes. Claudian adds this but it's plugin-specific.
4. **Desktop only** — No mobile solution. Claudian explicitly says "Desktop only."
5. **Fragmented ecosystem** — 221 repos, 5+ approaches, no standard. Confusing for newcomers.
6. **CLI path issues** — Node version managers break Claude Code detection.
7. **Token cost** — Loading large vaults is expensive.

**Community sentiment:**

- Power users love it: "Write once, surface everywhere"
- Skeptics: "Creating notes with AI doesn't make sense — feels like delusory fudgel"
- Split: "use git for backup" vs "the risk is unacceptable"

**How Gneiss compares:**

| Dimension    | Obsidian + Claude Code            | Gneiss                                    |
| ------------ | --------------------------------- | ----------------------------------------- |
| Setup        | 3-5 tools, config files, API keys | One app                                   |
| Memory       | Ephemeral (hacked via /compress)  | Persistent (native thread history)        |
| Data safety  | Destructive (no undo)             | Version history (git-log for notes)       |
| Mobile       | None                              | Mobile-first PWA                          |
| Agent type   | Coding agent repurposed for KM    | Purpose-built knowledge agent             |
| Organization | User-configured slash commands    | Automatic (Router + Rewrite Agent)        |
| Approval UI  | None (or plugin-specific diff)    | Real-time note morphing with History view |
| Routing      | User decides where content goes   | Agent routes automatically                |

**Gneiss advantage:** Everything the Obsidian + Claude Code community has built manually — session memory, auto-linking, meeting note processing, weekly reviews, vault organization — is what Gneiss does natively. The `/compress`/`/resume` pattern is a workaround for lack of persistent memory. The data destruction risk is solved by conversation history with revert. The desktop-only limitation is solved by being a PWA. The fragmented 221-repo ecosystem is replaced by one integrated product.

**Obsidian + Claude Code advantage:** Full filesystem access means unlimited customization. Power users can build anything. The coding agent can generate diagrams, run scripts, interact with any tool. Gneiss's agent is scoped to knowledge management.

---

### OpenClaw for Knowledge Management

**What it is:** Open-source personal AI agent (144k GitHub stars, MIT license) by Peter Steinberger. Runs locally, connects AI to files, apps, and messaging. Not a knowledge management tool — it's a general-purpose agent that people _use_ for KM.

**KM-relevant capabilities:**

| Feature            | Description                                              |
| ------------------ | -------------------------------------------------------- |
| Persistent memory  | Markdown files: SOUL.md, IDENTITY.md, AGENTS.md, USER.md |
| Cron/heartbeat     | Scheduled jobs (cron expressions, intervals, one-shots)  |
| Skills             | ClawdHub registry, self-built skills, hot-reload         |
| Multi-channel      | WhatsApp, Telegram, Slack, Discord, iMessage, etc.       |
| Full system access | Shell, browser, files, calendar, email                   |

**How people use it for KM:**

1. **Daily briefings** — Morning summary: weather + calendar + news + sleep score. The #1 use case.
2. **Email triage → notes** — Gmail Pub/Sub triggers agent, summarizes/files emails.
3. **Automated research** — Cron-triggered research pipelines, saved to workspace files.
4. **Voice capture** — Voice note via Telegram → agent files into appropriate notes.
5. **Second brain** — Save links/notes/images; agent resurfaces useful info on demand.
6. **Business agent teams** — Multiple specialized agents, each with own cron jobs.

**The OpenClaw + Obsidian workflow:**

- Not a first-party integration. Agent has filesystem access to vault directory.
- Reads/writes markdown files directly. No Obsidian plugin side.
- Cron jobs trigger periodic organization/summarization.
- Messages via Telegram/WhatsApp → agent files into Obsidian notes.
- No bidirectional sync, no structured search, no version control.

**Pricing:** Free (MIT). Real cost is LLM API usage. Recommended: Claude Pro ($20/mo) or Max ($100-200/mo). Heavy KM use burns rate limits fast.

**Limitations as KM:**

- No structured knowledge graph — memory is flat markdown files
- No semantic search, no embeddings, no vector index
- No version control on memory files (agent overwrites)
- Search is LLM-bounded (agent reads files, not semantic retrieval)
- Requires always-on machine (Mac Mini, VPS)
- Full host access by default (security risk)
- Setup is CLI-first, requires technical comfort
- Agent behavior is unpredictable (one user's agent "started a fight with Lemonade Insurance" via email)

**How Gneiss compares:**

| Dimension           | OpenClaw KM                   | Gneiss                                              |
| ------------------- | ----------------------------- | --------------------------------------------------- |
| Memory model        | Flat markdown files           | Structured DB (notes, entities, facts, collections) |
| Search              | LLM reads files               | Vector + text + semantic hybrid                     |
| Organization        | Emergent (agent self-manages) | Designed (Router, Rewrite, Organization agents)     |
| Proactive surfacing | Cron jobs push to chat        | Digests, action items, contradiction detection      |
| Capture             | Messaging (WhatsApp/Telegram) | Web app + messaging (via OpenClaw bridge)           |
| Version control     | None                          | Conversation history with revert                    |
| Setup               | Self-hosted, CLI, LLM keys    | Hosted, one URL                                     |
| Cost                | Free + LLM API ($20-200/mo)   | TBD (product pricing)                               |

**Gneiss advantage:** OpenClaw users want AI-organized knowledge but are using flat markdown files and cron jobs as a substitute. Gneiss is the structured backend that OpenClaw's KM users are missing. The OpenClaw bridge in Gneiss turns OpenClaw into the capture/delivery layer while Gneiss handles storage, search, organization, and surfacing.

**OpenClaw advantage:** General-purpose agent can do anything (email, calendar, home automation, coding). Gneiss is scoped to knowledge. OpenClaw users who want one agent for everything will keep OpenClaw; Gneiss is the knowledge layer that plugs into it.

---

### Notion

**What it is:** All-in-one workspace (docs, databases, wikis, projects). Largest player in the space. Now bundling AI aggressively at the Business tier.

**AI features:**

- AI Chat (GPT-4.1, Claude 4, model picker)
- Notion Agent (Business+): multi-step tasks using workspace context, connected apps, web
- Enterprise Search: across Notion + Slack, GitHub, Jira, SharePoint, Teams
- AI Meeting Notes: auto-transcription + summary + action items (no bot joins call)
- Research Mode: deep reasoning for detailed reports (beta)
- Database autofill: batch AI processing of rows
- Custom Agents: "coming soon" (not shipped)
- MCP support for external tools

**Pricing:**

| Plan       | Monthly/seat | AI?                               |
| ---------- | ------------ | --------------------------------- |
| Free       | $0           | Limited trial                     |
| Plus       | $8-10        | Limited trial                     |
| Business   | $16-20       | Full AI included                  |
| Enterprise | Custom       | Full AI + zero LLM data retention |

**Strengths:**

- Most feature-complete workspace (databases, relations, rollups, automations)
- Enterprise Search across connected SaaS tools
- Meeting notes without a bot joining the call
- Massive ecosystem, 30M+ users
- Agent capability (multi-step tasks)
- Consolidation value (replaces multiple tools)

**Weaknesses:**

- AI requires Business tier ($16-20/seat) — expensive for individuals
- "Build your setup" trap — powerful but demands investment to configure
- No E2E encryption (30-day LLM data retention on non-Enterprise)
- No local-first / offline-first
- Feature bloat (mail, calendar, sites dilute core product)
- Custom Agents announced but not shipped
- For personal use, the pricing is hostile

**How Gneiss compares:**

| Dimension      | Notion                               | Gneiss                                |
| -------------- | ------------------------------------ | ------------------------------------- |
| AI model       | Add-on (Business tier)               | Core architecture                     |
| Organization   | User builds structure manually       | Agent builds structure automatically  |
| Target         | Teams and workspaces                 | Individual knowledge workers          |
| Pricing for AI | $16-20/mo minimum                    | TBD (personal-tier pricing)           |
| Proactive      | Agent (new, limited)                 | Digests, contradictions, action items |
| Note model     | Page (static until edited)           | Living document (agent rewrites)      |
| Collaboration  | Core feature                         | Not in scope (share-page only)        |
| Complexity     | High (databases, relations, rollups) | Low (blank page, Go button)           |

**Gneiss advantage:** Notion is a workspace; Gneiss is a thinking tool. Notion requires you to build the structure; Gneiss builds it for you. Notion's AI is an expensive add-on to an already complex system. Gneiss is designed for one person who wants to think, not configure.

**Notion advantage:** If you need team collaboration, databases, project management, and enterprise features, Notion is unmatched. Gneiss isn't competing for that market.

---

### Mem.ai

**What it is:** AI-first note-taking. The closest existing product to Gneiss's vision. Founded on the premise that organization should be automatic.

**AI features:**

- **Heads Up** — proactive contextual surfacing of related notes/collections while you work. The closest thing to Gneiss's digest/surfacing model.
- Deep Search (semantic, not just keyword)
- Mem Chat (RAG-style Q&A over your notes)
- Voice → structured note conversion
- Auto-organization of collections
- "Clean Up" — single-tap transforms rough notes into structured output

**Pricing:**

| Plan  | Cost                             |
| ----- | -------------------------------- |
| Free  | 25 notes/mo, 25 chat messages/mo |
| Pro   | $12/mo (unlimited everything)    |
| Teams | Custom                           |

**Strengths:**

- Most "agent-like" of all existing apps — Heads Up is genuinely proactive
- Zero-friction capture (voice, email, web clip)
- AI is deeply integrated, not superficial
- SOC 2 Type II compliant
- Clean UX

**Weaknesses:**

- Google-only login
- No Android app
- Free tier is almost unusable (25 notes/month)
- No E2E encryption
- No backlinks / graph view / networked notes
- No local-first / offline
- Historically unstable (features come and go, pivoted from Roam-like to AI-first)
- English only

**How Gneiss compares:**

| Dimension             | Mem.ai                      | Gneiss                                                     |
| --------------------- | --------------------------- | ---------------------------------------------------------- |
| Proactive surfacing   | Heads Up (partial)          | Full digests + contradictions + action items               |
| Note model            | Static notes + AI clean-up  | Living documents (agent rewrites on every interaction)     |
| Routing               | User creates notes manually | Agent routes input (new, update, split, ephemeral, etc.)   |
| Background processing | Auto-collections            | Full heartbeat pipeline (entities, facts, clusters, links) |
| Wiki links / graph    | No                          | Yes (agent-inserted `[[wiki links]]`, graph view)          |
| OpenClaw integration  | No                          | Native bridge                                              |
| Capture sources       | Voice, email, web           | Voice (via OpenClaw), web, messaging                       |
| Stability             | Historically unstable       | N/A (pre-launch)                                           |

**Gneiss advantage:** Mem.ai has the right instincts (AI-first, proactive surfacing) but executes partially. Gneiss goes further: the note-as-result model (agent rewrites, not just organizes), smart routing (not everything is a new note), conversation history with revert, wiki links building a knowledge graph, OpenClaw as ambient capture layer. Mem.ai is AI-assisted notes. Gneiss is agent-produced knowledge.

**Mem.ai advantage:** Shipped product with real users and SOC 2. Gneiss is pre-launch. Mem.ai's simplicity (no graph, no wiki links) may be an advantage for users who find those features intimidating.

---

### Tana

**What it is:** Supertag-based knowledge management. Everything is a node in a graph. Nodes have types (supertags) with fields. Most powerful structured data model in the space.

**AI features (most extensive of any note app):**

- AI Meeting Notetaker (live transcription, auto-extraction)
- AI Chat with notes (20+ models: GPT-5, Claude Opus 4.5, Gemini 3 Pro)
- AI Agents (custom GPT-like agents with workspace context)
- AI Command Nodes (multi-step automations with event triggers)
- AI Autofill (auto-populate fields)
- AI Image Generation
- Voice → structured data pipeline
- Web search in AI

**Pricing:**

| Plan | Monthly | Annual  | AI Credits  |
| ---- | ------- | ------- | ----------- |
| Free | $0      | $0      | 500 credits |
| Plus | ~$10/mo | ~$8/mo  | 2,000/mo    |
| Pro  | ~$18/mo | ~$14/mo | 5,000/mo    |

**Strengths:**

- Deepest AI integration of any note app
- Supertags = genuinely unique structured paradigm
- Live search nodes = dynamic views without manual filing
- Voice-first workflows
- MCP + API for extensibility
- Active development, high feature velocity

**Weaknesses:**

- Steepest learning curve in the category
- Web-based (Electron), not native
- No E2E encryption
- Cloud-only, no local-first
- AI credit system adds cost anxiety
- Smaller community than Obsidian/Notion
- Longevity risk (relatively new)

**How Gneiss compares:**

| Dimension      | Tana                                          | Gneiss                                                   |
| -------------- | --------------------------------------------- | -------------------------------------------------------- |
| AI model       | User-configured automations                   | Autonomous agent                                         |
| Organization   | User builds with supertags + queries          | Agent builds with collections + entities                 |
| Learning curve | Very high                                     | Very low (blank page → Go)                               |
| Structure      | User-defined supertags                        | Agent-inferred clusters, facts, links                    |
| Meeting notes  | Built-in transcription + extraction           | Via OpenClaw voice capture + agent processing            |
| Proactive      | Event-triggered automations (user-configured) | Autonomous (heartbeat, digests, contradiction detection) |

**Gneiss advantage:** Tana requires you to become a power user to get value. You must define supertags, build queries, configure automations. Gneiss requires you to dump thoughts and press Go. Tana's AI is powerful but user-initiated and user-configured. Gneiss's agent acts autonomously.

**Tana advantage:** If you want maximum control over your knowledge structure, Tana is unmatched. Power users who enjoy building systems will prefer Tana. Gneiss is for people who don't want to build systems — they want systems to build themselves.

---

### Bear

**What it is:** Beautiful, minimal markdown editor for Apple platforms. Apple Design Award winner. No AI. Tag-based organization.

**AI features:** None.

**Pricing:**

| Tier | Cost                       |
| ---- | -------------------------- |
| Free | Local notes only, 3 themes |
| Pro  | $2.99/mo or $29.99/yr      |

**Strengths:**

- Best-in-class design and typography
- Strong per-note E2EE (AES-GCM-256, audited by Cossack Labs)
- Fast native apps (Mac, iPhone, iPad)
- Very affordable
- Mature, stable, loved

**Weaknesses:**

- Apple only (no Windows, Android, web)
- Zero AI
- No graph view, no backlinks
- No collaboration
- Tag-only organization

**How Gneiss compares:**

| Dimension    | Bear        | Gneiss                                           |
| ------------ | ----------- | ------------------------------------------------ |
| AI           | None        | Core                                             |
| Platforms    | Apple only  | All (PWA)                                        |
| Organization | Manual tags | Agent-driven                                     |
| Encryption   | Strong E2EE | TBD                                              |
| Typography   | Excellent   | Libre Baskerville (inspired by Bear's aesthetic) |
| Price        | $3/mo       | TBD                                              |

**Gneiss advantage:** Everything Bear does well (clean design, good typography, personal focus) plus AI organization, cross-platform, proactive surfacing. Gneiss's design spec is explicitly inspired by Bear's aesthetic.

**Bear advantage:** Mature, stable, trusted, encrypted, native, and cheap. Users who don't want AI and are Apple-only have no reason to switch.

---

### Craft

**What it is:** Block-based document editor. Polished Apple-first (now cross-platform) alternative to Notion. Docs + tasks + calendar + publishing.

**AI features:**

- Basic AI writing assistant (15 free credits, 50/mo on Plus)
- MCP server (lets external AI tools read/write Craft docs)
- "Imagine" platform for custom workflows

**Pricing:**

| Tier   | Cost                        |
| ------ | --------------------------- |
| Free   | 1,500 blocks, 15 AI credits |
| Plus   | $4.80/mo (annual) or $8/mo  |
| Family | $9/mo (annual)              |
| Team   | $50/mo (up to 10 seats)     |

**Strengths:**

- Excellent native app quality across all platforms
- Beautiful design
- Tasks + calendar + docs in one
- MCP + API for extensibility
- Competitive pricing

**Weaknesses:**

- AI credits are very limited (50/mo)
- Not a knowledge graph (no backlinks, no graph view)
- Not pure markdown
- No per-note encryption
- Collections/databases are basic
- Smaller ecosystem

**How Gneiss compares:**

| Dimension       | Craft                         | Gneiss                                   |
| --------------- | ----------------------------- | ---------------------------------------- |
| AI              | Basic (limited credits)       | Core architecture                        |
| Knowledge graph | No                            | Yes (wiki links, backlinks, collections) |
| Organization    | Manual (folders, collections) | Agent-driven                             |
| Proactive       | None                          | Digests, contradictions, action items    |
| Tasks           | Built-in                      | Action items detected by agent           |

**Gneiss advantage:** Craft is a document editor with light AI. Gneiss is an agent-driven knowledge system. Different products for different needs.

**Craft advantage:** More polished editor, tasks/calendar built in, team features. Users who need a Notion-like workspace with better design will prefer Craft.

---

### Capacities

**What it is:** Object-based PKM. Everything is a typed object (Book, Person, Meeting, Idea) with properties. Unique paradigm in the space.

**AI features:**

- AI Chat (ask questions about your objects)
- AI property auto-fill
- BYOK (bring your own OpenAI key for unlimited usage)

**Pricing:**

| Tier  | Cost                                 |
| ----- | ------------------------------------ |
| Basic | Free (core product, unlimited notes) |
| Pro   | ~$9-12/mo                            |

**Strengths:**

- Object paradigm is genuinely unique
- Generous free tier
- Beautiful UI
- Active development, responsive team
- European (GDPR-native)

**Weaknesses:**

- No E2E encryption
- Cloud-only
- AI is bolt-on (OpenAI wrapper)
- No visual graph view
- Individuals only (no collaboration)
- Object paradigm has learning curve

**How Gneiss compares:**

| Dimension    | Capacities                    | Gneiss                                      |
| ------------ | ----------------------------- | ------------------------------------------- |
| AI           | Bolt-on (BYOK)                | Core architecture                           |
| Data model   | User-defined object types     | Agent-inferred entities, facts, collections |
| Organization | User creates objects manually | Agent creates structure automatically       |
| Proactive    | Minimal                       | Full surfacing layer                        |

**Gneiss advantage:** Capacities' object model is interesting but requires manual setup. Gneiss's entity/fact extraction achieves a similar structured outcome automatically.

**Capacities advantage:** More mature, generous free tier, the object paradigm is genuinely powerful for users who invest in configuring it.

---

### Reflect

**What it is:** AI-enhanced daily notes with E2E encryption. Founded by Alex MacCaw (ClearBit founder). Strong "personal thinking tool" philosophy.

**AI features:**

- GPT-4 assistant
- Whisper voice transcription
- Article outline generation
- Action item extraction
- Chat with notes
- Custom prompt templates

**Pricing:**

| Plan        | Cost                    |
| ----------- | ----------------------- |
| Single plan | $10/mo (annual billing) |
| Free trial  | 14 days                 |

No free tier.

**Strengths:**

- E2E encryption (genuinely private)
- Beautiful, fast, minimal design
- SQLite rewrite = very performant
- Simple pricing
- Backlinks + graph view done elegantly
- Strong personal-tool philosophy

**Weaknesses:**

- No free tier
- iOS only (no Android)
- Limited integrations
- AI is user-initiated only, not proactive
- No API for extensions
- Limited customization

**How Gneiss compares:**

| Dimension    | Reflect                         | Gneiss                          |
| ------------ | ------------------------------- | ------------------------------- |
| AI           | User-initiated only             | Autonomous agent                |
| Encryption   | E2E (differentiator)            | TBD                             |
| Proactive    | None                            | Full surfacing layer            |
| Organization | Manual (backlinks, daily notes) | Agent-driven                    |
| Philosophy   | Personal thinking tool          | Personal thinking tool (shared) |

**Gneiss advantage:** Same philosophical alignment (personal, private, thinking-first) but with autonomous agent organization. Reflect is a great editor; Gneiss is an editor + organizer.

**Reflect advantage:** E2E encryption, shipped and stable, simple and focused. If Gneiss can match the encryption story, this becomes a pure feature comparison.

---

### Roam Research

**What it is:** Pioneered bidirectional linking in consumer PKM. Outliner-based. Block-level references.

**AI features:** Minimal. No meaningful AI strategy.

**Pricing:** ~$15/mo. No free tier.

**Status:** Declining. Lost significant mindshare to Obsidian and Logseq. Development updates infrequent. Community has largely moved on. Website barely renders.

**How Gneiss compares:** Roam is a historical reference, not a current competitor. Users who left Roam for Obsidian are now adding Claude Code — they're Gneiss's exact target audience.

---

## Feature Comparison Matrix

| Feature                       | Gneiss       | Obsidian   | Obs+Claude        | OpenClaw      | Notion        | Mem.ai         | Tana              | Bear          | Craft         | Capacities     | Reflect  | Roam        |
| ----------------------------- | ------------ | ---------- | ----------------- | ------------- | ------------- | -------------- | ----------------- | ------------- | ------------- | -------------- | -------- | ----------- |
| **Agent-first architecture**  | Yes          | No         | Hacked            | Hacked        | Partial       | Partial        | User-config       | No            | No            | No             | No       | No          |
| **Note-as-result model**      | Yes          | No         | Partial           | No            | No            | No             | No                | No            | No            | No             | No       | No          |
| **Smart routing**             | Yes          | No         | No                | No            | No            | No             | No                | No            | No            | No             | No       | No          |
| **Proactive surfacing**       | Yes          | No         | No                | Cron-based    | New           | Heads Up       | Event triggers    | No            | No            | No             | No       | No          |
| **Background organization**   | Yes          | No         | No                | Flat files    | No            | Partial        | User-config       | No            | No            | No             | No       | No          |
| **Contradiction detection**   | Yes          | No         | No                | No            | No            | No             | No                | No            | No            | No             | No       | No          |
| **Version history (git-log)** | Yes          | No         | No (destructive)  | No            | Basic         | No             | No                | No            | Basic         | No             | No       | Block-level |
| **Wiki links / backlinks**    | Yes          | Yes        | Yes               | No            | Limited       | No             | Yes               | No            | No            | Yes            | Yes      | Yes         |
| **Graph view**                | Yes          | Yes        | Yes               | No            | No            | No             | Yes               | No            | No            | No             | Yes      | Yes         |
| **Voice capture**             | Via OpenClaw | Plugin     | Plugin            | Native        | Meeting AI    | Native         | Native            | No            | No            | No             | Native   | No          |
| **Messaging capture**         | Via OpenClaw | No         | No                | Native        | No            | No             | No                | No            | No            | No             | No       | No          |
| **E2E encryption**            | TBD          | No         | No                | No            | Enterprise    | No             | No                | Yes           | No            | No             | Yes      | No          |
| **Mobile-first**              | Yes (PWA)    | No         | No (desktop only) | Chat apps     | Yes           | iOS only       | Yes               | iOS only      | Yes           | Yes            | iOS only | No          |
| **Offline**                   | TBD          | Yes        | N/A               | LLM-dependent | No            | No             | Desktop only      | Yes           | Partial       | No             | Yes      | No          |
| **Open source**               | TBD          | No         | Mixed             | Yes (MIT)     | No            | No             | No                | No            | No            | No             | No       | No          |
| **Free tier**                 | TBD          | Yes (full) | Yes               | Yes           | Yes (limited) | Yes (25 notes) | Yes (500 credits) | Yes (limited) | Yes (limited) | Yes (generous) | No       | No          |

---

## Pricing Comparison

| Product                    | Free Tier      | Paid Tier                      | AI Included?            | Notes                                |
| -------------------------- | -------------- | ------------------------------ | ----------------------- | ------------------------------------ |
| **Obsidian**               | Full app free  | Sync $4-5/mo, Publish $8-10/mo | No (BYOK via plugins)   | AI costs are separate (API keys)     |
| **Obsidian + Claude Code** | Obsidian free  | Claude Pro $20/mo or API usage | Separate                | Real cost: $20-100/mo for LLM access |
| **OpenClaw**               | Free (MIT)     | LLM API: $20-200/mo            | Separate                | Self-hosted; cost = LLM usage        |
| **Notion**                 | Yes (limited)  | Plus $8-10, Business $16-20    | Business tier only      | AI requires $16-20/mo minimum        |
| **Mem.ai**                 | 25 notes/mo    | $12/mo                         | Yes                     | Aggressive free tier limit           |
| **Tana**                   | 500 credits    | Plus ~$10, Pro ~$18            | Yes (credit-based)      | Credits add cost anxiety             |
| **Bear**                   | Yes (limited)  | $3/mo                          | No AI                   | Cheapest paid tier                   |
| **Craft**                  | 1,500 blocks   | $4.80-8/mo                     | Basic (limited credits) | AI is minimal                        |
| **Capacities**             | Yes (generous) | ~$9-12/mo                      | BYOK                    | Bring your own OpenAI key            |
| **Reflect**                | 14-day trial   | $10/mo                         | Yes                     | No free tier                         |
| **Roam**                   | No             | $15/mo                         | No                      | Expensive, declining                 |

### Pricing Insights

1. **The AI tax is real.** Getting meaningful AI in any product costs $10-20/mo minimum. Notion gates AI behind Business ($16-20). Obsidian + Claude Code costs $20+/mo for the LLM. Tana's credit system means heavy users pay more.

2. **The "personal" price ceiling is ~$12/mo.** Mem.ai at $12, Reflect at $10, Tana Plus at ~$10. Above this, users expect team features (Notion Business at $16-20 is per-seat team pricing).

3. **Free tiers are table stakes.** Every successful product except Reflect and Roam offers a free tier. But most free tiers are crippled (Mem: 25 notes, Craft: 1,500 blocks). Obsidian and Capacities stand out with genuinely generous free tiers.

4. **BYOK is emerging.** Capacities lets users bring their own OpenAI key. This shifts LLM cost to the user but removes per-user AI pricing friction. Obsidian plugins do this by default.

### Gneiss Pricing Recommendation

| Tier                   | Target                                                                                                                  | Rationale                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Free**               | Capture + basic organization. Limited agent processing (N notes/mo or N agent actions/mo). Full note-taking experience. | Must be genuinely useful, not a crippled demo. Obsidian's generous free tier sets expectations.   |
| **Pro ($10-12/mo)**    | Unlimited agent processing, full digests, all surfacing features, OpenClaw bridge, voice capture, priority support.     | At or below the personal price ceiling. Compete with Mem.ai ($12), Reflect ($10).                 |
| **Usage-based option** | BYOK for LLM costs, pay only for Gneiss infrastructure.                                                                 | Appeals to the Obsidian/OpenClaw crowd who already pay for API access. Removes AI-cost objection. |

The **BYOK option** is strategically important. Gneiss's target audience (Obsidian + Claude Code users, OpenClaw users) already pays for LLM API access. Letting them bring their own key while paying a lower Gneiss infrastructure fee ($5-7/mo?) converts them with minimal friction.

---

## Where Gneiss Wins

### 1. The Only Agent-First Architecture

Every competitor treats AI as a feature added to notes. Gneiss treats notes as the output of an agent system. This is a fundamentally different architecture:

- **Others:** User writes note → AI helps (summarize, link, search)
- **Gneiss:** User brain dumps → Agent produces note (structured, linked, contextualized)

The note-as-result model is unique in the market.

### 2. Smart Routing (No Other Product Has This)

No competitor routes user input to the right destination automatically. In every other product, creating a note creates a note. In Gneiss, typing "get milk" updates your grocery list. Typing "what time is it in Tokyo" gives an ephemeral answer. Typing a meeting brain dump creates a structured note with wiki links.

### 3. Replaces a Fragile 3-Tool Stack

The Obsidian + Claude Code + OpenClaw stack is powerful but:

- 221 GitHub repos, 5+ approaches, no standard
- Desktop only
- Data destruction risk
- Ephemeral session memory
- Requires technical sophistication

Gneiss replaces this with one product.

### 4. Mobile-First (The Blind Spot)

Obsidian + Claude Code is desktop only. OpenClaw's KM is filesystem-based (desktop). Mem.ai is iOS only. Roam has no mobile app. Gneiss being a mobile-first PWA is a genuine differentiator for capture-on-the-go.

### 5. Conversation History with Revert

The #1 pain point in the Obsidian + Claude Code community is data destruction. Gneiss's git-log-style conversation history with version revert directly solves this.

### 6. Autonomous Background Organization

Only Gneiss runs a heartbeat pipeline that extracts entities, detects facts, clusters collections, links related content, and surfaces contradictions — all without user intervention. Tana has event triggers but requires user configuration. Mem.ai has partial auto-organization. No one else does this.

---

## Positioning Strategy

### Primary Positioning

**"The note-taking app where the agent does the organizing."**

Position against the DIY stack (Obsidian + Claude Code + OpenClaw):

- Same power, none of the fragility
- One product instead of three tools duct-taped together
- Mobile-first, not desktop-only
- Persistent memory, not session-based hacks
- Safe by default (history + revert), not destructive

### Target Audience (in priority order)

1. **Obsidian + Claude Code users** — Already want AI-organized notes. Currently using a fragile stack. Gneiss is what they're building toward.
2. **OpenClaw users** — Already have the capture layer (messaging). Missing the structured knowledge backend. Gneiss is the missing piece.
3. **Mem.ai/Reflect/Tana users** — Already pay for AI notes. May switch for deeper agent capabilities and the note-as-result model.
4. **Obsidian users without Claude Code** — Want AI but don't want the complexity. Gneiss is AI-native without the plugin chaos.
5. **Note-taking burnout users** — People who've tried Notion, Obsidian, Roam, and gave up because organizing is too much work.

### Messaging Framework

| Audience                     | Message                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| Obsidian + Claude Code users | "Everything you've built with slash commands and MCP servers — but it just works." |
| OpenClaw users               | "Your agent's memory, structured and searchable. Not flat markdown files."         |
| Mem.ai users                 | "Like Mem, but the agent rewrites your notes, not just organizes them."            |
| Notion refugees              | "Stop building systems. Start thinking. The agent builds the system for you."      |
| Note-taking burnout          | "You do the thinking. The agent does the organizing."                              |

### What Gneiss is NOT

- Not a team workspace (use Notion)
- Not a coding tool (use Cursor/Claude Code)
- Not a general-purpose agent (use OpenClaw)
- Not a document editor (use Craft/Google Docs)
- Not a task manager (use Linear/Todoist)

Gneiss is a **personal knowledge agent** — the place where your thinking happens and gets organized automatically.

### Competitive Moat

1. **Agent architecture** — retrofitting agent-first behavior onto existing apps is architecturally hard. Notion is trying; it's slow and expensive. Obsidian will never do it (philosophy conflict).
2. **Note-as-result model** — requires rethinking the entire editor paradigm. Can't be bolted on.
3. **Smart routing** — requires a lightweight note index + fast Router Agent. Gets better with more notes (network effect on routing accuracy).
4. **OpenClaw bridge** — first-mover advantage on the fastest-growing agent platform (144k stars).
5. **Conversation history** — the git-log-for-notes model is unique and solves a real pain point (data destruction in AI-edited notes).
