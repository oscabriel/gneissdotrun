# Cloudflare Agents Architecture

---

## Executive Summary

The Cloudflare `agents` SDK (built on Durable Objects) is the architectural foundation for gneiss. Each note becomes its own stateful agent with co-located SQLite, conversation history, and resumable streaming. The agent-per-entity pattern maps directly to gneiss's core interaction: user brain dumps → agent rewrites note → user watches morph.

Cross-note reactivity (sidebar, note list, collections) is handled by an IndexAgent pattern — a per-user Durable Object that maintains the reactive note index and broadcasts changes via WebSocket to all connected clients.

---

## The Cloudflare Ecosystem Stack

| Layer             | Service                                                |
| ----------------- | ------------------------------------------------------ |
| Backend runtime   | Workers + Durable Objects                              |
| Realtime sync     | WebSocket state sync via `agents` SDK                  |
| Agent framework   | `agents` + `@cloudflare/ai-chat` (AIChatAgent)         |
| Database          | D1 (relational SQLite) + per-DO SQLite                 |
| Vector search     | Vectorize (CF vector DB)                               |
| File storage      | R2 (S3-compatible object storage)                      |
| Scheduling/cron   | `this.schedule()` / `this.scheduleEvery()` (DO alarms) |
| Workflows         | `AgentWorkflow` (durable, agent-integrated)            |
| Auth              | `better-auth` via Workers + D1/KV                      |
| React integration | `useAgent` + `useAgentChat` hooks                      |
| Frontend deploy   | Workers                                                |
| Backend deploy    | Workers (same platform as frontend)                    |

---

## Cloudflare Agents SDK — Key Capabilities

### Agent Base Class

Each agent instance = one Durable Object with its own isolated SQLite database, WebSocket server, scheduling, and state management.

```typescript
import { Agent, callable } from "agents";

export class MyAgent extends Agent<Env, State> {
	initialState = {
		/* ... */
	};

	// State: persisted to SQLite, auto-broadcast to all connected WebSocket clients
	// this.state (getter), this.setState(newState)

	// SQL: full SQLite access within the DO
	// this.sql`CREATE TABLE ...`, this.sql`SELECT ...`

	// Scheduling: survives restarts, cron expressions supported
	// this.schedule(when, method, payload)
	// this.scheduleEvery(intervalSeconds, method, payload)

	// RPC: client-callable methods via WebSocket
	@callable()
	myMethod(args) {
		/* ... */
	}

	// Queue: FIFO task execution
	// this.queue(callback, payload)
}
```

### AIChatAgent (extends Agent)

Purpose-built for conversational AI with persistence, streaming, and tools.

- **Message persistence**: stored in DO SQLite (`cf_ai_chat_agent_messages`), auto-loaded
- **Resumable streaming**: stream chunks stored in SQLite; on reconnect, server replays from where client left off
- **Tool support**: server-side and client-side tools via AI SDK
- **Core override**: `onChatMessage(onFinish, options)` — return a `streamText()` response

```typescript
import { AIChatAgent } from "@cloudflare/ai-chat";
import { streamText } from "ai";

export class ChatAgent extends AIChatAgent<Env> {
	async onChatMessage(onFinish) {
		const result = streamText({
			model: google("gemini-2.5-flash"),
			messages: await convertToModelMessages(this.messages),
		});
		return createUIMessageStreamResponse({
			stream: createUIMessageStream({
				execute: async ({ writer }) => {
					writer.merge(result.toUIMessageStream({ onFinish }));
				},
			}),
		});
	}
}
```

### React Hooks

```tsx
// Connect to an agent instance via WebSocket
const agent = useAgent<State>({
	agent: "MyAgent",
	name: "instance-id", // per-user isolation key
	onStateUpdate: (state) => {
		/* reactive! */
	},
});

// AI chat with streaming, resumable, tools
const chat = useAgentChat({
	agent,
	resume: true, // auto-resume streams on reconnect
});
```

### Workflows

Durable multi-step operations with retries, progress reporting, and human-in-the-loop.

```typescript
class OrganizeWorkflow extends AgentWorkflow<Agent, Params> {
	async run(event, step) {
		const entities = await step.do("extract", () => extractEntities(event.payload));
		await this.reportProgress({ step: "extract", status: "complete" });
		const clusters = await step.do("cluster", () => clusterNotes(entities));
		return clusters;
	}
}
```

### Other Primitives

- **Email**: `onEmail(email)` handler, secure reply routing with HMAC, address-based routing
- **MCP**: `McpAgent` serves as MCP server — external tools (Claude Code, OpenClaw) can call agent tools directly
- **DO RPC**: agents call each other via typed stubs (`getAgentByName(env.OtherAgent, id)`)
- **Hibernation**: DOs sleep when no connections, wake on request — cost-efficient

---

## Architecture for Gneiss

### Durable Object Classes

```
IndexAgent          (1 per user)   — reactive cross-note index
RouterAgent         (1 per user)   — input classification + routing
RewriteAgent        (1 per note)   — note content, conversation, streaming
OrganizationAgent   (1 per user)   — background clustering, linking, extraction
SurfacingAgent      (1 per user)   — query synthesis, digests
```

### System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  TanStack Start + React (deployed on Workers)                    │
│                                                                  │
│  useAgent("IndexAgent", userId)     → sidebar, note list, search │
│  useAgent("RewriteAgent", noteId)   → editor, note morphing      │
│  useAgentChat(rewriteAgent)         → streaming + conversation   │
└──────────────┬──────────────────────────────┬────────────────────┘
               │ WebSocket                    │ WebSocket
               ▼                              ▼
┌───────────────────────┐    ┌─────────────────────────────────────┐
│  IndexAgent (per user)│    │  RewriteAgent (per note)            │
│                       │    │                                     │
│  Reactive state:      │◄───│  On note save → notifies IndexAgent │
│  - note stubs         │    │  AIChatAgent: conversation history, │
│  - collections        │    │  resumable streaming, tool calling  │
│  - action items       │    │  Local SQLite: note versions,       │
│  - recent activity    │    │  metadata, content                  │
│                       │    │                                     │
│  setState() →         │    │  Streams rewritten note to client   │
│  broadcasts to ALL    │    │  in real time (note morphing)       │
│  connected clients    │    │                                     │
└───────────────────────┘    └─────────────────────────────────────┘
         ▲                              ▲
         │ DO RPC                       │ DO RPC
         │                              │
┌────────┴─────────────┐    ┌───────────┴─────────────────────────┐
│  OrganizationAgent   │    │  RouterAgent (per user)             │
│  (per user)          │    │                                     │
│  Scheduled heartbeat │    │  Receives all "Go" presses          │
│  every 6 hours       │    │  Single LLM call → routing decision │
│  Extracts entities,  │    │  Routes to RewriteAgent, or         │
│  facts, clusters     │    │  executes workspace action,         │
│  Notifies IndexAgent │    │  returns ephemeral answer, etc.     │
│  when done           │    │                                     │
│  Uses AgentWorkflow  │    │  Maintains lightweight note index   │
│  for long-running    │    │  for fast routing decisions         │
│  operations          │    │                                     │
└──────────────────────┘    └─────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Shared Cloudflare Services                                     │
│                                                                 │
│  D1 (SQLite)     — source of truth: notes, entities, facts,     │
│                    collections, links, action items, users      │
│  Vectorize       — note + entity embeddings for semantic search │
│  R2              — file storage: audio, images, PDFs            │
│  KV              — sessions, rate limits, cached routing indexes│
│  Workers         — Hono router: /agents/*, /api/*, SSR          │
└─────────────────────────────────────────────────────────────────┘
```

### Data Model Split

**Inside each RewriteAgent DO (co-located per-note state):**

- Current note content + title + metadata (local SQLite)
- Full conversation history (auto-managed by AIChatAgent)
- Note version snapshots for revert (local SQLite)
- Stream chunks for resumable streaming (auto-managed)

**In D1 (shared relational, cross-note queryable):**

```sql
notes           (id, user_id, title, summary, tags, content_hash, created_at, updated_at, processed)
entities        (id, user_id, name, type, summary, mention_count, first_mentioned, last_mentioned)
facts           (id, user_id, entity_id, fact, category, status, confidence, source_note_id, timestamp)
collections     (id, user_id, title, summary, status)
collection_notes (collection_id, note_id)
note_links      (from_note_id, to_note_id, link_type, confidence)
action_items    (id, user_id, note_id, description, deadline, status)
user_preferences (id, user_id, category, preference, confidence)
audit_logs      (id, user_id, agent, action, note_id, timestamp, details)
```

**In Vectorize:** note embeddings, entity embeddings (for semantic search + clustering)

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

**Consistency caveat:** These three writes have no transactional guarantee across stores. If the D1 write succeeds but the IndexAgent RPC fails, the sidebar is stale until the next IndexAgent cold start (which re-hydrates from D1). This is acceptable — the data is never lost, just temporarily out of sync in the UI. For critical paths (organization workflow), wrapping the notify step in `step.do()` ensures it retries on failure.

---

## Cross-Note Reactivity

### The IndexAgent Pattern

D1 is the relational source of truth but doesn't push changes to clients. The IndexAgent solves this:

- One IndexAgent DO per user, connected to by all browser tabs via WebSocket
- Maintains lightweight reactive state: note stubs, collections, action items
- `this.setState()` broadcasts instantly to all connected clients
- Other agents notify IndexAgent on every mutation via DO RPC
- On cold start / hibernation wake, hydrates from D1

```typescript
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
			.bind(this.userId)
			.all();
		this.setState({ ...this.state, notes: notes.results });
	}

	@callable()
	noteUpdated(stub: NoteStub) {
		const notes = this.state.notes.filter((n) => n.id !== stub.id);
		notes.unshift(stub);
		this.setState({ ...this.state, notes });
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
}
```

**Client side — two simultaneous WebSocket connections:**

```tsx
function App({ userId }) {
	// Global reactivity: sidebar, note list, collections, action items
	const index = useAgent<IndexState>({
		agent: "IndexAgent",
		name: userId,
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

### What Triggers IndexAgent Updates

| Event                    | Source Agent      | IndexAgent Method           |
| ------------------------ | ----------------- | --------------------------- |
| Note created/rewritten   | RewriteAgent      | `noteUpdated()`             |
| Note deleted/archived    | RouterAgent       | `noteDeleted()`             |
| Collections re-clustered | OrganizationAgent | `collectionsUpdated()`      |
| Action items detected    | OrganizationAgent | `actionItemsUpdated()`      |
| Contradiction flagged    | OrganizationAgent | `contradictionDetected()`   |
| Note touched by routing  | RouterAgent       | `noteUpdated()` (timestamp) |

---

## Key Implementation Patterns

### Note Morphing (Real-Time Rewrite Streaming)

```typescript
export class RewriteAgent extends AIChatAgent<Env> {
	async onChatMessage(onFinish) {
		const [currentNote] = this.sql`
      SELECT content FROM note_versions ORDER BY created_at DESC LIMIT 1
    `;

		return createUIMessageStreamResponse({
			stream: createUIMessageStream({
				execute: async ({ writer }) => {
					const result = streamText({
						model: google("gemini-2.5-flash"),
						system: `You are the Gneiss Rewrite Agent.
              Current note content:\n${currentNote?.content || ""}
              Routing decision: ${this.routingContext}
              User preferences: ${this.preferences}`,
						messages: await convertToModelMessages(this.messages),
					});

					writer.merge(
						result.toUIMessageStream({
							onFinish: async (msg) => {
								// Save version locally
								this.sql`INSERT INTO note_versions (content, created_at)
                       VALUES (${msg.text}, ${Date.now()})`;

								// Sync to D1
								await this.env.DB.prepare(
									"UPDATE notes SET title=?, summary=?, updated_at=? WHERE id=?",
								)
									.bind(title, summary, Date.now(), this.noteId)
									.run();

								// Notify IndexAgent for reactive sidebar update
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

### Router Agent

```typescript
export class RouterAgent extends Agent<Env> {
	@callable()
	async processInput(input: string) {
		// Lightweight note index from IndexAgent state or local cache
		const noteIndex = await this.getNoteIndex();

		const decision = await generateObject({
			model: google("gemini-2.5-flash"),
			schema: routingSchema, // zod schema for structured output
			prompt: `Classify this input and decide routing.
        Input: "${input}"
        Existing notes: ${JSON.stringify(noteIndex)}
        User preferences: ${this.preferences}`,
		});

		switch (decision.type) {
			case "new_note": {
				const noteId = crypto.randomUUID();
				// Create note record in D1
				await this.env.DB.prepare(
					"INSERT INTO notes (id, user_id, created_at, processed) VALUES (?, ?, ?, 0)",
				)
					.bind(noteId, this.userId, Date.now())
					.run();
				// Client will connect to RewriteAgent for streaming
				return { route: "new_note", noteId };
			}
			case "update_existing":
				return { route: "update_existing", noteId: decision.noteId };
			case "ephemeral_answer":
				return { route: "ephemeral", answer: decision.answer };
			case "workspace_action":
				await this.executeAction(decision.action);
				return { route: "action_complete", message: decision.confirmation };
			// ... split, fan_out, correction, duplicate, store_preference
		}
	}
}
```

**Design note:** RouterAgent is a DO (1-per-user) rather than a stateless Worker function because it caches the lightweight routing index (note titles, summaries, tags) in DO SQLite for fast classification. This avoids a D1 round-trip on every "Go" press. The index is updated via `@callable()` from IndexAgent whenever notes change. If routing latency becomes a concern, an alternative is caching the index in KV — but DO SQLite co-location is simpler and avoids cache invalidation issues.

### Organization Heartbeat

```typescript
export class OrganizationAgent extends Agent<Env> {
	async onStart() {
		this.schedule("0 */6 * * *", "heartbeat");
	}

	async heartbeat() {
		const unprocessed = await this.env.DB.prepare(
			"SELECT * FROM notes WHERE user_id = ? AND processed = 0",
		)
			.bind(this.userId)
			.all();

		if (unprocessed.results.length === 0) return;

		// Use durable workflow for long-running operation
		await this.runWorkflow("ORGANIZE_WORKFLOW", {
			userId: this.userId,
			noteIds: unprocessed.results.map((n) => n.id),
		});
	}
}

class OrganizeWorkflow extends AgentWorkflow<OrganizationAgent, OrganizeParams> {
	async run(event, step) {
		const { userId, noteIds } = event.payload;

		// Step 1: Extract entities + facts
		const extractions = await step.do("extract", async () => {
			return await extractEntitiesAndFacts(noteIds);
		});
		await this.reportProgress({ step: "extract", complete: true });

		// Step 2: Cluster into collections
		const clusters = await step.do("cluster", async () => {
			return await clusterNotes(extractions);
		});

		// Step 3: Detect contradictions
		const contradictions = await step.do("contradictions", async () => {
			return await detectContradictions(extractions.facts);
		});

		// Step 4: Write results to D1
		await step.do("persist", async () => {
			await persistExtractions(extractions, clusters, contradictions);
		});

		// Step 5: Notify IndexAgent for reactive UI update
		await step.do("notify-index", async () => {
			const index = getAgentByName(this.env.INDEX_AGENT, userId);
			await index.collectionsUpdated(clusters);
			await index.actionItemsUpdated(extractions.actionItems);
		});

		// Mark notes as processed
		await step.do("mark-processed", async () => {
			await this.env.DB.prepare(
				"UPDATE notes SET processed = 1 WHERE id IN (" + noteIds.map(() => "?").join(",") + ")",
			)
				.bind(...noteIds)
				.run();
		});

		await step.reportComplete({ processed: noteIds.length, clusters: clusters.length });
	}
}
```

### SurfacingAgent (Query Synthesis + Digests)

```typescript
import { Agent, callable } from "agents";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";

export class SurfacingAgent extends Agent<Env> {
	async onStart() {
		// Weekly digest generation — Monday 8am UTC
		this.schedule("0 8 * * 1", "generateWeeklyDigest");
	}

	@callable()
	async query(question: string) {
		// Hybrid retrieval: vector similarity + D1 text search
		const embedding = await generateEmbedding(question);
		const vectorResults = await this.env.VECTORIZE.query(embedding, { topK: 10 });
		const noteIds = vectorResults.matches.map((m) => m.id);

		const notes = await this.env.DB.prepare(
			`SELECT id, title, summary, tags FROM notes
			 WHERE user_id = ? AND id IN (${noteIds.map(() => "?").join(",")})`,
		)
			.bind(this.name, ...noteIds)
			.all();

		const collections = await this.env.DB.prepare(
			`SELECT c.id, c.title, c.summary FROM collections c
			 JOIN collection_notes cn ON c.id = cn.collection_id
			 WHERE cn.note_id IN (${noteIds.map(() => "?").join(",")})`,
		)
			.bind(...noteIds)
			.all();

		const facts = await this.env.DB.prepare(
			`SELECT f.fact, f.category, e.name as entity_name FROM facts f
			 JOIN entities e ON f.entity_id = e.id
			 WHERE f.source_note_id IN (${noteIds.map(() => "?").join(",")})
			 AND f.status = 'active'`,
		)
			.bind(...noteIds)
			.all();

		// Synthesize — answer with citations, not raw excerpts
		const { text } = await generateText({
			model: google("gemini-2.5-flash"),
			prompt: `Answer this question using the user's notes. Cite sources with [[Note Title]].
				Question: "${question}"
				Notes: ${JSON.stringify(notes.results)}
				Collections: ${JSON.stringify(collections.results)}
				Facts: ${JSON.stringify(facts.results)}`,
		});

		return { answer: text, sources: notes.results, collections: collections.results };
	}

	async generateWeeklyDigest() {
		const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

		const recentNotes = await this.env.DB.prepare(
			"SELECT id, title, summary, tags FROM notes WHERE user_id = ? AND created_at > ?",
		)
			.bind(this.name, weekAgo)
			.all();

		const actionItems = await this.env.DB.prepare(
			"SELECT * FROM action_items WHERE user_id = ? AND status = 'pending'",
		)
			.bind(this.name)
			.all();

		const collections = await this.env.DB.prepare(
			"SELECT * FROM collections WHERE user_id = ? AND last_capture_at > ?",
		)
			.bind(this.name, weekAgo)
			.all();

		const { text } = await generateText({
			model: google("gemini-2.5-flash"),
			prompt: `Generate a concise weekly digest for the user.
				Notes this week: ${JSON.stringify(recentNotes.results)}
				Pending actions: ${JSON.stringify(actionItems.results)}
				Active collections: ${JSON.stringify(collections.results)}`,
		});

		// Notify IndexAgent to surface digest in UI
		const index = getAgentByName(this.env.INDEX_AGENT, this.name);
		await index.digestReady({ summary: text, noteCount: recentNotes.results.length });
	}
}
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

---

## AgentWorkflow: Durable Background Pipelines

### What Gneiss Background Processing Requires

**Organization Heartbeat** (every 6 hours per user): extract entities → extract facts → detect action items → generate embeddings → cluster into collections → link collections → detect contradictions → update index → notify user. 7-8 sequential steps where each depends on the previous. If clustering fails after entity extraction succeeds, you need to retry clustering — not re-extract.

**Fan-Out Updates**: one user input triggers background updates to multiple existing notes. The tech spec open question #13: _"If 3 of 5 updates succeed and 2 fail, the user's knowledge base is in a partially-updated state. Need retry + eventual consistency guarantees."_

**Contradiction Resolution**: detect conflicting facts → surface to user → wait for decision → apply resolution → update affected notes. A pipeline that pauses for human input, potentially for days.

**Digest Generation**: query across notes → rank findings → synthesize summary with citations. Multi-step, LLM-dependent, should report progress.

### Implementation Patterns

#### Organization Heartbeat

```typescript
class OrganizeWorkflow extends AgentWorkflow<
	OrganizationAgent,
	{ userId: string; noteIds: string[] }
> {
	async run(event, step) {
		const { userId, noteIds } = event.payload;

		// Each step is durable — completed steps are NOT re-executed on retry
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
		await this.reportProgress({ stage: "actions", percent: 0.45 });

		const embeddings = await step.do("generate-embeddings", async () =>
			generateEmbeddings(noteIds),
		);
		await this.reportProgress({ stage: "embeddings", percent: 0.6 });

		// If clustering fails here, steps 1-4 are cached — only this retries
		const clusters = await step.do(
			"cluster-notes",
			{
				retries: { limit: 3, delay: "10 seconds", backoff: "exponential" },
			},
			async () => clusterNotes(embeddings, entities),
		);
		await this.reportProgress({ stage: "clustering", percent: 0.75 });

		const contradictions = await step.do("detect-contradictions", async () =>
			detectContradictions(facts),
		);

		await step.do("persist", async () =>
			persistResults(entities, facts, actions, clusters, contradictions),
		);

		// Notify IndexAgent → instant UI update for all connected clients
		await step.do("notify-index", async () => {
			await this.agent.updateIndex(clusters, actions, contradictions);
		});

		await step.reportComplete({
			processed: noteIds.length,
			entities: entities.length,
			contradictions: contradictions.length,
		});
	}
}
```

#### Fan-Out Updates (Solves Open Question #13)

```typescript
class FanOutWorkflow extends AgentWorkflow<
	RouterAgent,
	{
		targetNoteIds: string[];
		input: string;
		context: string;
	}
> {
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
			await this.reportProgress({
				stage: `update-${noteId}`,
				percent: (targetNoteIds.indexOf(noteId) + 1) / targetNoteIds.length,
			});
		}

		await step.do("notify-index", async () => this.agent.batchUpdateIndex(targetNoteIds));
		await step.reportComplete({ updated: targetNoteIds.length });
	}
}
```

3/5 succeed, 2 fail → workflow retries only the 2 that failed. Progress reports to client: "Updated 3/5 notes..."

#### Contradiction Resolution (Human-in-the-Loop)

```typescript
class ContradictionWorkflow extends AgentWorkflow<
	OrganizationAgent,
	{
		factA: Fact;
		factB: Fact;
	}
> {
	async run(event, step) {
		const { factA, factB } = event.payload;

		const analysis = await step.do("analyze", async () => analyzeContradiction(factA, factB));

		await this.reportProgress({
			stage: "awaiting-resolution",
			status: "pending",
			message: `"${factA.fact}" vs "${factB.fact}"`,
		});

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

		await step.do("update-notes", async () => {
			await this.agent.rewriteWithCorrection(
				resolution.keep === "factA" ? factB : factA,
				resolution.keep === "factA" ? factA : factB,
			);
		});

		await step.reportComplete({ resolved: true, kept: resolution.keep });
	}
}
```

The entire lifecycle — detect → surface → wait → resolve → update — is one trackable, restartable, durable unit. `this.agent.rewriteWithCorrection()` calls the OrganizationAgent's method directly via typed RPC, and `reportProgress` broadcasts to all connected WebSocket clients.

#### Background Process Visibility

The design spec requires showing users what agents are doing. `reportProgress()` broadcasts to WebSocket clients through the parent agent:

```typescript
class OrganizationAgent extends Agent<Env> {
	async onWorkflowProgress(workflowName: string, instanceId: string, progress: unknown) {
		// Auto-broadcast to every connected client tab
		this.broadcast(
			JSON.stringify({
				type: "agent-status",
				pipeline: workflowName,
				...progress, // { stage, status, percent, message }
			}),
		);
	}

	async onWorkflowComplete(workflowName: string, instanceId: string, result: unknown) {
		this.broadcast(
			JSON.stringify({
				type: "agent-status",
				pipeline: workflowName,
				status: "complete",
				result,
			}),
		);
	}

	async onWorkflowError(workflowName: string, instanceId: string, error: string) {
		this.broadcast(
			JSON.stringify({
				type: "agent-status",
				pipeline: workflowName,
				status: "error",
				error,
			}),
		);
	}
}
```

Client renders the agent status bar with real-time progress. No custom infrastructure.

### AgentWorkflow Capabilities

| Capability                   | How                                                     |
| ---------------------------- | ------------------------------------------------------- |
| Recurring triggers           | `this.schedule()` on DO (cron expressions)              |
| Multi-step pipeline          | `step.do()` — each step independently durable           |
| Step-level retry             | Per-step retry with exponential backoff                 |
| Parallel steps               | Multiple `step.do()` calls                              |
| Human-in-the-loop            | `waitForApproval()` + `approveWorkflow()`               |
| Progress → WebSocket clients | `reportProgress()` → agent → `broadcast()`              |
| Agent state sync             | `step.updateAgentState()` → auto-broadcast              |
| Workflow → Agent RPC         | `this.agent.someMethod()` (typed stub)                  |
| Pause/resume                 | `pauseWorkflow()` / `resumeWorkflow()`                  |
| Restart                      | `restartWorkflow()` (same ID, fresh execution)          |
| Nested workflows             | `runWorkflow()` from within step                        |
| Status tracking              | SQL table (`cf_agents_workflows`) + lifecycle callbacks |
| No determinism constraint    | Steps are regular async functions                       |

### Workflow Limits

- Max 1,024 steps per workflow
- 10MB state per workflow
- 30 min max per step
- Events wait up to 1 year
- No direct WebSocket from workflows (use `broadcastToClients()` through agent)

### Key Architectural Properties

| Property                              | Detail                                                                                                        |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Agent-per-entity model**            | Each note is its own DO with co-located state, SQLite, conversation history, scheduling                       |
| **Built-in conversation persistence** | AIChatAgent stores messages in DO SQLite automatically                                                        |
| **Resumable streaming**               | Stream chunks persisted in SQLite; reconnect picks up where it left off. Critical for mobile.                 |
| **Native scheduling**                 | `this.schedule("0 */6 * * *", "heartbeat")` per agent. Cron expressions, delays, intervals. Survives restarts |
| **Agent-native workflows**            | `AgentWorkflow` integrates directly with agent state, WebSocket broadcasts, and typed RPC                     |
| **Email integration**                 | `onEmail()` handler — direct email-to-note pipeline                                                           |
| **MCP server**                        | Each agent can expose tools via MCP. Claude Code and OpenClaw call gneiss agents directly                     |
| **Unified deployment**                | Frontend + agents + DB + storage + vectors. One `wrangler deploy`                                             |
| **Edge-native**                       | Agents run globally close to users. Hibernation = cost-efficient (only pay when active)                       |
| **Portable data**                     | D1 is SQLite. R2 is S3-compatible. Agents SDK is open source                                                  |

---

## Open Questions

- **Vectorize maturity**: is it production-ready for the embedding dimensions and query patterns gneiss needs? May need to evaluate Turbopuffer or Pinecone as alternatives.
- **D1 row limits**: D1 has a 10GB database size limit per database. For a single-user app this is fine; at scale, may need per-user D1 databases or a different shared store.
- **DO cold start latency**: first request to a hibernated DO has ~50-100ms overhead. Acceptable for note opens, but test with the full agent initialization.
- **better-auth D1 adapter**: verify the adapter exists and works. If not, auth may need a different approach (Cloudflare Access, custom JWT, etc.).
- **TanStack Start on Workers**: the current spec uses TanStack Start. Verify it works with the CF Vite plugin (`@cloudflare/vite-plugin`) and the agents middleware.
