import assert from "node:assert/strict";
import { describe, it, mock } from "bun:test";

mock.module("agents", () => ({
	Agent: class Agent {},
	callable: () => (target: unknown) => target,
	routeAgentRequest: async () => null,
	getAgentByName: async () => ({
		fetch: async () => new Response("{}", { status: 200 }),
	}),
}));

const { runAutoRewriteForNote } = await import("./auto-rewrite");

interface NoteRecord {
	id: string;
	userId: string;
	title: string;
	content: string;
	summary: string;
	updatedAt: number;
	deletedAt: number | null;
	processedAt: number | null;
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

	async first<T>(): Promise<T | null> {
		return this.database.first(this.sql, this.params) as T | null;
	}

	async all<T>(): Promise<{ results: T[] }> {
		return { results: this.database.all(this.sql, this.params) as T[] };
	}

	async run(): Promise<{ success: true }> {
		this.database.run(this.sql, this.params);
		return { success: true };
	}
}

class FakeD1Database {
	private readonly notes = new Map<string, NoteRecord>();

	prepare(sql: string): FakeD1Statement {
		return new FakeD1Statement(this, sql);
	}

	seedNote(note: NoteRecord): void {
		this.notes.set(note.id, note);
	}

	getNote(noteId: string): NoteRecord | undefined {
		return this.notes.get(noteId);
	}

	first(sql: string, params: unknown[]): unknown {
		const normalized = this.normalize(sql);
		if (
			normalized ===
			"select id, title, content, updated_at from notes where id = ?1 and user_id = ?2 and deleted_at is null"
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
				updated_at: note.updatedAt,
			};
		}

		return null;
	}

	all(sql: string, params: unknown[]): unknown[] {
		const normalized = this.normalize(sql);
		if (
			normalized ===
			"select id, title from notes where user_id = ?1 and deleted_at is null and id != ?2 order by updated_at desc limit 40"
		) {
			const [userId, excludeId] = params as [string, string];
			return [...this.notes.values()]
				.filter((note) => note.userId === userId && note.deletedAt === null && note.id !== excludeId)
				.sort((left, right) => right.updatedAt - left.updatedAt)
				.map((note) => ({ id: note.id, title: note.title }));
		}

		return [];
	}

	run(sql: string, params: unknown[]): void {
		const normalized = this.normalize(sql);
		if (
			normalized ===
			"update notes set title = ?1, content = ?2, summary = ?3, updated_at = ?4, processed_at = null where id = ?5 and user_id = ?6 and deleted_at is null and updated_at = ?7"
		) {
			const [title, content, summary, updatedAt, noteId, userId, expectedUpdatedAt] = params as [
				string,
				string,
				string,
				number,
				string,
				string,
				number,
			];
			const note = this.notes.get(noteId);
			if (!note || note.userId !== userId || note.deletedAt !== null) {
				return;
			}

			if (note.updatedAt !== expectedUpdatedAt) {
				return;
			}

			note.title = title;
			note.content = content;
			note.summary = summary;
			note.updatedAt = updatedAt;
			note.processedAt = null;
		}
	}

	private normalize(sql: string): string {
		return sql.replace(/\s+/g, " ").trim().toLowerCase();
	}
}

describe("runAutoRewriteForNote", () => {
	it("rewrites current note, sanitizes wiki links, and triggers follow-up hooks", async () => {
		const db = new FakeD1Database();
		db.seedNote({
			id: "11111111-1111-4111-8111-111111111111",
			userId: "user_auto_rewrite",
			title: "Primary note",
			content: "raw draft",
			summary: "raw draft",
			updatedAt: 100,
			deletedAt: null,
			processedAt: 100,
		});
		db.seedNote({
			id: "22222222-2222-4222-8222-222222222222",
			userId: "user_auto_rewrite",
			title: "Second Note",
			content: "reference",
			summary: "reference",
			updatedAt: 90,
			deletedAt: null,
			processedAt: null,
		});

		const env = {
			DB: db,
			INDEX_AGENT: {},
		} as unknown as Env;

		let indexUpdatedAt: number | null = null;
		const organizationCalls: Array<{ userId: string; noteIds: Array<string | null | undefined> }> =
			[];

		const result = await runAutoRewriteForNote(
			env,
			{
				userId: "user_auto_rewrite",
				noteId: "11111111-1111-4111-8111-111111111111",
				expectedUpdatedAt: 100,
				reason: "test",
			},
			{
				sleepMs: async () => {},
				now: () => 200,
				rewriteGenerator: async () => ({
					prompt: "",
					text: "Polished entry with [[Second Note]] and [[Unknown Topic]]",
				}),
				notifyIndexUpsert: async (input) => {
					indexUpdatedAt = input.updatedAt;
				},
				triggerOrganization: async (_env, userId, noteIds) => {
					organizationCalls.push({ userId, noteIds });
					return { triggered: true, noteIds: ["11111111-1111-4111-8111-111111111111"] };
				},
			},
		);

		assert.equal(result.status, "rewritten");
		const updated = db.getNote("11111111-1111-4111-8111-111111111111");
		assert.ok(updated);
		assert.equal(updated.updatedAt, 200);
		assert.match(updated.content, /\[\[Second Note\]\]/);
		assert.match(updated.content, /Unknown Topic/);
		assert.equal(indexUpdatedAt, 200);
		assert.equal(organizationCalls.length, 1);
		assert.equal(organizationCalls[0]?.userId, "user_auto_rewrite");
		assert.deepEqual(organizationCalls[0]?.noteIds, ["11111111-1111-4111-8111-111111111111"]);
	});

	it("skips stale rewrite requests when the note was edited again", async () => {
		const db = new FakeD1Database();
		db.seedNote({
			id: "11111111-1111-4111-8111-111111111111",
			userId: "user_auto_rewrite",
			title: "Primary note",
			content: "fresh content",
			summary: "fresh content",
			updatedAt: 101,
			deletedAt: null,
			processedAt: null,
		});

		const env = {
			DB: db,
			INDEX_AGENT: {},
		} as unknown as Env;

		let rewriteCalls = 0;
		const result = await runAutoRewriteForNote(
			env,
			{
				userId: "user_auto_rewrite",
				noteId: "11111111-1111-4111-8111-111111111111",
				expectedUpdatedAt: 100,
				reason: "test",
			},
			{
				sleepMs: async () => {},
				rewriteGenerator: async () => {
					rewriteCalls += 1;
					return { prompt: "", text: "Should not run" };
				},
			},
		);

		assert.equal(result.status, "skipped_stale");
		assert.equal(rewriteCalls, 0);
	});
});
