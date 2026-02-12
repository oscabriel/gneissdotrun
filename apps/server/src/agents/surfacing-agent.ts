import { google } from "@ai-sdk/google";
import { Agent, callable } from "agents";
import { embed, generateObject } from "ai";
import z from "zod";

import type { AgentEnv } from "./shared";

interface SurfacingDigest {
	title: string;
	overview: string;
	highlights: string[];
	risks: string[];
	nextActions: string[];
	generatedAt: number;
	rangeStart: number;
	rangeEnd: number;
	noteCount: number;
	pendingActionCount: number;
}

interface SurfacingAgentState {
	latestDigest: SurfacingDigest | null;
	updatedAt: number;
}

interface NoteRow {
	id: string;
	title: string;
	summary: string;
	tags: string;
	updated_at: number;
}

interface CollectionRow {
	id: string;
	title: string;
	summary: string;
	updated_at: number;
}

interface ActionItemRow {
	id: string;
	description: string;
	status: string;
	deadline: number | null;
	note_id: string | null;
	updated_at: number;
}

interface FactRow {
	id: string;
	fact: string;
	category: string;
	confidence: number;
	entity_name: string | null;
	source_note_id: string | null;
}

const SURFACING_MODEL = "gemini-flash-3-preview";

const querySynthesisSchema = z.object({
	answer: z.string().trim().min(1).max(3200),
	citationNoteIds: z.array(z.string().trim().uuid()).max(10).default([]),
	relatedCollectionIds: z.array(z.string().trim().uuid()).max(10).default([]),
	followUps: z.array(z.string().trim().min(1).max(160)).max(3).default([]),
});

const digestSchema = z.object({
	title: z.string().trim().min(1).max(120),
	overview: z.string().trim().min(1).max(1200),
	highlights: z.array(z.string().trim().min(1).max(220)).max(6).default([]),
	risks: z.array(z.string().trim().min(1).max(220)).max(6).default([]),
	nextActions: z.array(z.string().trim().min(1).max(220)).max(6).default([]),
});

function parseTags(raw: string): string[] {
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed
			.filter((value): value is string => typeof value === "string")
			.map((value) => value.trim())
			.filter((value) => value.length > 0)
			.slice(0, 12);
	} catch {
		return [];
	}
}

function trim(value: string, maxLength = 2400): string {
	return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

export class SurfacingAgent extends Agent<AgentEnv, SurfacingAgentState> {
	initialState: SurfacingAgentState = {
		latestDigest: null,
		updatedAt: Date.now(),
	};

	async onStart() {
		this.schedule("0 8 * * 1", "generateWeeklyDigest");
	}

	private async collectNoteIds(question: string): Promise<string[]> {
		const keyword = `%${question.trim().slice(0, 180)}%`;
		const byKeyword = await this.env.DB.prepare(
			"SELECT id FROM notes WHERE user_id = ?1 AND deleted_at IS NULL AND (title LIKE ?2 OR content LIKE ?2 OR summary LIKE ?2) ORDER BY updated_at DESC LIMIT 12",
		)
			.bind(this.name, keyword)
			.all<{ id: string }>();

		const noteIds = new Set((byKeyword.results ?? []).map((row) => row.id));

		try {
			const { embedding } = await embed({
				model: google.embedding("gemini-embedding-001"),
				value: question,
				providerOptions: {
					google: {
						outputDimensionality: 768,
						taskType: "RETRIEVAL_QUERY",
					},
				},
			});

			const vectorResults = await this.env.VECTORIZE.query(embedding, { topK: 8 });
			for (const match of vectorResults.matches) {
				if (match.id) {
					noteIds.add(match.id);
				}
			}
		} catch (error) {
			console.error(
				"SurfacingAgent vector retrieval failed; falling back to keyword search",
				error,
			);
		}

		if (noteIds.size === 0) {
			const fallback = await this.env.DB.prepare(
				"SELECT id FROM notes WHERE user_id = ?1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 8",
			)
				.bind(this.name)
				.all<{ id: string }>();

			for (const row of fallback.results ?? []) {
				noteIds.add(row.id);
			}
		}

		return Array.from(noteIds).slice(0, 20);
	}

	private async loadNotes(noteIds: string[]): Promise<Array<NoteRow & { tagsList: string[] }>> {
		if (!noteIds.length) {
			return [];
		}

		const placeholders = noteIds.map(() => "?").join(",");
		const rows = await this.env.DB.prepare(
			`SELECT id, title, summary, tags, updated_at FROM notes WHERE user_id = ? AND deleted_at IS NULL AND id IN (${placeholders}) ORDER BY updated_at DESC LIMIT 20`,
		)
			.bind(this.name, ...noteIds)
			.all<NoteRow>();

		return (rows.results ?? []).map((row) => ({
			...row,
			tagsList: parseTags(row.tags),
		}));
	}

	private async loadCollections(noteIds: string[]): Promise<CollectionRow[]> {
		if (!noteIds.length) {
			return [];
		}

		const placeholders = noteIds.map(() => "?").join(",");
		const rows = await this.env.DB.prepare(
			`SELECT DISTINCT c.id, c.title, c.summary, c.updated_at
			 FROM collections c
			 JOIN collection_notes cn ON c.id = cn.collection_id
			 WHERE c.user_id = ? AND c.deleted_at IS NULL AND cn.note_id IN (${placeholders})
			 ORDER BY c.updated_at DESC
			 LIMIT 20`,
		)
			.bind(this.name, ...noteIds)
			.all<CollectionRow>();

		return rows.results ?? [];
	}

	private async loadFacts(noteIds: string[]): Promise<FactRow[]> {
		if (!noteIds.length) {
			return [];
		}

		const placeholders = noteIds.map(() => "?").join(",");
		const rows = await this.env.DB.prepare(
			`SELECT f.id, f.fact, f.category, f.confidence, e.name AS entity_name, f.source_note_id
			 FROM facts f
			 LEFT JOIN entities e ON f.entity_id = e.id
			 WHERE f.user_id = ? AND f.status = 'active' AND f.source_note_id IN (${placeholders})
			 ORDER BY f.updated_at DESC
			 LIMIT 80`,
		)
			.bind(this.name, ...noteIds)
			.all<FactRow>();

		return rows.results ?? [];
	}

	private async loadPendingActions(limit = 40): Promise<ActionItemRow[]> {
		const rows = await this.env.DB.prepare(
			"SELECT id, description, status, deadline, note_id, updated_at FROM action_items WHERE user_id = ?1 AND status != 'done' ORDER BY updated_at DESC LIMIT ?2",
		)
			.bind(this.name, limit)
			.all<ActionItemRow>();

		return rows.results ?? [];
	}

	@callable()
	async query(question: string) {
		const trimmedQuestion = question.trim();
		if (!trimmedQuestion) {
			return {
				answer: "Please provide a question.",
				citations: [],
				relatedCollections: [],
				followUps: [],
			};
		}

		const noteIds = await this.collectNoteIds(trimmedQuestion);
		const [notes, collections, facts] = await Promise.all([
			this.loadNotes(noteIds),
			this.loadCollections(noteIds),
			this.loadFacts(noteIds),
		]);

		const prompt = [
			"You are SurfacingAgent for Gneiss.",
			"Answer the user question from provided notes and structured knowledge.",
			"If evidence is weak, say uncertainty clearly.",
			"Use citationNoteIds only from provided notes.",
			`Question: ${trimmedQuestion}`,
			`Notes: ${JSON.stringify(
				notes.map((note) => ({
					id: note.id,
					title: trim(note.title, 120),
					summary: trim(note.summary, 360),
					tags: note.tagsList,
				})),
			)}`,
			`Collections: ${JSON.stringify(collections)}`,
			`Facts: ${JSON.stringify(facts.map((fact) => ({ ...fact, fact: trim(fact.fact, 260) })))}`,
		].join("\n\n");

		let synthesis: z.infer<typeof querySynthesisSchema>;
		try {
			const { object } = await generateObject({
				model: google(SURFACING_MODEL),
				schema: querySynthesisSchema,
				prompt,
				temperature: 0.15,
			});
			synthesis = object;
		} catch (error) {
			console.error("SurfacingAgent query synthesis failed", error);
			const firstNote = notes[0];
			synthesis = {
				answer:
					notes.length > 0 && firstNote
						? `I found ${notes.length} relevant notes, but synthesis failed. Start with ${firstNote.title || "the latest note"}.`
						: "I could not find enough context to answer this yet.",
				citationNoteIds: notes.slice(0, 1).map((note) => note.id),
				relatedCollectionIds: [],
				followUps: [],
			};
		}

		const notesById = new Map(notes.map((note) => [note.id, note]));
		const collectionsById = new Map(collections.map((collection) => [collection.id, collection]));

		const citations = synthesis.citationNoteIds
			.map((noteId) => notesById.get(noteId))
			.filter((note): note is NoteRow & { tagsList: string[] } => Boolean(note))
			.map((note) => ({ id: note.id, title: note.title }));

		const relatedCollections = synthesis.relatedCollectionIds
			.map((collectionId) => collectionsById.get(collectionId))
			.filter((collection): collection is CollectionRow => Boolean(collection))
			.map((collection) => ({
				id: collection.id,
				title: collection.title,
				summary: collection.summary,
			}));

		return {
			answer: synthesis.answer,
			citations,
			relatedCollections,
			followUps: synthesis.followUps,
		};
	}

	@callable()
	async generateWeeklyDigest(): Promise<SurfacingDigest> {
		const rangeEnd = Date.now();
		const rangeStart = rangeEnd - 7 * 24 * 60 * 60 * 1000;

		const [recentNotes, pendingActions, recentCollections] = await Promise.all([
			this.env.DB.prepare(
				"SELECT id, title, summary, tags, updated_at FROM notes WHERE user_id = ?1 AND deleted_at IS NULL AND updated_at >= ?2 ORDER BY updated_at DESC LIMIT 40",
			)
				.bind(this.name, rangeStart)
				.all<NoteRow>(),
			this.loadPendingActions(40),
			this.env.DB.prepare(
				"SELECT id, title, summary, updated_at FROM collections WHERE user_id = ?1 AND deleted_at IS NULL AND updated_at >= ?2 ORDER BY updated_at DESC LIMIT 20",
			)
				.bind(this.name, rangeStart)
				.all<CollectionRow>(),
		]);

		const prompt = [
			"Generate a concise weekly digest for a knowledge workspace.",
			"Focus on progress, risks, and next actions.",
			`Recent notes: ${JSON.stringify(
				(recentNotes.results ?? []).map((note) => ({
					id: note.id,
					title: trim(note.title, 120),
					summary: trim(note.summary, 280),
					tags: parseTags(note.tags),
				})),
			)}`,
			`Pending action items: ${JSON.stringify(pendingActions)}`,
			`Recent collections: ${JSON.stringify(recentCollections.results ?? [])}`,
		].join("\n\n");

		let digestParts: z.infer<typeof digestSchema>;
		try {
			const { object } = await generateObject({
				model: google(SURFACING_MODEL),
				schema: digestSchema,
				prompt,
				temperature: 0.2,
			});
			digestParts = object;
		} catch (error) {
			console.error("SurfacingAgent digest generation failed", error);
			digestParts = {
				title: "Weekly digest",
				overview: "Digest generation failed; showing baseline activity summary.",
				highlights: [`${(recentNotes.results ?? []).length} notes touched this week.`],
				risks: [],
				nextActions: pendingActions.slice(0, 3).map((item) => item.description),
			};
		}

		const digest: SurfacingDigest = {
			...digestParts,
			generatedAt: rangeEnd,
			rangeStart,
			rangeEnd,
			noteCount: (recentNotes.results ?? []).length,
			pendingActionCount: pendingActions.length,
		};

		this.setState({
			latestDigest: digest,
			updatedAt: Date.now(),
		});

		return digest;
	}

	async onRequest(request: Request): Promise<Response> {
		if (request.method === "GET") {
			return Response.json(this.state);
		}

		if (request.method !== "POST") {
			return Response.json({ error: "Method not allowed" }, { status: 405 });
		}

		const payload = (await request.json()) as {
			action?: "query" | "digest";
			question?: string;
		};

		if (payload.action === "query") {
			if (!payload.question || payload.question.trim().length === 0) {
				return Response.json({ error: "question is required" }, { status: 400 });
			}

			const result = await this.query(payload.question);
			return Response.json(result);
		}

		if (payload.action === "digest") {
			const digest = await this.generateWeeklyDigest();
			return Response.json({ digest });
		}

		return Response.json({ error: "Invalid action" }, { status: 400 });
	}
}
