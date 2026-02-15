# Technical Specification: Gneiss

> **Status:** Active
> **Last Updated:** February 2026

---

## Table of Contents

1. [[#Goals & Non-Goals]]
2. [[#System Context]]
3. [[#Frontend Architecture]]
4. [[#Backend Architecture]]
5. [[#Agent System]]
6. [[#Agent Context Assembly (Theory — Needs Validation)]]
7. [[#Core Data Model]]
8. [[#Capture Pipeline]]
9. [[#Organization Pipeline]]
10. [[#Surfacing & Querying]]
11. [[#Workflows]]
12. [[#Optional OpenClaw Integration]]
13. [[#Search & Retrieval]]
14. [[#Storage & Files]]
15. [[#Security & Privacy]]
16. [[#Observability & Operations]]
17. [[#Cost Controls]]
18. [[#Open Technical Questions]]

---

## Goals & Non-Goals

### Goals

- **Ambient capture** via blank-page notes and optional messaging (OpenClaw)
- **Agent-first UX** where organization and surfacing are default behaviors
- **Auditability** of agent decisions, with user overrides
- **Interoperability** with external agents/bots (OpenClaw optional) and exports
- **Unified platform** — frontend, backend, agents, storage all on Cloudflare
- **Markdown-first notes** with minimal versioning requirements for v1

### Non-Goals (initial scope)

- Full collaborative editing or shared workspaces
- Organization/team accounts (per-user only in v1)
- Real-time multi-user cursors
- Replacement of calendar/task systems
- Enterprise admin controls (SSO, SCIM, org policy)

---

## System Context

### Primary Flow

```
CAPTURE -> ORGANIZE -> SURFACE -> ACT
```

### Trust Boundary

- OpenClaw is an **untrusted external client**.
- All OpenClaw input is treated as hostile: validation, sanitization, rate limits, and scoped permissions.
- External integrations are optional and do not block core app usage.

---

## Frontend Architecture

### Mobile-First PWA Strategy

| Principle                     | Implementation                                                 |
| ----------------------------- | -------------------------------------------------------------- |
| **One codebase, all devices** | Single TanStack Start app works on desktop, tablet, and mobile |
| **Installable**               | Add to home screen on iOS/Android; feels native                |
| **Responsive-first**          | UI designed for mobile, then enhanced for larger screens       |
| **Touch-optimized**           | Large tap targets, swipe gestures, bottom navigation           |

### Tech Stack

| Layer         | Technology                        | Rationale                                          |
| ------------- | --------------------------------- | -------------------------------------------------- |
| **Framework** | TanStack Start + React            | SSR, file-based routing, excellent DX              |
| **Styling**   | Tailwind CSS                      | Utility-first, responsive by default               |
| **State**     | `useAgent` + `useAgentChat` hooks | WebSocket state sync, no separate state management |
| **PWA**       | Vite PWA plugin                   | Manifest + install prompts                         |
| **Deploy**    | Cloudflare Workers                | Edge deployment, fast globally                     |
| **Build**     | Vite + `@cloudflare/vite-plugin`  | Cloudflare-native build with DO support            |

### UI Surfaces

- **Blank-page new note** — THE primary capture surface. Full-screen editor with "Save" button. Agent infers intent. No separate capture bar or chat widget.
- **Note view** — The note is the cumulative result of user + agent collaboration. Always a clean document — no chat artifacts, no visible dividers, no "agent" labels. Content morphs in real time when agent is working.
- **Conversation history** — Secondary "History" view per note. Git-log-style: raw user prompts + agent actions + version diffs. Supports revert. Never the default view.
- **Command palette** — `Cmd+K` on desktop. First option: new note. Also surfaces search, go-to-collection, power-user actions.
- **Digest view** — curated findings + actionable items
- **Collections browser** — topic clusters + entity lenses
- **Timeline** — note feed with filters
- **Action center** — detected tasks and contradictions

### Client-Agent Communication

```tsx
// Two simultaneous WebSocket connections per active session

// 1. IndexAgent — global reactivity for sidebar, note list, collections
const index = useAgent<IndexState>({
	agent: "IndexAgent",
	name: userId,
	onStateUpdate: (state) => {
		/* re-render sidebar, note list */
	},
});

// 2. RewriteAgent — per-note content, streaming, conversation
const agent = useAgent({
	agent: "RewriteAgent",
	name: `${userId}:${noteId}`,
});
const chat = useAgentChat({
	agent,
	resume: true, // auto-resume streams on reconnect
});
```

---

## Backend Architecture

### All-Cloudflare Stack

| Layer              | Service                             | Purpose                                         |
| ------------------ | ----------------------------------- | ----------------------------------------------- |
| **API Router**     | Hono on Workers                     | HTTP routes, SSR, agent routing                 |
| **Agent Runtime**  | Durable Objects via `agents` SDK    | Stateful per-note and per-user agents           |
| **AI Chat**        | `@cloudflare/ai-chat` (AIChatAgent) | Conversation persistence, resumable streaming   |
| **Database**       | D1 (SQLite)                         | Source of truth: notes, entities, facts, users  |
| **Agent DB**       | Per-DO SQLite                       | Co-located: conversation history, note versions |
| **Vector Search**  | Vectorize                           | Note + entity embeddings for semantic search    |
| **File Storage**   | R2 (S3-compatible)                  | Audio, images, PDFs, screenshots                |
| **Cache/Sessions** | KV                                  | Session tokens, rate limits, routing cache      |
| **Scheduling**     | DO alarms via `this.schedule()`     | Cron, delayed, interval tasks per agent         |
| **Workflows**      | `AgentWorkflow`                     | Durable multi-step pipelines with retry         |
| **Auth**           | `better-auth` via Workers + D1/KV   | User authentication                             |
| **Observability**  | Workers Observability               | Structured logs + traces                        |

### Hono Router (Entry Point)

```typescript
import { Hono } from "hono";
import { agentsMiddleware } from "hono-agents";
import { cors } from "hono/cors";

const app = new Hono<{ Bindings: Env }>();

app.use("/api/*", cors());

// Agent WebSocket/HTTP routing (automatic DO dispatch)
app.use("/agents/*", agentsMiddleware());

// API routes
app.post("/api/capture", captureHandler);
app.post("/api/openclaw/ingest", openclawIngestHandler);
app.post("/api/openclaw/query", openclawQueryHandler);
app.post("/api/openclaw/digest", openclawDigestHandler);

// Auth routes
app.all("/api/auth/*", betterAuthHandler);

// Catch-all for TanStack Start SSR
app.all("*", ssrHandler);

export default app;

// Export all agent classes (required for DO binding)
export { IndexAgent } from "./agents/index-agent";
export { RouterAgent } from "./agents/router-agent";
export { RewriteAgent } from "./agents/rewrite-agent";
export { OrganizationAgent } from "./agents/organization-agent";
export { SurfacingAgent } from "./agents/surfacing-agent";
export { OrganizeWorkflow } from "./workflows/organize";
export { FanOutWorkflow } from "./workflows/fanout";
export { ContradictionWorkflow } from "./workflows/contradiction";
```

### wrangler.jsonc

```jsonc
{
	"name": "gneiss",
	"main": "src/server.ts",
	"compatibility_date": "2025-12-01",
	"compatibility_flags": ["nodejs_compat"],

	"observability": { "enabled": true },

	"durable_objects": {
		"bindings": [
			{ "name": "INDEX_AGENT", "class_name": "IndexAgent" },
			{ "name": "ROUTER_AGENT", "class_name": "RouterAgent" },
			{ "name": "REWRITE_AGENT", "class_name": "RewriteAgent" },
			{ "name": "ORGANIZATION_AGENT", "class_name": "OrganizationAgent" },
			{ "name": "SURFACING_AGENT", "class_name": "SurfacingAgent" },
		],
	},

	// Workflows are separate from DO bindings — they use the Workflow runtime
	"workflows": [
		{
			"name": "organize-workflow",
			"binding": "ORGANIZE_WORKFLOW",
			"class_name": "OrganizeWorkflow",
		},
		{
			"name": "fanout-workflow",
			"binding": "FANOUT_WORKFLOW",
			"class_name": "FanOutWorkflow",
		},
		{
			"name": "contradiction-workflow",
			"binding": "CONTRADICTION_WORKFLOW",
			"class_name": "ContradictionWorkflow",
		},
	],

	"migrations": [
		{
			"tag": "v1",
			"new_sqlite_classes": [
				"IndexAgent",
				"RouterAgent",
				"RewriteAgent",
				"OrganizationAgent",
				"SurfacingAgent",
			],
		},
	],

	"d1_databases": [{ "binding": "DB", "database_name": "gneiss-db" }],

	"vectorize": [{ "binding": "VECTORIZE", "index_name": "gneiss-embeddings" }],

	"r2_buckets": [{ "binding": "FILES", "bucket_name": "gneiss-files" }],

	"kv_namespaces": [{ "binding": "KV", "id": "..." }],
}
```

### Env Type

```typescript
interface Env {
	// Durable Object bindings
	INDEX_AGENT: DurableObjectNamespace<IndexAgent>;
	ROUTER_AGENT: DurableObjectNamespace<RouterAgent>;
	REWRITE_AGENT: DurableObjectNamespace<RewriteAgent>;
	ORGANIZATION_AGENT: DurableObjectNamespace<OrganizationAgent>;
	SURFACING_AGENT: DurableObjectNamespace<SurfacingAgent>;

	// Workflow bindings (separate from DO bindings)
	ORGANIZE_WORKFLOW: Workflow;
	FANOUT_WORKFLOW: Workflow;
	CONTRADICTION_WORKFLOW: Workflow;

	// Shared services
	DB: D1Database;
	VECTORIZE: VectorizeIndex;
	FILES: R2Bucket;
	KV: KVNamespace;
	CORS_ORIGIN: string;

	// Secrets
	GOOGLE_AI_KEY: string;
	BETTER_AUTH_SECRET: string;
	BETTER_AUTH_URL: string;
}
```

---

## Agent System

### Durable Object Classes

```
IndexAgent          (1 per user)   — reactive cross-note index
RouterAgent         (1 per user)   — input classification + routing
RewriteAgent        (1 per note)   — note content, conversation, streaming
OrganizationAgent   (1 per user)   — background clustering, linking, extraction (v1 minimal)
SurfacingAgent      (1 per user)   — query synthesis, digests (v1 minimal)
```

### Ephemeral Thread Model

The RewriteAgent is a per-note Durable Object, but the **conversation within it is not a persistent thread the user re-enters**. Each user interaction (Save press, slash command) conceptually starts a fresh agent task scoped to that interaction. The agent receives:

1. The current note content (source of truth)
2. A compact context payload (user preferences, routing decision, relevant note summaries)
3. The user's new input

The agent does its job — rewrite, research, answer — updates the note, and the task is done. The user never "re-opens a thread" or worries about how much context is left.

**Implementation:** AIChatAgent stores all messages in DO SQLite (`cf_ai_chat_agent_messages`). This accumulates over time and would eventually bloat the context window. To keep threads minimal:

- On each interaction, the agent **does not send the full message history** to the LLM. Instead, it sends: current note content + user's latest input + compact system context.
- The full message history is retained in DO SQLite only for the History view (audit/revert). It is not used as LLM conversation context.
- This means each LLM call is effectively stateless — the note IS the memory, not the thread.
- If the agent needs prior conversation context (rare), it can selectively retrieve relevant history entries, not replay the full thread.

This diverges from the typical AIChatAgent pattern (where `this.messages` is passed directly to the LLM). The RewriteAgent overrides this: the note replaces the thread as the carrier of accumulated knowledge.

**Why this matters:**

- Users never hit context limits or experience degraded responses on long-lived notes
- Each interaction gets the same quality response whether it's the 1st or 100th on that note
- The LLM cost per interaction is bounded by note length, not conversation length
- Threads are an invisible implementation detail, not a user-facing concept

Solves the reactivity problem — Cloudflare doesn't have automatic query reactivity like Convex. The IndexAgent is a per-user DO that maintains a lightweight reactive state and broadcasts changes to all connected browser tabs via WebSocket.

```typescript
import { Agent, callable } from "agents";

type IndexState = {
	notes: NoteStub[]; // id, title, summary, tags, updatedAt
	collections: CollectionStub[];
	actionItems: ActionItemStub[];
	recentActivity: Activity[];
};

export class IndexAgent extends Agent<Env, IndexState> {
	initialState = { notes: [], collections: [], actionItems: [], recentActivity: [] };

	async onStart() {
		// Hydrate from D1 on cold start
		const notes = await this.env.DB.prepare(
			"SELECT id, title, summary, tags, updated_at FROM notes WHERE user_id = ? ORDER BY updated_at DESC",
		)
			.bind(this.name)
			.all();
		this.setState({ ...this.state, notes: notes.results });
	}

	@callable()
	noteUpdated(stub: NoteStub) {
		const notes = this.state.notes.filter((n) => n.id !== stub.id);
		notes.unshift(stub);
		this.setState({ ...this.state, notes });
		// setState() auto-broadcasts to ALL connected WebSocket clients
	}

	@callable()
	noteDeleted(noteId: string) {
		this.setState({
			...this.state,
			notes: this.state.notes.filter((n) => n.id !== noteId),
		});
	}

	@callable()
	collectionsUpdated(collections: CollectionStub[]) {
		this.setState({ ...this.state, collections });
	}

	@callable()
	actionItemsUpdated(items: ActionItemStub[]) {
		this.setState({ ...this.state, actionItems: items });
	}
}
```

### RouterAgent (Input Classification)

```typescript
import { Agent, callable } from "agents";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";

export class RouterAgent extends Agent<Env> {
	@callable()
	async processInput(input: string) {
		// Get lightweight note index from IndexAgent or local cache
		const noteIndex = await this.getNoteIndex();

		const decision = await generateObject({
			model: google("gemini-3-flash-preview"),
			schema: routingSchema,
			prompt: `Classify this input and decide routing.
        Input: "${input}"
        Existing notes: ${JSON.stringify(noteIndex)}
        User preferences: ${this.preferences}`,
		});

		switch (decision.type) {
			case "new_note": {
				const noteId = crypto.randomUUID();
				await this.env.DB.prepare(
					"INSERT INTO notes (id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?)",
				)
					.bind(noteId, this.userId, Date.now(), Date.now())
					.run();
				return { route: "new_note", noteId };
			}
			case "update_existing":
				return { route: "update_existing", noteId: decision.noteId };
			case "ephemeral_answer":
				return { route: "ephemeral_answer", answer: decision.answer };
			case "workspace_action":
				await this.executeAction(decision.action);
				return { route: "workspace_action", message: decision.confirmation };
			// ... split, fan_out, correction, duplicate, store_preference
		}
	}
}
```

### RewriteAgent (Core Interaction)

```typescript
import { AIChatAgent } from "@cloudflare/ai-chat";
import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { createUIMessageStream, createUIMessageStreamResponse, convertToModelMessages } from "ai";

export class RewriteAgent extends AIChatAgent<Env> {
	async onChatMessage(onFinish) {
		// Load current note content from local DO SQLite
		const [currentNote] = this.sql`
      SELECT content FROM note_versions ORDER BY created_at DESC LIMIT 1
    `;

		return createUIMessageStreamResponse({
			stream: createUIMessageStream({
				execute: async ({ writer }) => {
					const result = streamText({
						model: google("gemini-3-flash-preview"),
						system: `You are the Gneiss Rewrite Agent.
              Current note content:\n${currentNote?.content || ""}
              Routing decision: ${this.routingContext}
              User preferences: ${this.preferences}`,
						messages: await convertToModelMessages(this.messages),
					});

					writer.merge(
						result.toUIMessageStream({
							onFinish: async (msg) => {
								// Save version to local DO SQLite
								this.sql`INSERT INTO note_versions (content, title, created_at)
                       VALUES (${msg.text}, ${title}, ${Date.now()})`;

								// Sync summary to D1 (source of truth for cross-note queries)
								await this.env.DB.prepare(
									"UPDATE notes SET title=?, summary=?, updated_at=? WHERE id=?",
								)
									.bind(title, summary, Date.now(), this.noteId)
									.run();

								// Notify IndexAgent → broadcasts to all connected clients
								const index = getAgentByName(this.env.INDEX_AGENT, this.userId);
								await index.noteUpdated({
									id: this.noteId,
									title,
									summary,
									tags,
									updatedAt: Date.now(),
								});

								onFinish(msg);
							},
						}),
					);
				},
			}),
		});
	}
}
```

### OrganizationAgent (Background)

```typescript
import { Agent } from "agents";

export class OrganizationAgent extends Agent<Env> {
	async onStart() {
		// Schedule heartbeat every 6 hours
		this.schedule("0 */6 * * *", "heartbeat");
	}

	async heartbeat() {
		const unprocessed = await this.env.DB.prepare(
			"SELECT * FROM notes WHERE user_id = ? AND processed = 0",
		)
			.bind(this.name)
			.all();

		if (unprocessed.results.length === 0) return;

		// Launch durable workflow for long-running operation
		await this.runWorkflow("ORGANIZE_WORKFLOW", {
			userId: this.name,
			noteIds: unprocessed.results.map((n) => n.id),
		});
	}
}
```

### LLM Provider

- **Primary:** Google Gemini 3 Flash Preview (fast, cost-effective)
- **Fallback:** Configurable per-agent
- **SDK:** Vercel AI SDK (`ai` package) for `streamText`, `generateObject`, `generateText`

---

## Agent Context Assembly (Theory — Needs Validation)

> **Status:** Research theory. Not yet validated in implementation. Multiple approaches under consideration.

### The Problem

Every agent interaction needs "just enough" global context to do its job well. Too little and the agent misses connections; too much and costs spike, latency grows, and signal degrades ("lost in the middle" — Liu et al. 2024). The current spec handwaves each agent's context: "lightweight note index," "user preferences," "routing context." There's no shared theory for how agents assemble context per task.

### What the Cloudflare Agents SDK Provides Natively

The CF agents SDK offers **building blocks** but no opinionated memory layer:

- **Per-DO SQLite** — each agent has co-located SQL storage. Good for agent-local state, but cross-agent knowledge sharing requires explicit RPC or querying shared D1.
- **`this.state` + `setState()`** — reactive state broadcast to WebSocket clients. Designed for UI reactivity, not context injection into other agents.
- **AIChatAgent message history** — auto-persisted in DO SQLite (`cf_ai_chat_agent_messages`). Designed to replay full threads to LLMs. We deliberately break this pattern (see Ephemeral Thread Model), using it only for audit.
- **DO RPC (`getAgentByName`)** — typed inter-agent calls. The mechanism for one agent to request context from another.
- **No built-in memory service, knowledge graph, vector retrieval pipeline, or context compiler.** These are left to the developer.

This means context assembly is entirely our problem to solve.

### Approach A: Build It Ourselves (Tiered Context Assembly)

Four tiers of context, assembled per-task by each agent:

**Tier 1 — User Profile (~500 tokens, always injected)**
A compact LLM-readable summary of the user: work areas, recurring entities, communication style, meta-preferences. Rebuilt periodically by OrganizationAgent as a heartbeat side effect. Stored in D1 or KV as a single text blob. Every agent receives this as baseline system prompt context.

**Tier 2 — Note Index (lightweight, fast-changing)**
IndexAgent's `NoteStub[]` (id, title, summary, tags, updatedAt). Canonical source for "what exists." RouterAgent and other agents call IndexAgent via DO RPC or maintain a locally-cached copy. This is the "table of contents" — tells an agent what exists without the content.

**Tier 3 — Structured Knowledge (entities, facts, relationships)**
D1 tables: entities, facts, note_links, collections. Each agent has a **context assembly function** — a typed function that takes task parameters and returns the specific D1 queries needed. Not generic RAG — structured, task-specific retrieval:

- RewriteAgent: entities/facts overlapping with current note's topics
- OrganizationAgent: full entity graph + active facts for clustering
- SurfacingAgent: pending action items, recent collections, contradictions

**Tier 4 — Semantic Retrieval (optional)**
Vectorize embeddings, only if we decide semantic retrieval is required. Not part of v1 by default.

```
Per-interaction context assembly:
  → Always: Tier 1 (user profile, ~500 tokens)
  → Always: Tier 2 subset (relevant note stubs, ~200-1000 tokens)
  → Task-specific: Tier 3 queries (entities/facts for THIS task)
  → If needed: Tier 4 semantic retrieval (Vectorize top-K)
  → Compile into system prompt + context payload
  → LLM call
```

**Key insight:** Tier 1 and the knowledge graph (Tier 3) are _byproducts_ of the OrganizationAgent's heartbeat. The heartbeat doesn't just cluster notes — it maintains the shared context infrastructure all other agents consume. OrganizationAgent is the producer; every other agent is a consumer.

**Pros:** Full control, no external dependency, uses infrastructure we already have (D1, DO RPC). Maps directly to our existing data model.
**Cons:** Significant custom engineering. No temporal reasoning, knowledge versioning, or conflict resolution in the context layer itself (those exist in our data model but aren't surfaced as "memories"). Reinventing patterns that memory libraries have already solved.

### Approach B: Integrate a Memory Layer (Supermemory, Mem0, or Similar)

External memory services solve the "context assembly" problem as a managed layer. Key candidates:

**Supermemory** (SOTA on LongMemEval, 17k GitHub stars)

- Architecture: chunk-based ingestion → contextual memories (atomic facts) → relational versioning (updates/extends/derives) → temporal grounding (documentDate + eventDate) → hybrid search (memory semantics + source chunks)
- Key differentiator: relational versioning creates "knowledge chains" — when a fact changes, old versions are linked, not deleted. Temporal grounding distinguishes "when was it said" from "when did the event happen."
- Integration: REST API + SDKs. Feed note content + conversation history as documents. Query memories per-agent-task.
- Fit for Gneiss: strong. The memory model (atomic facts with temporal metadata and versioning) maps closely to our entities/facts tables. Could replace or augment Tier 3 and Tier 4 of Approach A.
- Concern: external SaaS dependency for a core intelligence layer. No self-hosted option currently.

**Mem0** (38.8k GitHub stars, $24M funding)

- Architecture: three memory layers (User, Session, Agent). LoCoMo pipeline extracts/clusters/summarizes facts. Optional graph mode (Neo4j/Memgraph).
- Benchmark: +26% accuracy, -91% latency vs. full-context baselines.
- Self-hostable (Apache-2.0 core), but advanced features gated to cloud tier.
- Fit for Gneiss: moderate. Simpler than Supermemory's relational versioning. Graph mode is optional, not default. Would need to map our entities/facts model onto Mem0's memory schema.

**Letta (ex-MemGPT)** (18k GitHub stars)

- Architecture: OS-style memory kernel with short/long-term stores, automatic eviction, system call interface (`mem_read`, `mem_write`, `search_memory`). Event-driven triggers.
- Self-hosted (Apache-2.0), Docker + PostgreSQL.
- Fit for Gneiss: weaker. Heavy abstraction, no knowledge graph, requires its own infra stack. Doesn't align with our CF-native deployment.

**Zep / Graphiti** (17.3k GitHub stars for Graphiti)

- Architecture: temporal knowledge graph. Continuous ingestion of interactions into a unified graph with time consideration. Incremental updates, search by embeddings + keywords + graph trajectories.
- Key differentiator: temporal queries handle fact changes and recency. Multi-hop reasoning across entity relationships.
- Apache-2.0. Python/TS/Go SDKs.
- Fit for Gneiss: interesting for the temporal knowledge graph concept, but requires separate graph DB infrastructure (Neo4j). Doesn't align with our CF-native stack. Could inform our own D1-based knowledge graph design.

**Pros of external memory layer:** Solves temporal reasoning, knowledge versioning, conflict detection, and efficient retrieval as proven infrastructure. Faster time-to-value. Benchmarked performance.
**Cons:** External dependency on a critical path. Latency of network hop per agent interaction. Data residency / privacy implications (user's knowledge lives in a third-party service). Vendor risk for a core intelligence layer.

### Approach C: Hybrid — Google ADK's "Context as Compiled View" Pattern

Google's Agent Development Kit (ADK, open source) introduces a principled architecture worth studying:

**Core thesis:** "Context is a compiled view over a richer stateful system." Sessions, memory, and artifacts are _sources_. Flows and processors are the _compiler pipeline_. Working context is the _compiled view_ shipped to the LLM for one invocation.

Key patterns from ADK:

- **Separate storage from presentation** — durable state (Sessions) vs. per-call views (working context). Evolve storage schemas and prompt formats independently.
- **Explicit transformations** — context is built through named, ordered processors, not ad-hoc string concatenation. Observable and testable.
- **Scope by default** — every model call sees the minimum context required. Agents must reach for more explicitly via tools.
- **Artifacts as handles** — large data lives in external storage, referenced by name. Only loaded into working context on demand, then offloaded after the call.
- **Memory as agent-directed retrieval** — agents decide when to search the memory corpus (reactive recall), or a preprocessor proactively injects likely-relevant snippets (proactive recall).
- **Context compaction** — when session history exceeds a threshold, an LLM summarizes older events into a compact form. Summarized events are pruned.
- **Multi-agent scoping** — when one agent calls another, context is explicitly scoped. Sub-agents see only what they need, not the full ancestral history.

**Fit for Gneiss:** The ADK "compiled view" pattern maps cleanly onto our architecture. We could implement it natively using our existing infrastructure:

- D1 + DO SQLite = the "sources" (sessions, knowledge graph, note content)
- A per-agent `assembleContext()` function = the "compiler pipeline"
- The system prompt + context payload = the "compiled view"
- Vectorize = the "memory search" backend (optional)
- R2 artifacts = the "handle pattern" for large data

This is essentially a more disciplined version of Approach A, with explicit concepts borrowed from ADK's architecture.

### Recommendation

**Start with Approach A (Tiered Context Assembly) using ADK's "compiled view" discipline (Approach C). Evaluate Supermemory as a Tier 3/4 replacement if our homegrown context assembly proves insufficient.**

Rationale:

1. We already have all the infrastructure for Approach A (D1, DO RPC, IndexAgent). The missing piece is the `assembleContext()` function per agent and the user profile synthesis.
2. ADK's patterns (scope by default, explicit processors, context compaction) are architectural principles we can adopt without adopting ADK itself.
3. Supermemory's relational versioning and temporal grounding are genuinely novel and directly relevant to our entities/facts model. If our Tier 3 (structured D1 queries) proves too simplistic — e.g., we need temporal reasoning across fact changes, or conflict detection at the memory layer — Supermemory is the strongest external option.
4. An external memory service on a critical path (every agent interaction) introduces latency and vendor risk that we should defer until we've proven we need it.

### Approach D: Patterns from Pi (badlogic/pi-mono Coding Agent)

Pi is a TypeScript coding agent with a mature context management system. Several of its patterns map directly onto our problem, even though it solves a different domain (coding vs. knowledge management).

**Pattern 1: Layered Message Transformation Pipeline**
Pi has a two-stage pipeline before every LLM call:

```
AgentMessage[] (full history with custom types)
  → transformContext() (prune, inject external context)
    → convertToLlm() (type conversion to LLM-compatible messages)
      → LLM call
```

`transformContext` operates on the full message history and can prune, summarize, or inject. `convertToLlm` handles type conversion (custom message types → standard roles). This is nearly identical to ADK's "compiled view" concept (Approach C) but simpler and more pragmatic.

**Gneiss analog:** Our `assembleContext()` per agent IS this pipeline. Stage 1: pull relevant context from D1/IndexAgent/Vectorize (our "transformContext"). Stage 2: format into system prompt + user message (our "convertToLlm"). The two-stage separation is worth preserving — it cleanly decouples "what context do I need" from "how do I format it for this LLM."

**Pattern 2: Iterative Compaction (Progressive Summarization)**
When context exceeds a threshold (`contextTokens > contextWindow - reserveTokens`), Pi runs compaction:

1. Find a cut point in the message history (walk backwards, accumulate token counts)
2. Summarize the older portion via LLM using a structured format (Goal, Constraints, Progress, Key Decisions, Next Steps, Critical Context)
3. Each new compaction UPDATES the previous summary (iterative, not from-scratch) via `UPDATE_SUMMARIZATION_PROMPT` with `<previous-summary>` tags
4. File tracking accumulates across compactions (`readFiles`, `modifiedFiles`)
5. The compacted summary becomes the first message in the LLM context, followed by the kept recent messages

**Gneiss analog:** Our OrganizationAgent heartbeat already does something like this — extracting entities, facts, and clusters from notes. But we haven't thought about compacting the _note itself_ or the _user profile_ iteratively. The Pi pattern suggests our User Profile (Tier 1) should be built via iterative summarization — each heartbeat updates the previous profile rather than regenerating from scratch. This preserves accumulated insight while incorporating new information. The structured format (Goal, Progress, Key Decisions) is also directly applicable to our user profile schema.

**Pattern 3: Extension Hooks for Context Injection**
Pi's extension system provides multiple injection points:

- `input` — transform user input before processing
- `before_agent_start` — inject custom messages + modify system prompt per turn
- `context` — modify the full message array before each LLM call
- `session_before_compact` — replace the compaction algorithm entirely

Extensions can register LLM-callable tools, slash commands, and even custom LLM providers. Context-related extensions include custom compaction (swap in a different model for summarization) and subagent orchestration (multi-agent with scout/planner/worker/reviewer).

**Gneiss analog:** We don't need a full extension system for MVP, but the _injection point architecture_ is instructive. Our agents could expose similar hooks:

- Before each LLM call: assemble context (our Tier 1-4 pipeline)
- Before each rewrite: inject routing decision + related notes
- Before organization heartbeat: inject previous organization state for iterative update
  These aren't public extension hooks — they're internal architecture. But designing them as explicit, named stages (not ad-hoc string concatenation) is the ADK/Pi lesson.

**Pattern 4: Append-Only Session Tree with Virtual Views**
Pi stores sessions as append-only JSONL (entries never deleted). The tree structure (each entry has `id` and `parentId`) supports branching. `buildSessionContext()` creates a virtual view by walking root→leaf, applying compaction, and filtering.

**Gneiss analog:** This maps directly to our History view. Our note's conversation history should be append-only (in DO SQLite), with the note content itself as the "virtual view" compiled from that history. We already have note version snapshots — this validates that approach. The tree structure could also support branching conversations within a note if we ever need it.

**Pattern 5: Separation of Persisted State and LLM Context**
Pi distinguishes between:

- `CustomEntry` — persisted but NOT sent to LLM (extension state, metadata)
- `CustomMessageEntry` — persisted AND sent to LLM (injected context)
- Messages with `excludeFromContext` — persisted but optionally excluded

**Gneiss analog:** We need this exact distinction. In our RewriteAgent DO SQLite:

- Conversation messages → persisted for History view, NOT replayed to LLM (per our Ephemeral Thread Model)
- Note content → persisted AND sent to LLM (source of truth)
- Agent metadata (routing decisions, version timestamps) → persisted, not sent to LLM
  This validates our earlier design decision to break the AIChatAgent pattern of replaying `this.messages` to the LLM.

**Pattern 6: System Prompt as Compiled View (Never Persisted)**
Pi rebuilds the system prompt from resources each time: tools + skills + project context files + date/time. The system prompt is never stored in the session — it's always reconstructed. Extensions can modify it per-turn.

**Gneiss analog:** Our agents' system prompts should similarly be compiled, not stored. The RewriteAgent system prompt = base instructions + user profile (Tier 1) + routing decision + relevant context. Rebuilt per interaction. Never persisted as part of conversation history.

### Open Research Questions

1. **User profile synthesis** — what model/frequency produces the best compact profile? LLM-generated summary vs. structured extraction? How often to rebuild?
2. **Context budget per agent** — what token budget per tier produces the best results without over-spending? Need empirical testing.
3. **Temporal reasoning** — our D1 facts table has timestamps and `superseded_by`, but no temporal query language. Is this sufficient, or do we need Supermemory/Zep-style temporal grounding?
4. **Cross-note context for RewriteAgent** — when rewriting a note, how many related notes/facts should be injected? Zero (current note only) vs. top-K related vs. all linked? What retrieval strategy?
5. **Context compaction** — for the OrganizationAgent (which needs the richest context), do we need ADK-style compaction, or is the structured D1 query approach sufficient?
6. **Memory-as-a-service evaluation** — benchmark our homegrown Tier 3/4 against Supermemory on our own data. What's the accuracy delta? What's the latency cost of the external hop?

---

## Core Data Model

### Naming Conventions

- Tables use lowercase snake_case. Domain tables are plural (`notes`, `entities`, `facts`, `collections`, `collection_notes`, `note_links`, `action_items`, `user_preferences`, `openclaw_tokens`, `audit_logs`). Auth tables keep the existing singular names (`user`, `session`, `account`, `verification`).
- Exported Drizzle table constants mirror the table name (`export const notes = sqliteTable("notes", ...)`).
- Column names are lowercase snake_case; TypeScript property names are camelCase (`userId` → `user_id`).
- Primary keys are `id`. Use `text` IDs for globally-addressable records (notes, entities, facts) and integer auto-increment for local-only tables (e.g., DO-local `note_versions`).
- Foreign keys use `<table>_id` with snake_case and reference the target table's `id`.
- Timestamps use `created_at`, `updated_at`, optional `deleted_at` and store `timestamp_ms` integers with `unixepoch` defaults and `$onUpdate` for `updated_at`.
- Booleans use `integer` with `{ mode: "boolean" }` and defaults (`false` unless otherwise specified).
- Index names use `<table>_<field>_idx`, matching the TypeScript field name used in the schema (example: `session_userId_idx`).

### Data Model Split

**Inside each RewriteAgent DO (co-located per-note state):**

- Current note content + title + metadata (local SQLite)
- Full conversation history (auto-managed by AIChatAgent in `cf_ai_chat_agent_messages`)
- Note version snapshots for revert (optional, post-v1)
- Stream chunks for resumable streaming (auto-managed)

**In D1 (shared relational, cross-note queryable, per-user scoped):**

| Table              | Purpose                                                      |
| ------------------ | ------------------------------------------------------------ |
| `notes`            | Note metadata: id, user_id, title, summary, tags, timestamps |
| `entities`         | Extracted people, projects, topics                           |
| `facts`            | Atomic statements derived from notes                         |
| `collections`      | Auto-generated clusters of related notes                     |
| `collection_notes` | Many-to-many: collections ↔ notes                            |
| `note_links`       | Relationships between notes                                  |
| `action_items`     | Detected tasks with due dates, status                        |
| `user_preferences` | Agent behavior settings learned from user                    |
| `openclaw_tokens`  | External integration auth tokens                             |
| `audit_logs`       | Agent actions for transparency                               |

**In Vectorize (optional):** note embeddings, entity embeddings (only if semantic search/clustering needs it)

**In R2:** audio files, images, PDFs, screenshots

**In KV:** session tokens, rate limit counters, routing index cache

### Dual-Write Pattern

Every agent that mutates note data writes to both its local SQLite (for co-located speed) AND D1 (for cross-note queries). The IndexAgent is notified via DO RPC to trigger reactive broadcasts.

```
RewriteAgent finishes rewrite:
  1. Save to local SQLite (note version, conversation entry)
  2. Sync summary to D1 (title, summary, tags, updated_at)
  3. Notify IndexAgent via DO RPC → broadcasts to all connected clients
```

**Consistency caveat:** The three writes (DO SQLite → D1 → IndexAgent RPC) have no cross-store transaction. If D1 succeeds but IndexAgent notification fails, the sidebar is stale until IndexAgent's next cold start re-hydrates from D1. Data is never lost — only temporarily out of sync in the UI. For workflow-driven writes, wrapping the notify step in `step.do()` ensures retry on failure.

### Dedupe & Idempotency

- `notes` include `source_message_id` and `dedupe_key`
- Ingest endpoints are idempotent on `dedupe_key` (UNIQUE constraint)

---

## Capture Pipeline

### Inputs

- **Blank-page note** (primary): User writes in the new note view, hits "Save." Agent consumes the content and rewrites/replaces it with organized output. User can watch in real time or leave and come back to the result. Notes are stored as Markdown.
- **Slash command within note**: User types `/ask`, `/research`, `/link`, `/summarize`, or freeform `/...` only when the slash token is unknown to editor formatting commands. The command is consumed — it disappears, and the agent folds new content into the existing note, restructuring as needed.
- **OpenClaw text** (optional): short messages and commands → stored as notes → agent rewrites
- **OpenClaw voice** (optional): audio link + transcript → stored as notes → agent rewrites
- **Email forward** (optional): raw email payload + metadata

### Processing Steps

1. **From web app (Save):**
   - Save raw user input to conversation history (AIChatAgent auto-manages)
   - RouterAgent classifies input → routing decision (< 1 second)
   - If `new_note`: Create note in D1, client connects to new RewriteAgent DO, streams rewrite
   - If `update_existing` / `correction`: Client connects to existing RewriteAgent DO, streams update
   - If `split`: Multiple RewriteAgent DOs created, primary streamed, others in background
   - If `fan_out`: Primary note streamed, OrganizationAgent queues background updates
   - If `workspace_action`: Execute action → toast → blank page resets
   - If `ephemeral_answer`: Show answer until next user input or `8000ms` idle timeout → blank page resets
   - If `store_preference`: Save to D1 `user_preferences` → toast → blank page resets
   - If `duplicate`: Toast with link to existing note → blank page resets

2. **From slash command:** Append to conversation history → remove from note surface → RewriteAgent rewrites/extends note → stream changes

3. **From OpenClaw:** Validate token + scope → RouterAgent classifies → route accordingly → enqueue for background processing

4. All paths: raw user input always preserved in DO conversation history; note surface always shows the clean result; blank page resets after non-note interactions

### Conversation History Storage

Managed automatically by AIChatAgent. Each RewriteAgent DO stores messages in its local SQLite (`cf_ai_chat_agent_messages` table). The `useAgentChat({ resume: true })` hook on the client auto-loads history and resumes interrupted streams.

For lightweight launch revert, we maintain a custom `note_versions` table in the DO:

```sql
CREATE TABLE note_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  title TEXT,
  created_at INTEGER NOT NULL
);
```

This enables:

- **History view:** Show the raw back-and-forth (from AIChatAgent messages)
- **Version revert:** Restore note to any previous snapshot (from `note_versions`)
- **Audit trail:** Every user prompt and agent action is preserved for transparency

Note: the agent does **not** replay the full message history as LLM context (see [[#Ephemeral Thread Model]]). The note content is the carrier of accumulated knowledge; the message history is for the user's History view and version revert, not for the LLM.

---

## Organization Pipeline

### Core Tasks

- Entity extraction (people, projects, topics)
- Fact extraction (atomic statements + confidence)
- Action item detection (status + deadline hints)
- Clustering (notes → collections)
- Linking (collection↔collection, collection↔entity)

### Clustering Strategy (Initial)

- Entity overlap + keyword similarity as primary signals (no embeddings required).
- Recency as a weak prior for grouping.
- Add embeddings if clustering quality requires semantic similarity.

### Contradiction Detection

- Same entity + incompatible facts + similar context
- Surfaces as a decision task; never auto-delete facts
- Uses AgentWorkflow with `waitForApproval()` for human-in-the-loop resolution

---

## Surfacing & Querying

### Digest Generation

- Curate priority actions, contradictions, and emerging themes
- Citations link back to collections and notes

### Query Responses

- Prefer synthesized answers over raw excerpts
- Provide citations + related collections
- Include open action items when relevant

### Action Workflow

- Convert surfaced items to output artifacts (summary doc, export)
- Allow user to mark collections as resolved or keep active

---

## Workflows

### AgentWorkflow for Durable Background Processing

Background pipelines use `AgentWorkflow` for durable multi-step execution with per-step retry, progress reporting, and human-in-the-loop.

### Organization Heartbeat Workflow

```typescript
import { AgentWorkflow } from "agents/workflows";

class OrganizeWorkflow extends AgentWorkflow<OrganizationAgent, OrganizeParams> {
	async run(event, step) {
		const { userId, noteIds } = event.payload;

		// Each step is durable — completed steps NOT re-executed on retry
		const entities = await step.do(
			"extract-entities",
			{
				retries: { limit: 3, delay: "5 seconds", backoff: "exponential" },
			},
			async () => extractEntities(noteIds),
		);
		await this.reportProgress({ stage: "entities", percent: 0.15 });

		const facts = await step.do(
			"extract-facts",
			{
				retries: { limit: 3, delay: "5 seconds", backoff: "exponential" },
			},
			async () => extractFacts(noteIds, entities),
		);
		await this.reportProgress({ stage: "facts", percent: 0.3 });

		const actions = await step.do(
			"detect-actions",
			{
				retries: { limit: 3, delay: "5 seconds", backoff: "exponential" },
			},
			async () => detectActions(noteIds),
		);

		const embeddings = await step.do("generate-embeddings", async () =>
			generateEmbeddings(noteIds),
		);

		// If clustering fails here, steps 1-4 are cached — only this retries
		const clusters = await step.do(
			"cluster-notes",
			{
				retries: { limit: 3, delay: "10 seconds", backoff: "exponential" },
			},
			async () => clusterNotes(embeddings, entities),
		);

		const contradictions = await step.do("detect-contradictions", async () =>
			detectContradictions(facts),
		);

		await step.do("persist", async () =>
			persistResults(entities, facts, actions, clusters, contradictions),
		);

		// Notify IndexAgent → instant UI update for all connected clients
		await step.do("notify-index", async () => {
			const index = getAgentByName(this.env.INDEX_AGENT, userId);
			await index.collectionsUpdated(clusters);
			await index.actionItemsUpdated(actions);
		});

		// Mark notes as processed
		await step.do("mark-processed", async () => {
			await this.env.DB.prepare(
				`UPDATE notes SET processed = 1 WHERE id IN (${noteIds.map(() => "?").join(",")})`,
			)
				.bind(...noteIds)
				.run();
		});

		await step.reportComplete({ processed: noteIds.length, clusters: clusters.length });
	}
}
```

### Fan-Out Workflow (Solves Partial-Update Consistency)

```typescript
class FanOutWorkflow extends AgentWorkflow<RouterAgent, FanOutParams> {
	async run(event, step) {
		const { targetNoteIds, input, context } = event.payload;

		// Each note update is its own durable step — retries independently
		for (const noteId of targetNoteIds) {
			await step.do(
				`update-${noteId}`,
				{
					retries: { limit: 3, delay: "5 seconds", backoff: "exponential" },
				},
				async () => {
					const rewriter = getAgentByName(this.env.REWRITE_AGENT, noteId);
					await rewriter.applyUpdate(input, context);
				},
			);
		}

		await step.reportComplete({ updated: targetNoteIds.length });
	}
}
```

### Contradiction Resolution (Human-in-the-Loop)

```typescript
class ContradictionWorkflow extends AgentWorkflow<OrganizationAgent, ContradictionParams> {
	async run(event, step) {
		const { factA, factB } = event.payload;

		const analysis = await step.do("analyze", async () => analyzeContradiction(factA, factB));

		// Workflow PAUSES here. Can wait up to 1 year.
		// User sees contradiction in Action Center.
		// Clicks "Keep A" or "Keep B" → agent calls approveWorkflow()
		const resolution = await this.waitForApproval<{
			keep: "factA" | "factB";
			reason?: string;
		}>(step, { timeout: "30 days" });

		await step.do("apply-resolution", async () => {
			const superseded = resolution.keep === "factA" ? factB : factA;
			const kept = resolution.keep === "factA" ? factA : factB;
			await supersedeFact(superseded.id, kept.id, resolution.reason);
		});

		await step.reportComplete({ resolved: true, kept: resolution.keep });
	}
}
```

### Workflow Limits

- Max 1,024 steps per workflow
- 10MB state per workflow
- 30 min max per step
- Events wait up to 1 year
- No direct WebSocket from workflows — use `broadcastToClients()` through agent

### Background Process Visibility

```typescript
class OrganizationAgent extends Agent<Env> {
	async onWorkflowProgress(workflowName, instanceId, progress) {
		this.broadcast(
			JSON.stringify({
				type: "agent-status",
				pipeline: workflowName,
				...progress,
			}),
		);
	}

	async onWorkflowComplete(workflowName, instanceId, result) {
		this.broadcast(
			JSON.stringify({
				type: "agent-status",
				pipeline: workflowName,
				status: "complete",
				result,
			}),
		);
	}
}
```

---

## Optional OpenClaw Integration

Gneiss works without OpenClaw. OpenClaw adds bot-based capture and delivery, but the core app runs independently.

### Inbound Endpoints (when enabled)

| Endpoint               | Method | Purpose                         |
| ---------------------- | ------ | ------------------------------- |
| `/api/openclaw/ingest` | POST   | Receive captures from OpenClaw  |
| `/api/openclaw/query`  | POST   | Answer natural language queries |
| `/api/openclaw/digest` | POST   | Return recurring summaries      |

### Auth

- Token-based auth per OpenClaw connection (stored in D1 `openclaw_tokens`)
- Scopes: `capture`, `query`, `push`, `admin`
- Rate limiting per token + per user (via KV)

### Optional Outbound Push (Gneiss → OpenClaw)

- Use OpenClaw **webhooks** (`/hooks/agent`) to send digests to a chat surface
- Requires user-provided OpenClaw hook URL + token
- Delivery targets can be `last` channel or explicit `channel`/`to`

### MCP Server Support

Each agent can expose tools via MCP using the `McpAgent` base class. External tools (Claude Code, OpenClaw) can call gneiss agent tools directly as MCP tool providers.

---

## Search & Retrieval

### Indices

- **D1 indexes:** text search on `notes.title`, `notes.summary`, `entities.name`
- **Vectorize (optional):** note/entity embeddings if we decide semantic retrieval is required.

### Retrieval Strategy

- Start with text + structured retrieval (D1 + knowledge graph).
- Add embeddings only if search quality or clustering requires it.

---

## Storage & Files

### File Handling

- Store audio/images in R2 (S3-compatible)
- Persist file metadata in D1 (note_id, file_key, content_type, size)
- Attach transcript to the note when ready

### Exports

- Markdown bundle (notes + collections + links)
- JSON export for structured data
- D1 is SQLite, R2 is S3-compatible — data is inherently portable

---

## Security & Privacy

### Principles

1. **OpenClaw as untrusted client** — Validate all input, scope permissions
2. **No secrets in code** — Environment variables for all credentials, `wrangler secret put`
3. **User data isolation** — All D1 queries scoped by authenticated userId, DO instances per-user or per-note
4. **Audit logging** — Track agent actions in `audit_logs` table for transparency

### Threat Model Alignment

- Treat external messages as prompt-injection vectors
- Enforce strict tool allowlists on agent actions
- Log all OpenClaw-ingested content and agent outputs
- Treat OpenClaw skills as trusted code; avoid unvetted skill packs

### Abuse Prevention

- Token rotation + revocation (D1 `openclaw_tokens`)
- Per-token rate limits (KV counters)
- Payload size caps + schema validation (Hono middleware)

---

## Observability & Operations

### Logging

- Workers Observability enabled in wrangler.jsonc
- Structured logs for ingest, processing, and surfacing
- Trace IDs across capture → organization → surfacing
- Custom observability override on agents for fine-grained control

### Metrics

- Captures per source
- Organization success/failure counts (workflow status in `cf_agents_workflows`)
- LLM token usage per user
- Digest generation latency
- DO hibernation / wake counts

### Diagnostics

- Workflow status tracking via `cf_agents_workflows` SQL table
- Agent lifecycle callbacks: `onWorkflowProgress`, `onWorkflowComplete`, `onWorkflowError`
- `this.getWorkflows()` for listing/pagination of workflow instances

---

## Cost Controls

- Per-user model usage caps
- Low-cost models for lightweight tasks (Gemini Flash for routing, heavier models for synthesis)
- Batch embedding generation via Vectorize
- Cache summaries per collection (KV or D1)
- DO hibernation: agents sleep when idle, only charge when active
- BYOK option: let users bring their own LLM API key

---

## Open Technical Questions

1. **Offline sync strategy** — How to handle capture queue conflicts?
2. **Notification delivery** — Push via PWA vs. OpenClaw hooks?
3. **Embedding model** — defer until we decide embeddings are required.
4. **Rate limiting** — Per-user LLM cost caps? Slash commands are LLM-heavy; need per-note and per-user throttling.
5. **Outbound delivery** — How to handle OpenClaw gateways not reachable from Gneiss?
6. **Rewrite strategy** — Full document replacement vs. structured diff? Full replacement is simpler but means streaming the entire note on every interaction. Structured diff is more efficient but harder to implement with Tiptap. May need a hybrid.
7. **Slash command parsing** — How to distinguish Tiptap's built-in slash commands (for formatting) from agent slash commands? Namespace: `/heading` = Tiptap, `/ask` = agent? Or separate trigger character?
8. **Rewrite latency** — Full document rewrite is slower than appending. For long notes, the agent needs to produce a complete new version. Options: partial rewrite (only changed sections), or append-then-restructure.
9. **Concurrent editing** — What happens if the user is typing while the agent is rewriting? Need a locking or conflict resolution strategy. Simplest: user input pauses agent rewrite.
10. **Router accuracy** — The RouterAgent needs a lightweight index. Titles + tags + first line may suffice. Full content is too expensive. Routing index cached in KV for fast access.
11. **Ephemeral answer lifecycle** — How long does the temporary answer stay before blank page resets? Auto-dismiss after N seconds? Dismiss on user interaction?
12. **Fan-out consistency** — Solved by AgentWorkflow: each note update is its own durable step with retry. Partial failures resume from last successful step.
13. **Duplicate detection threshold** — Embedding similarity threshold? Entity overlap? Risk of false positives vs. false negatives.
14. **Vectorize maturity** — defer until we decide embeddings are required.
15. **D1 row limits** — 10GB per database. Fine for single-user; at scale, may need per-user D1 databases.
16. **DO cold start latency** — ~50-100ms for hibernated DOs. Test with full agent initialization.
17. **better-auth D1 adapter** — Verify adapter exists and works. Fallback: custom JWT or Cloudflare Access.
18. **TanStack Start on Workers** — Verify compatibility with `@cloudflare/vite-plugin` and agents middleware.

---

_This document will evolve as implementation progresses._
