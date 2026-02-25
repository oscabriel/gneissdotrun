import assert from "node:assert/strict";
import { describe, it, mock } from "bun:test";

import type { RouteExecutionKind } from "@gneissdotrun/api/capture-contract";

interface NamespaceLike {
	idFromName(name: string): string;
	get(id: string): { fetch(url: string, init?: RequestInit): Promise<Response> };
}

mock.module("agents", () => ({
	Agent: class Agent {},
	getAgentByName: async <T>(namespace: NamespaceLike, name: string): Promise<T> => {
		const id = namespace.idFromName(name);
		return namespace.get(id) as T;
	},
}));

mock.module("agents/workflows", () => ({
	AgentWorkflow: class AgentWorkflow {},
}));

const { executeCapture } = await import("./capture");

type CaptureEnv = Parameters<typeof executeCapture>[0];

interface DecisionFixture {
	kind: RouteExecutionKind;
	confidence?: number;
	reason?: string;
	tags?: string[];
	target?: "rewrite-agent" | "organization-agent" | "none";
}

interface NoteRecord {
	id: string;
	userId: string;
	title: string;
	content: string;
	summary: string;
	tags: string;
	updatedAt: number;
	createdAt: number;
	processedAt: number | null;
	deletedAt: number | null;
}

interface UserPreferenceRecord {
	id: string;
	userId: string;
	category: string;
	preference: string;
	confidence: number;
	createdAt: number;
	updatedAt: number;
}

interface FetchCall {
	url: string;
	init?: RequestInit;
}

class FakeD1Statement {
	private params: unknown[] = [];

	constructor(
		private readonly database: FakeD1Database,
		private readonly sql: string,
	) {}

	bind(...params: unknown[]): this {
		this.params = params;
		return this;
	}

	async run(): Promise<{ success: true }> {
		this.database.run(this.sql, this.params);
		return { success: true };
	}

	async first<T>(): Promise<T | null> {
		return this.database.first(this.sql, this.params) as T | null;
	}

	async all<T>(): Promise<{ results: T[] }> {
		return { results: this.database.all(this.sql, this.params) as T[] };
	}
}

class FakeD1Database {
	private readonly notes = new Map<string, NoteRecord>();
	private readonly userPreferences: UserPreferenceRecord[] = [];
	private readonly historyEvents = new Set<string>();

	prepare(sql: string): FakeD1Statement {
		return new FakeD1Statement(this, sql);
	}

	seedNote(input: {
		id: string;
		userId: string;
		title: string;
		content: string;
		summary?: string;
		tags?: string[];
		updatedAt?: number;
		createdAt?: number;
		processedAt?: number | null;
	}): void {
		const now = Date.now();
		this.notes.set(input.id, {
			id: input.id,
			userId: input.userId,
			title: input.title,
			content: input.content,
			summary: input.summary ?? input.content.slice(0, 240),
			tags: JSON.stringify(input.tags ?? []),
			updatedAt: input.updatedAt ?? now,
			createdAt: input.createdAt ?? now,
			processedAt: input.processedAt ?? null,
			deletedAt: null,
		});
	}

	getNote(id: string): NoteRecord | undefined {
		return this.notes.get(id);
	}

	listUserNotes(userId: string): NoteRecord[] {
		return [...this.notes.values()].filter(
			(note) => note.userId === userId && note.deletedAt === null,
		);
	}

	listUserPreferences(userId: string): UserPreferenceRecord[] {
		return this.userPreferences.filter((preference) => preference.userId === userId);
	}

	historyEventCount(): number {
		return this.historyEvents.size;
	}

	run(sql: string, params: unknown[]): void {
		const normalized = this.normalize(sql);
		if (
			normalized.startsWith("create table if not exists") ||
			normalized.startsWith("create index if not exists")
		) {
			return;
		}

		if (normalized.startsWith("insert into notes")) {
			const [id, userId, title, content, summary, tags, createdAt, updatedAt] = params as [
				string,
				string,
				string,
				string,
				string,
				string,
				number,
				number,
			];
			this.notes.set(id, {
				id,
				userId,
				title,
				content,
				summary,
				tags,
				createdAt,
				updatedAt,
				processedAt: null,
				deletedAt: null,
			});
			return;
		}

		if (
			normalized.startsWith(
				"update notes set title = ?1, content = ?2, summary = ?3, updated_at = ?4, processed_at = null",
			)
		) {
			const [title, content, summary, updatedAt, noteId, userId] = params as [
				string,
				string,
				string,
				number,
				string,
				string,
			];
			const note = this.notes.get(noteId);
			if (note && note.userId === userId && note.deletedAt === null) {
				note.title = title;
				note.content = content;
				note.summary = summary;
				note.updatedAt = updatedAt;
				note.processedAt = null;
			}
			return;
		}

		if (normalized.startsWith("update notes set deleted_at = ?1, updated_at = ?2")) {
			const [deletedAt, updatedAt, noteId, userId] = params as [number, number, string, string];
			const note = this.notes.get(noteId);
			if (note && note.userId === userId && note.deletedAt === null) {
				note.deletedAt = deletedAt;
				note.updatedAt = updatedAt;
			}
			return;
		}

		if (normalized.startsWith("insert into user_preferences")) {
			const [id, userId, category, preference, confidence, createdAt, updatedAt] = params as [
				string,
				string,
				string,
				string,
				number,
				number,
				number,
			];
			this.userPreferences.push({
				id,
				userId,
				category,
				preference,
				confidence,
				createdAt,
				updatedAt,
			});
			return;
		}

		if (normalized.startsWith("insert into note_versions")) {
			return;
		}

		if (normalized.startsWith("insert into note_history_events")) {
			const [id] = params as [string];
			this.historyEvents.add(id);
			return;
		}

		if (normalized.startsWith("insert into audit_logs")) {
			return;
		}

		if (
			normalized.startsWith("delete from note_links") ||
			normalized.startsWith("insert into note_links")
		) {
			return;
		}

		throw new Error(`Unsupported SQL (run): ${sql}`);
	}

	first(sql: string, params: unknown[]): unknown {
		const normalized = this.normalize(sql);

		if (
			normalized ===
			"select id, title, content, summary, tags, updated_at, created_at from notes where id = ?1 and user_id = ?2 and deleted_at is null"
		) {
			const [noteId, userId] = params as [string, string];
			const note = this.notes.get(noteId);
			if (!note || note.userId !== userId || note.deletedAt !== null) {
				return null;
			}

			return {
				id: note.id,
				title: note.title,
				content: note.content,
				summary: note.summary,
				tags: note.tags,
				updated_at: note.updatedAt,
				created_at: note.createdAt,
			};
		}

		if (
			normalized ===
			"select content from notes where id = ?1 and user_id = ?2 and deleted_at is null"
		) {
			const [noteId, userId] = params as [string, string];
			const note = this.notes.get(noteId);
			if (!note || note.userId !== userId || note.deletedAt !== null) {
				return null;
			}
			return {
				content: note.content,
			};
		}

		throw new Error(`Unsupported SQL (first): ${sql}`);
	}

	all(sql: string, params: unknown[]): unknown[] {
		const normalized = this.normalize(sql);

		if (
			normalized ===
			"select id, title, content, summary, tags, updated_at, created_at from notes where user_id = ?1 and deleted_at is null order by updated_at desc limit ?2"
		) {
			const [userId, limit] = params as [string, number];
			return [...this.notes.values()]
				.filter((note) => note.userId === userId && note.deletedAt === null)
				.sort((left, right) => right.updatedAt - left.updatedAt)
				.slice(0, limit)
				.map((note) => ({
					id: note.id,
					title: note.title,
					content: note.content,
					summary: note.summary,
					tags: note.tags,
					updated_at: note.updatedAt,
					created_at: note.createdAt,
				}));
		}

		throw new Error(`Unsupported SQL (all): ${sql}`);
	}

	private normalize(sql: string): string {
		return sql.replace(/\s+/g, " ").trim().toLowerCase();
	}
}

class FakeDurableNamespace {
	private readonly stubs = new Map<string, FakeDurableStub>();

	constructor(
		private readonly createResponder: (
			name: string,
			url: string,
			init?: RequestInit,
		) => Promise<Response>,
	) {}

	idFromName(name: string): string {
		return name;
	}

	get(id: string): FakeDurableStub {
		if (!this.stubs.has(id)) {
			this.stubs.set(id, new FakeDurableStub((url, init) => this.createResponder(id, url, init)));
		}
		return this.stubs.get(id)!;
	}

	calls(name: string): FetchCall[] {
		const stub = this.stubs.get(name);
		return stub ? [...stub.calls] : [];
	}
}

class FakeDurableStub {
	readonly calls: FetchCall[] = [];

	constructor(private readonly responder: (url: string, init?: RequestInit) => Promise<Response>) {}

	async fetch(url: string, init?: RequestInit): Promise<Response> {
		this.calls.push({ url, init });
		return this.responder(url, init);
	}
}

function defaultTarget(kind: RouteExecutionKind): "rewrite-agent" | "organization-agent" | "none" {
	switch (kind) {
		case "fan_out":
			return "organization-agent";
		case "workspace_action":
		case "ephemeral_answer":
		case "store_preference":
			return "none";
		default:
			return "rewrite-agent";
	}
}

function decisionPayload(fixture: DecisionFixture): {
	kind: RouteExecutionKind;
	confidence: number;
	reason: string;
	tags: string[];
	target: "rewrite-agent" | "organization-agent" | "none";
} {
	return {
		kind: fixture.kind,
		confidence: fixture.confidence ?? 0.95,
		reason: fixture.reason ?? `test:${fixture.kind}`,
		tags: fixture.tags ?? [fixture.kind],
		target: fixture.target ?? defaultTarget(fixture.kind),
	};
}

function createCaptureTestContext(fixture: DecisionFixture): {
	db: FakeD1Database;
	env: CaptureEnv;
	indexNamespace: FakeDurableNamespace;
	organizationNamespace: FakeDurableNamespace;
} {
	const payload = decisionPayload(fixture);
	const db = new FakeD1Database();
	const routerNamespace = new FakeDurableNamespace(
		async (_name, _url, _init) =>
			new Response(JSON.stringify({ decision: payload }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
	);
	const indexNamespace = new FakeDurableNamespace(
		async (_name, _url, _init) => new Response("{}", { status: 200 }),
	);
	const organizationNamespace = new FakeDurableNamespace(
		async (_name, _url, _init) =>
			new Response(JSON.stringify({ ok: true, workflow: "wf_test" }), {
				status: 200,
				headers: { "content-type": "application/json" },
			}),
	);
	const env = {
		DB: db,
		ROUTER_AGENT: routerNamespace,
		INDEX_AGENT: indexNamespace,
		ORGANIZATION_AGENT: organizationNamespace,
	} as unknown as CaptureEnv;

	return {
		db,
		env,
		indexNamespace,
		organizationNamespace,
	};
}

function parseRequestBody(call: FetchCall): Record<string, unknown> {
	if (!call.init?.body || typeof call.init.body !== "string") {
		return {};
	}

	return JSON.parse(call.init.body) as Record<string, unknown>;
}

describe("UX-083 route execution outcomes", () => {
	const userId = "user_ux083";

	it("executes new_note with open_note outcome", async () => {
		const { db, env, indexNamespace } = createCaptureTestContext({ kind: "new_note" });
		const result = await executeCapture(env, {
			userId,
			userInput: "Capture this thought",
		});

		assert.equal(result.decision.kind, "new_note");
		assert.equal(result.outcome.kind, "new_note");
		assert.equal(result.outcome.uiAction, "open_note");
		assert.ok(result.outcome.noteId);
		assert.equal(db.listUserNotes(userId).length, 1);
		assert.equal(indexNamespace.calls(userId).length, 1);
	});

	it("executes update_existing against the active note", async () => {
		const { db, env, organizationNamespace } = createCaptureTestContext({
			kind: "update_existing",
		});
		db.seedNote({
			id: "11111111-1111-4111-8111-111111111111",
			userId,
			title: "Existing",
			content: "Base content",
			processedAt: 100,
		});

		const result = await executeCapture(env, {
			userId,
			noteId: "11111111-1111-4111-8111-111111111111",
			userInput: "Append this section",
		});

		assert.equal(result.decision.kind, "update_existing");
		assert.equal(result.outcome.kind, "update_existing");
		assert.equal(result.outcome.noteId, "11111111-1111-4111-8111-111111111111");
		const updated = db.getNote("11111111-1111-4111-8111-111111111111");
		assert.ok(updated);
		assert.match(updated.content, /Append this section/);
		assert.equal(updated.processedAt, null);

		const workflowCalls = organizationNamespace.calls(userId);
		assert.ok(workflowCalls.length > 0);
		const requestBody = parseRequestBody(workflowCalls[workflowCalls.length - 1]!);
		assert.equal(requestBody.action, "run_organize");
		assert.deepEqual(requestBody.noteIds, ["11111111-1111-4111-8111-111111111111"]);
	});

	it("executes correction with confidence gating and updates target note", async () => {
		const { db, env } = createCaptureTestContext({ kind: "correction", confidence: 0.9 });
		db.seedNote({
			id: "22222222-2222-4222-8222-222222222222",
			userId,
			title: "Corrections",
			content: "Original text",
		});

		const result = await executeCapture(env, {
			userId,
			noteId: "22222222-2222-4222-8222-222222222222",
			userInput: "Fix the second paragraph",
		});

		assert.equal(result.decision.kind, "correction");
		assert.equal(result.outcome.kind, "correction");
		assert.equal(result.outcome.noteId, "22222222-2222-4222-8222-222222222222");
		assert.equal(result.outcome.toast?.tone, "success");
	});

	it("executes split and returns deterministic primary and secondary notes", async () => {
		const { db, env } = createCaptureTestContext({ kind: "split" });
		const result = await executeCapture(env, {
			userId,
			userInput: "First topic. Second topic. Third topic.",
		});

		assert.equal(result.decision.kind, "split");
		assert.equal(result.outcome.kind, "split");
		assert.equal(result.outcome.uiAction, "open_note");
		assert.ok(result.outcome.noteId);
		assert.ok(result.outcome.noteIds);
		assert.ok(result.outcome.noteIds.length >= 2);
		assert.equal(db.listUserNotes(userId).length, result.outcome.noteIds.length);
	});

	it("executes fan_out and returns queued_fanout secondary effect", async () => {
		const { db, env } = createCaptureTestContext({ kind: "fan_out" });
		db.seedNote({
			id: "77777777-7777-4777-8777-777777777777",
			userId,
			title: "Another note",
			content: "Existing context",
		});
		const result = await executeCapture(env, {
			userId,
			userInput: "Project update plus personal reminders",
		});

		assert.equal(result.decision.kind, "fan_out");
		assert.equal(result.outcome.kind, "fan_out");
		assert.equal(result.outcome.uiAction, "open_note");
		assert.ok(result.outcome.noteId);
		assert.ok(result.outcome.secondaryEffects?.some((effect) => effect.type === "queued_fanout"));
	});

	it("executes allowlisted workspace_action and keeps canvas blank", async () => {
		const { db, env } = createCaptureTestContext({ kind: "workspace_action", target: "none" });
		db.seedNote({
			id: "55555555-5555-4555-8555-555555555555",
			userId,
			title: "Archive me",
			content: "Archive target",
		});

		const result = await executeCapture(env, {
			userId,
			noteId: "55555555-5555-4555-8555-555555555555",
			userInput: "archive this",
		});

		assert.equal(result.decision.kind, "workspace_action");
		assert.equal(result.outcome.kind, "workspace_action");
		assert.equal(result.outcome.uiAction, "stay_blank");
		assert.equal(result.outcome.secondaryEffects?.[0]?.label, "archive_note(s)");
		const archived = db.getNote("55555555-5555-4555-8555-555555555555");
		assert.ok(archived);
		assert.notEqual(archived.deletedAt, null);
	});

	it("executes ephemeral_answer with transient response metadata", async () => {
		const { env } = createCaptureTestContext({ kind: "ephemeral_answer", target: "none" });
		const result = await executeCapture(env, {
			userId,
			userInput: "/ask What is the status?",
		});

		assert.equal(result.decision.kind, "ephemeral_answer");
		assert.equal(result.outcome.kind, "ephemeral_answer");
		assert.equal(result.outcome.uiAction, "show_ephemeral");
		assert.equal(result.outcome.ephemeral?.dismiss, "on_input");
		assert.equal(result.outcome.ephemeral?.timeoutMs, 8000);
		assert.equal(result.outcome.ephemeral?.content, "What is the status?");
	});

	it("executes store_preference and emits preference_saved effect", async () => {
		const { db, env, organizationNamespace } = createCaptureTestContext({
			kind: "store_preference",
			target: "none",
		});
		const result = await executeCapture(env, {
			userId,
			userInput: "/remember prefer concise summaries",
		});

		assert.equal(result.decision.kind, "store_preference");
		assert.equal(result.outcome.kind, "store_preference");
		assert.equal(result.outcome.uiAction, "stay_blank");
		assert.equal(result.outcome.secondaryEffects?.[0]?.type, "preference_saved");
		assert.equal(db.listUserPreferences(userId).length, 1);
		assert.equal(
			organizationNamespace
				.calls(userId)
				.some((call) => parseRequestBody(call).action === "run_organize"),
			false,
		);
	});

	it("executes duplicate route without creating additional notes", async () => {
		const { db, env } = createCaptureTestContext({ kind: "duplicate", confidence: 0.9 });
		db.seedNote({
			id: "66666666-6666-4666-8666-666666666666",
			userId,
			title: "Existing note",
			content: "Already captured",
			updatedAt: 50,
		});

		const result = await executeCapture(env, {
			userId,
			userInput: "already captured",
		});

		assert.equal(result.decision.kind, "duplicate");
		assert.equal(result.outcome.kind, "duplicate");
		assert.equal(result.outcome.uiAction, "stay_blank");
		assert.equal(db.listUserNotes(userId).length, 1);
	});

	it("forces rewrite update when duplicate decision matches active note content exactly", async () => {
		const { db, env } = createCaptureTestContext({ kind: "duplicate", confidence: 0.92 });
		const noteId = "77777777-7777-4777-8777-777777777777";
		db.seedNote({
			id: noteId,
			userId,
			title: "Active",
			content: "Already captured",
			updatedAt: 50,
		});

		const result = await executeCapture(env, {
			userId,
			noteId,
			userInput: "already captured",
		});

		assert.equal(result.decision.kind, "update_existing");
		assert.equal(result.outcome.kind, "update_existing");
		assert.equal(result.outcome.noteId, noteId);
	});

	it("records history snapshots for note-mutating outcomes", async () => {
		const { db, env } = createCaptureTestContext({ kind: "new_note" });
		const result = await executeCapture(env, {
			userId,
			userInput: "A history-worthy capture",
		});

		assert.equal(result.outcome.kind, "new_note");
		assert.equal(db.historyEventCount(), 1);
	});
});

describe("UX-086 workflow trigger coverage", () => {
	const userId = "user_ux086";

	it("fan_out route triggers workflow and organization refresh calls", async () => {
		const { db, env, organizationNamespace } = createCaptureTestContext({ kind: "fan_out" });
		db.seedNote({
			id: "33333333-3333-4333-8333-333333333333",
			userId,
			title: "Recent A",
			content: "A",
			updatedAt: 10,
		});
		db.seedNote({
			id: "44444444-4444-4444-8444-444444444444",
			userId,
			title: "Recent B",
			content: "B",
			updatedAt: 20,
		});

		const result = await executeCapture(env, {
			userId,
			userInput: "Fan out this update",
		});

		assert.equal(result.outcome.kind, "fan_out");

		const calls = organizationNamespace.calls(userId).map((call) => parseRequestBody(call));
		assert.ok(calls.some((payload) => payload.action === "run_fanout"));
		assert.ok(calls.some((payload) => payload.action === "run_organize"));
	});
});
