import assert from "node:assert/strict";
import { describe, it, mock } from "bun:test";

interface NamespaceLike {
	idFromName(name: string): string;
	get(id: string): { fetch(url: string, init?: RequestInit): Promise<Response> };
}

mock.module("agents", () => ({
	Agent: class Agent {},
	callable: () => (target: unknown) => target,
	getAgentByName: async <T>(namespace: NamespaceLike, name: string): Promise<T> => {
		const id = namespace.idFromName(name);
		return namespace.get(id) as T;
	},
	routeAgentRequest: async () => null,
}));

mock.module("agents/workflows", () => ({
	AgentWorkflow: class AgentWorkflow {},
}));

mock.module("@gneissdotrun/auth", () => ({
	auth: {
		api: {
			getSession: async () => ({ user: { id: "user_routes" } }),
		},
		handler: () => new Response("{}", { status: 200 }),
	},
}));

mock.module("@gneissdotrun/env/server", () => ({
	env: {
		CORS_ORIGIN: "https://web.gneiss.local",
	},
}));

mock.module("@gneissdotrun/api/context", () => ({
	createContext: async () => ({}),
}));

mock.module("@gneissdotrun/api/routers/index", () => ({
	appRouter: {},
}));

mock.module("@orpc/openapi/fetch", () => ({
	OpenAPIHandler: class OpenAPIHandler {
		handle() {
			return Promise.resolve({ matched: false });
		}
	},
}));

mock.module("@orpc/server/fetch", () => ({
	RPCHandler: class RPCHandler {
		handle() {
			return Promise.resolve({ matched: false });
		}
	},
}));

mock.module("@orpc/openapi/plugins", () => ({
	OpenAPIReferencePlugin: class OpenAPIReferencePlugin {},
}));

mock.module("@orpc/zod/zod4", () => ({
	ZodToJsonSchemaConverter: class ZodToJsonSchemaConverter {},
}));

mock.module("@orpc/server", () => ({
	onError: () => (value: unknown) => value,
}));

mock.module("./agents", () => ({
	IndexAgent: class IndexAgent {},
	OrganizationAgent: class OrganizationAgent {},
	SurfacingAgent: class SurfacingAgent {},
	RewriteAgent: class RewriteAgent {},
	RouterAgent: class RouterAgent {},
	OrganizeWorkflow: class OrganizeWorkflow {},
	FanOutWorkflow: class FanOutWorkflow {},
	ContradictionWorkflow: class ContradictionWorkflow {},
}));

const autoRewriteCalls: Array<{
	userId: string;
	noteId: string;
	reason: string;
}> = [];

mock.module("./auto-rewrite", () => ({
	scheduleAutoRewriteForNote: (
		_env: Env,
		input: { userId: string; noteId: string; reason: string },
	) => {
		autoRewriteCalls.push(input);
	},
	AUTO_REWRITE_DEBOUNCE_MS: 2500,
}));

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

interface NoteRecord {
	id: string;
	userId: string;
	title: string;
	content: string;
	summary: string;
	tags: string;
	processedAt: number | null;
	updatedAt: number;
	deletedAt: number | null;
}

interface NoteVersionRecord {
	id: string;
	noteId: string;
	userId: string;
	title: string;
	content: string;
	summary: string;
	tags: string;
	createdAt: number;
}

interface ContradictionRecord {
	id: string;
	userId: string;
	factAId: string;
	factAText: string;
	factBId: string;
	factBText: string;
	status: "open" | "resolved";
	updatedAt: number;
}

class FakeD1Database {
	private readonly notes = new Map<string, NoteRecord>();
	private readonly noteVersions = new Map<string, NoteVersionRecord>();
	private readonly contradictions = new Map<string, ContradictionRecord>();

	prepare(sql: string): FakeD1Statement {
		return new FakeD1Statement(this, sql);
	}

	seedNote(note: NoteRecord): void {
		this.notes.set(note.id, note);
	}

	seedNoteVersion(version: NoteVersionRecord): void {
		this.noteVersions.set(version.id, version);
	}

	seedContradiction(contradiction: ContradictionRecord): void {
		this.contradictions.set(contradiction.id, contradiction);
	}

	getNote(noteId: string): NoteRecord | undefined {
		return this.notes.get(noteId);
	}

	run(sql: string, params: unknown[]): void {
		const normalized = this.normalize(sql);
		if (
			normalized.startsWith("create table if not exists") ||
			normalized.startsWith("create index if not exists")
		) {
			return;
		}

		if (normalized.startsWith("insert into note_versions")) {
			const [id, noteId, userId, title, content, summary, tags, createdAt] = params as [
				string,
				string,
				string,
				string,
				string,
				string,
				string,
				number,
			];
			this.noteVersions.set(id, {
				id,
				noteId,
				userId,
				title,
				content,
				summary,
				tags,
				createdAt,
			});
			return;
		}

		if (normalized.startsWith("insert into note_history_events")) {
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

		if (
			normalized.startsWith(
				"update notes set title = ?1, content = ?2, summary = ?3, tags = ?4, updated_at = ?5, processed_at = null",
			)
		) {
			const [title, content, summary, tags, updatedAt, noteId, userId] = params as [
				string,
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
				note.tags = tags;
				note.updatedAt = updatedAt;
				note.processedAt = null;
			}
			return;
		}
	}

	first(sql: string, params: unknown[]): unknown {
		const normalized = this.normalize(sql);

		if (
			normalized ===
			"select id, title, tags from notes where id = ?1 and user_id = ?2 and deleted_at is null"
		) {
			const [noteId, userId] = params as [string, string];
			const note = this.notes.get(noteId);
			if (!note || note.userId !== userId || note.deletedAt !== null) {
				return null;
			}
			return { id: note.id, title: note.title, tags: note.tags };
		}

		if (
			normalized === "select id from notes where id = ?1 and user_id = ?2 and deleted_at is null"
		) {
			const [noteId, userId] = params as [string, string];
			const note = this.notes.get(noteId);
			if (!note || note.userId !== userId || note.deletedAt !== null) {
				return null;
			}
			return { id: note.id };
		}

		if (
			normalized ===
			"select id, note_id, title, content, summary, tags, created_at from note_versions where id = ?1 and note_id = ?2 and user_id = ?3"
		) {
			const [versionId, noteId, userId] = params as [string, string, string];
			const version = this.noteVersions.get(versionId);
			if (!version || version.noteId !== noteId || version.userId !== userId) {
				return null;
			}
			return {
				id: version.id,
				note_id: version.noteId,
				title: version.title,
				content: version.content,
				summary: version.summary,
				tags: version.tags,
				created_at: version.createdAt,
			};
		}

		if (
			normalized.includes("from fact_contradictions fc") &&
			normalized.includes("where fc.id = ?1 and fc.user_id = ?2 and fc.status = 'open'")
		) {
			const [contradictionId, userId] = params as [string, string];
			const contradiction = this.contradictions.get(contradictionId);
			if (!contradiction || contradiction.userId !== userId || contradiction.status !== "open") {
				return null;
			}
			return {
				id: contradiction.id,
				fact_a_id: contradiction.factAId,
				fact_a_text: contradiction.factAText,
				fact_b_id: contradiction.factBId,
				fact_b_text: contradiction.factBText,
			};
		}

		return null;
	}

	all(sql: string, params: unknown[]): unknown[] {
		const normalized = this.normalize(sql);
		if (
			normalized.startsWith("select fc.id") &&
			normalized.includes("where fc.user_id = ?1 and fc.status = 'open'")
		) {
			const [userId] = params as [string];
			return [...this.contradictions.values()]
				.filter(
					(contradiction) => contradiction.userId === userId && contradiction.status === "open",
				)
				.map((contradiction) => ({
					id: contradiction.id,
					status: contradiction.status,
					updated_at: contradiction.updatedAt,
					resolution_reason: null,
					fact_a_id: contradiction.factAId,
					fact_a_text: contradiction.factAText,
					fact_b_id: contradiction.factBId,
					fact_b_text: contradiction.factBText,
				}));
		}

		return [];
	}

	private normalize(sql: string): string {
		return sql.replace(/\s+/g, " ").trim().toLowerCase();
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

class FakeDurableNamespace {
	private readonly stubs = new Map<string, FakeDurableStub>();

	constructor(
		private readonly responder: (
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
			this.stubs.set(id, new FakeDurableStub((url, init) => this.responder(id, url, init)));
		}
		return this.stubs.get(id)!;
	}

	calls(name: string): FetchCall[] {
		return this.stubs.get(name)?.calls ?? [];
	}
}

const { default: app } = await import("./index");

function parseBody(call: FetchCall): Record<string, unknown> {
	if (!call.init?.body || typeof call.init.body !== "string") {
		return {};
	}
	return JSON.parse(call.init.body) as Record<string, unknown>;
}

function createTestEnv() {
	const db = new FakeD1Database();
	const indexNamespace = new FakeDurableNamespace(async () => new Response("{}", { status: 200 }));
	const organizationNamespace = new FakeDurableNamespace(async () => {
		return new Response(JSON.stringify({ ok: true, workflow: "wf_test" }), {
			status: 200,
			headers: { "content-type": "application/json" },
		});
	});

	return {
		db,
		indexNamespace,
		organizationNamespace,
		env: {
			DB: db,
			INDEX_AGENT: indexNamespace,
			ORGANIZATION_AGENT: organizationNamespace,
			ROUTER_AGENT: organizationNamespace,
			SURFACING_AGENT: organizationNamespace,
			FILES: {
				put: async () => {},
			},
		} as unknown as Env,
	};
}

describe("workflow route coverage", () => {
	it("PUT /api/notes/:noteId resets processed_at and triggers organize", async () => {
		const { db, env, organizationNamespace } = createTestEnv();
		const noteId = "11111111-1111-4111-8111-111111111111";
		db.seedNote({
			id: noteId,
			userId: "user_routes",
			title: "Initial",
			content: "Before",
			summary: "Before",
			tags: "[]",
			processedAt: 123,
			updatedAt: 100,
			deletedAt: null,
		});

		const response = await app.fetch(
			new Request(`https://server.local/api/notes/${noteId}`, {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ content: "After content" }),
			}),
			env,
		);

		assert.equal(response.status, 200);
		assert.equal(db.getNote(noteId)?.processedAt, null);
		await new Promise((resolve) => setTimeout(resolve, 0));
		const organizeCall = organizationNamespace
			.calls("user_routes")
			.find((call) => parseBody(call).action === "run_organize");
		assert.ok(organizeCall);
		assert.deepEqual(parseBody(organizeCall).noteIds, [noteId]);
	});

	it("PUT /api/notes/:noteId does not schedule auto rewrite", async () => {
		autoRewriteCalls.length = 0;
		const { db, env } = createTestEnv();
		const noteId = "aaaaaaaa-1111-4111-8111-111111111111";
		db.seedNote({
			id: noteId,
			userId: "user_routes",
			title: "Initial",
			content: "Before",
			summary: "Before",
			tags: "[]",
			processedAt: null,
			updatedAt: 100,
			deletedAt: null,
		});

		const response = await app.fetch(
			new Request(`https://server.local/api/notes/${noteId}`, {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ content: "After content" }),
			}),
			env,
		);

		assert.equal(response.status, 200);
		assert.equal(autoRewriteCalls.length, 0);
	});

	it("PUT /api/notes/:noteId preserves untitled title until run workflow", async () => {
		const { db, env } = createTestEnv();
		const noteId = "bbbbbbbb-1111-4111-8111-111111111111";
		db.seedNote({
			id: noteId,
			userId: "user_routes",
			title: "Untitled note",
			content: "",
			summary: "",
			tags: "[]",
			processedAt: null,
			updatedAt: 100,
			deletedAt: null,
		});

		const response = await app.fetch(
			new Request(`https://server.local/api/notes/${noteId}`, {
				method: "PUT",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ content: "Draft before run" }),
			}),
			env,
		);

		assert.equal(response.status, 200);
		const payload = (await response.json()) as { note: { title: string } };
		assert.equal(payload.note.title, "Untitled note");
		assert.equal(db.getNote(noteId)?.title, "Untitled note");
	});

	it("POST /api/notes/:noteId/revert resets processed_at and triggers organize", async () => {
		const { db, env, organizationNamespace } = createTestEnv();
		const noteId = "22222222-2222-4222-8222-222222222222";
		db.seedNote({
			id: noteId,
			userId: "user_routes",
			title: "Initial",
			content: "Before",
			summary: "Before",
			tags: "[]",
			processedAt: 555,
			updatedAt: 100,
			deletedAt: null,
		});

		db.seedNoteVersion({
			id: "version_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
			noteId,
			userId: "user_routes",
			title: "Restored title",
			content: "Restored content",
			summary: "Restored summary",
			tags: JSON.stringify(["restored"]),
			createdAt: Date.now(),
		});

		const response = await app.fetch(
			new Request(`https://server.local/api/notes/${noteId}/revert`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ versionId: "version_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }),
			}),
			env,
		);

		assert.equal(response.status, 200);
		assert.equal(db.getNote(noteId)?.processedAt, null);
		await new Promise((resolve) => setTimeout(resolve, 0));
		const organizeCall = organizationNamespace
			.calls("user_routes")
			.find((call) => parseBody(call).action === "run_organize");
		assert.ok(organizeCall);
		assert.deepEqual(parseBody(organizeCall).noteIds, [noteId]);
	});

	it("contradiction analyze and resolve routes call workflow actions", async () => {
		const { db, env, organizationNamespace } = createTestEnv();
		const contradictionId = "contradiction_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
		db.seedContradiction({
			id: contradictionId,
			userId: "user_routes",
			factAId: "fact_a",
			factAText: "Fact A text",
			factBId: "fact_b",
			factBText: "Fact B text",
			status: "open",
			updatedAt: Date.now(),
		});

		const analyzeResponse = await app.fetch(
			new Request("https://server.local/api/contradictions/analyze", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ contradictionId }),
			}),
			env,
		);
		assert.equal(analyzeResponse.status, 200);
		const analyzeCall = organizationNamespace
			.calls("user_routes")
			.find((call) => parseBody(call).action === "run_contradiction");
		assert.ok(analyzeCall);

		const resolveResponse = await app.fetch(
			new Request("https://server.local/api/contradictions/resolve", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ workflowId: "wf_test", keep: "factA" }),
			}),
			env,
		);
		assert.equal(resolveResponse.status, 200);
		const resolveCall = organizationNamespace
			.calls("user_routes")
			.find((call) => parseBody(call).action === "resolve_contradiction");
		assert.ok(resolveCall);
	});
});
