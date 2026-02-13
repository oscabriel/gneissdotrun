import { Agent } from "agents";
import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { AgentWorkflow, type AgentWorkflowEvent, type AgentWorkflowStep } from "agents/workflows";
import z from "zod";

import { createId } from "../shared";

interface OrganizeParams {
	userId: string;
	noteIds: string[];
}

interface OrganizeEnv {
	DB: D1Database;
	INDEX_AGENT: DurableObjectNamespace;
}

interface NoteSnapshot {
	id: string;
	title: string;
	content: string;
	summary: string;
	tags: string[];
}

interface ExtractionSummary {
	entities: Array<{
		id: string;
		name: string;
		type: string;
		summary: string;
		count: number;
	}>;
	facts: Array<{
		id: string;
		entityId?: string;
		fact: string;
		category: string;
		confidence: number;
		sourceNoteId?: string;
	}>;
	actionItems: Array<{
		id: string;
		noteId?: string;
		description: string;
		deadline?: number;
		status: string;
	}>;
	collections: Array<{
		id: string;
		title: string;
		summary: string;
		noteIds: string[];
	}>;
	contradictions: Array<{
		id: string;
		factAId: string;
		factBId: string;
		status: string;
	}>;
}

const ORGANIZATION_MODEL = "gemini-2.5-flash";

const knowledgeDraftSchema = z.object({
	entities: z
		.array(
			z.object({
				name: z.string().trim().min(1).max(120),
				type: z.string().trim().min(1).max(60).default("topic"),
				summary: z.string().trim().max(320).default(""),
			}),
		)
		.max(40)
		.default([]),
	facts: z
		.array(
			z.object({
				fact: z.string().trim().min(1).max(420),
				category: z.string().trim().max(80).default("general"),
				confidence: z.number().min(0).max(100).default(70),
				entityName: z.string().trim().max(120).optional(),
				sourceNoteId: z.string().trim().pipe(z.uuid()).optional(),
			}),
		)
		.max(100)
		.default([]),
	actionItems: z
		.array(
			z.object({
				description: z.string().trim().min(1).max(240),
				status: z.enum(["pending", "in_progress", "done"]).default("pending"),
				deadlineIso: z.string().trim().optional(),
				noteId: z.string().trim().pipe(z.uuid()).optional(),
			}),
		)
		.max(60)
		.default([]),
});

const collectionDraftSchema = z.object({
	collections: z
		.array(
			z.object({
				title: z.string().trim().min(1).max(120),
				summary: z.string().trim().max(320).default(""),
				noteIds: z.array(z.string().trim().pipe(z.uuid())).max(24).default([]),
			}),
		)
		.max(24)
		.default([]),
});

const contradictionDraftSchema = z.object({
	contradictions: z
		.array(
			z.object({
				factAText: z.string().trim().min(1).max(420),
				factBText: z.string().trim().min(1).max(420),
				reason: z.string().trim().max(320).default("Potential contradiction detected."),
			}),
		)
		.max(32)
		.default([]),
});

type KnowledgeDraft = z.infer<typeof knowledgeDraftSchema>;
type CollectionDraft = z.infer<typeof collectionDraftSchema>;
type ContradictionDraft = z.infer<typeof contradictionDraftSchema>;

function trimForModel(value: string, maxLength = 3000): string {
	return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`;
}

function safeParseTags(raw: string): string[] {
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

function normalizeKey(value: string): string {
	return value.trim().toLowerCase();
}

function parseDeadline(deadlineIso?: string): number | undefined {
	if (!deadlineIso) {
		return undefined;
	}

	const parsed = Date.parse(deadlineIso);
	if (!Number.isFinite(parsed)) {
		return undefined;
	}

	return parsed;
}

async function loadNotes(
	env: OrganizeEnv,
	userId: string,
	noteIds: string[],
): Promise<NoteSnapshot[]> {
	if (!noteIds.length) {
		return [];
	}

	const placeholders = noteIds.map(() => "?").join(",");
	const rows = await env.DB.prepare(
		`SELECT id, title, content, summary, tags FROM notes WHERE id IN (${placeholders}) AND user_id = ? AND deleted_at IS NULL`,
	)
		.bind(...noteIds, userId)
		.all<{
			id: string;
			title: string;
			content: string;
			summary: string;
			tags: string;
		}>();

	return (rows.results ?? []).map((row) => ({
		id: row.id,
		title: row.title,
		content: row.content,
		summary: row.summary,
		tags: safeParseTags(row.tags),
	}));
}

function notesForPrompt(notes: NoteSnapshot[]) {
	return notes.map((note) => ({
		id: note.id,
		title: trimForModel(note.title, 140),
		summary: trimForModel(note.summary, 500),
		tags: note.tags,
		contentExcerpt: trimForModel(note.content, 2400),
	}));
}

function fallbackKnowledgeDraft(notes: NoteSnapshot[]): KnowledgeDraft {
	const entities = notes.slice(0, 16).map((note, index) => ({
		name: note.title || `Note ${index + 1}`,
		type: "note",
		summary: trimForModel(note.summary || note.content.slice(0, 160), 200),
	}));

	const facts = notes.slice(0, 24).map((note, index) => ({
		fact: trimForModel(
			note.summary || note.content.slice(0, 180) || `Captured note ${index + 1}.`,
			220,
		),
		category: "summary",
		confidence: 60,
		entityName: note.title || undefined,
		sourceNoteId: note.id,
	}));

	const actionItems = notes
		.filter((note) => /\b(todo|follow up|action|next step)\b/i.test(note.content))
		.slice(0, 16)
		.map((note) => ({
			description: `Review and process: ${note.title || "Untitled note"}`,
			status: "pending" as const,
			noteId: note.id,
		}));

	return {
		entities,
		facts,
		actionItems,
	};
}

function fallbackCollectionDraft(noteIds: string[]): CollectionDraft {
	if (!noteIds.length) {
		return { collections: [] };
	}

	return {
		collections: [
			{
				title: "Recent captures",
				summary: "Auto-grouped captures from the latest ingest batch.",
				noteIds,
			},
		],
	};
}

async function generateKnowledgeDraft(notes: NoteSnapshot[]): Promise<KnowledgeDraft> {
	const prompt = [
		"You are the Organization workflow for Gneiss.",
		"Extract durable knowledge from user notes.",
		"Output concise entities, atomic facts, and explicit action items.",
		"Do not invent facts beyond the notes.",
		"Prefer sourceNoteId when possible.",
		`Notes:\n${JSON.stringify(notesForPrompt(notes))}`,
	].join("\n\n");

	const { output } = await generateText({
		model: google(ORGANIZATION_MODEL),
		output: Output.object({ schema: knowledgeDraftSchema }),
		prompt,
		temperature: 0.1,
	});

	return output;
}

async function generateCollectionDraft(
	notes: NoteSnapshot[],
	knowledge: KnowledgeDraft,
): Promise<CollectionDraft> {
	const prompt = [
		"You are clustering notes into reusable collections.",
		"Group by durable themes, projects, or domains.",
		"Use only noteIds that exist in provided notes.",
		`Notes:\n${JSON.stringify(notesForPrompt(notes))}`,
		`Extracted entities:\n${JSON.stringify(knowledge.entities)}`,
		`Extracted facts:\n${JSON.stringify(knowledge.facts.slice(0, 80))}`,
	].join("\n\n");

	const { output } = await generateText({
		model: google(ORGANIZATION_MODEL),
		output: Output.object({ schema: collectionDraftSchema }),
		prompt,
		temperature: 0.15,
	});

	return output;
}

async function generateContradictionDraft(knowledge: KnowledgeDraft): Promise<ContradictionDraft> {
	if (!knowledge.facts.length) {
		return { contradictions: [] };
	}

	const prompt = [
		"Identify factual contradictions in the extracted facts.",
		"Return only likely contradictions with short reasons.",
		"If no contradictions exist, return an empty list.",
		`Facts:\n${JSON.stringify(knowledge.facts)}`,
	].join("\n\n");

	const { output } = await generateText({
		model: google(ORGANIZATION_MODEL),
		output: Output.object({ schema: contradictionDraftSchema }),
		prompt,
		temperature: 0,
	});

	return output;
}

function buildExtractionSummary(
	noteIds: string[],
	notes: NoteSnapshot[],
	knowledge: KnowledgeDraft,
	collectionDraft: CollectionDraft,
	contradictionDraft: ContradictionDraft,
): ExtractionSummary {
	const validNoteIds = new Set(notes.map((note) => note.id));
	const mentionCountByEntityId = new Map<string, number>();

	const entityByName = new Map<string, ExtractionSummary["entities"][number]>();
	for (const entity of knowledge.entities) {
		const key = normalizeKey(entity.name);
		if (!key || entityByName.has(key)) {
			continue;
		}

		entityByName.set(key, {
			id: createId("entity"),
			name: entity.name,
			type: entity.type || "topic",
			summary: entity.summary || "",
			count: 1,
		});
	}

	const facts = knowledge.facts.slice(0, 100).map((fact) => {
		const entityKey = fact.entityName ? normalizeKey(fact.entityName) : "";
		const linkedEntity = entityKey ? entityByName.get(entityKey) : undefined;
		if (linkedEntity) {
			const currentCount = mentionCountByEntityId.get(linkedEntity.id) ?? 1;
			mentionCountByEntityId.set(linkedEntity.id, currentCount + 1);
		}

		const sourceNoteId =
			fact.sourceNoteId && validNoteIds.has(fact.sourceNoteId) ? fact.sourceNoteId : undefined;

		return {
			id: createId("fact"),
			entityId: linkedEntity?.id,
			fact: fact.fact,
			category: fact.category || "general",
			confidence: Math.max(0, Math.min(100, Math.round(fact.confidence))),
			sourceNoteId,
		};
	});

	const entities = Array.from(entityByName.values()).map((entity) => ({
		...entity,
		count: mentionCountByEntityId.get(entity.id) ?? entity.count,
	}));

	const actionItems = knowledge.actionItems.slice(0, 60).map((action) => ({
		id: createId("action"),
		noteId: action.noteId && validNoteIds.has(action.noteId) ? action.noteId : undefined,
		description: action.description,
		deadline: parseDeadline(action.deadlineIso),
		status: action.status,
	}));

	const collections = collectionDraft.collections
		.slice(0, 24)
		.map((collection) => ({
			id: createId("collection"),
			title: collection.title,
			summary: collection.summary,
			noteIds: Array.from(new Set(collection.noteIds.filter((noteId) => validNoteIds.has(noteId)))),
		}))
		.filter((collection) => collection.noteIds.length > 0);

	if (!collections.length && noteIds.length > 0) {
		collections.push({
			id: createId("collection"),
			title: "Recent captures",
			summary: "Auto-grouped captures from the latest ingest batch.",
			noteIds: noteIds.filter((noteId) => validNoteIds.has(noteId)),
		});
	}

	const factIdByText = new Map<string, string>();
	for (const fact of facts) {
		const key = normalizeKey(fact.fact);
		if (!key || factIdByText.has(key)) {
			continue;
		}
		factIdByText.set(key, fact.id);
	}

	const seenPairs = new Set<string>();
	const contradictions: ExtractionSummary["contradictions"] = [];
	for (const contradiction of contradictionDraft.contradictions.slice(0, 32)) {
		const factAId = factIdByText.get(normalizeKey(contradiction.factAText));
		const factBId = factIdByText.get(normalizeKey(contradiction.factBText));
		if (!factAId || !factBId || factAId === factBId) {
			continue;
		}

		const pairKey = [factAId, factBId].sort().join(":");
		if (seenPairs.has(pairKey)) {
			continue;
		}

		seenPairs.add(pairKey);
		contradictions.push({
			id: createId("contradiction"),
			factAId,
			factBId,
			status: "open",
		});
	}

	return {
		entities,
		facts,
		actionItems,
		collections,
		contradictions,
	};
}

async function persistExtractions(env: OrganizeEnv, payload: ExtractionSummary, userId: string) {
	const now = Date.now();

	for (const entity of payload.entities) {
		await env.DB.prepare(
			"INSERT INTO entities (id, user_id, name, type, summary, mention_count, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
		)
			.bind(entity.id, userId, entity.name, entity.type, entity.summary, entity.count, now, now)
			.run();
	}

	for (const fact of payload.facts) {
		await env.DB.prepare(
			"INSERT INTO facts (id, user_id, entity_id, fact, category, status, confidence, source_note_id, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
		)
			.bind(
				fact.id,
				userId,
				fact.entityId ?? null,
				fact.fact,
				fact.category,
				"active",
				fact.confidence,
				fact.sourceNoteId ?? null,
				now,
				now,
			)
			.run();
	}

	for (const action of payload.actionItems) {
		await env.DB.prepare(
			"INSERT INTO action_items (id, user_id, note_id, description, deadline, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
		)
			.bind(
				action.id,
				userId,
				action.noteId ?? null,
				action.description,
				action.deadline ?? null,
				action.status,
				now,
				now,
			)
			.run();
	}

	for (const collection of payload.collections) {
		await env.DB.prepare(
			"INSERT INTO collections (id, user_id, title, summary, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
		)
			.bind(collection.id, userId, collection.title, collection.summary, "active", now, now)
			.run();

		for (const noteId of collection.noteIds) {
			await env.DB.prepare(
				"INSERT INTO collection_notes (collection_id, note_id, created_at) VALUES (?1, ?2, ?3)",
			)
				.bind(collection.id, noteId, now)
				.run();
		}
	}

	for (const contradiction of payload.contradictions) {
		await env.DB.prepare(
			"INSERT INTO fact_contradictions (id, user_id, fact_a_id, fact_b_id, status, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
		)
			.bind(
				contradiction.id,
				userId,
				contradiction.factAId,
				contradiction.factBId,
				contradiction.status,
				now,
				now,
			)
			.run();
	}
}

export class OrganizeWorkflow extends AgentWorkflow<Agent, OrganizeParams, unknown, OrganizeEnv> {
	async run(event: AgentWorkflowEvent<OrganizeParams>, step: AgentWorkflowStep) {
		const { userId, noteIds } = event.payload;
		if (!userId) {
			throw new Error("userId is required");
		}

		if (!noteIds.length) {
			await step.reportComplete({ processed: 0, collections: 0, contradictions: 0 });
			return;
		}

		const notes = await step.do("load-notes", async () => loadNotes(this.env, userId, noteIds));
		if (!notes.length) {
			await step.reportComplete({ processed: 0, collections: 0, contradictions: 0 });
			return;
		}

		const knowledgeDraft = await step.do("extract-knowledge", async () => {
			try {
				return await generateKnowledgeDraft(notes);
			} catch (error) {
				console.error("OrganizeWorkflow LLM knowledge extraction failed", error);
				return fallbackKnowledgeDraft(notes);
			}
		});
		await this.reportProgress({ stage: "knowledge", percent: 0.3, notes: notes.length });

		const collectionDraft = await step.do("cluster-notes", async () => {
			try {
				return await generateCollectionDraft(notes, knowledgeDraft);
			} catch (error) {
				console.error("OrganizeWorkflow LLM clustering failed", error);
				return fallbackCollectionDraft(noteIds);
			}
		});
		await this.reportProgress({ stage: "collections", percent: 0.55 });

		const contradictionDraft = await step.do("detect-contradictions", async () => {
			try {
				return await generateContradictionDraft(knowledgeDraft);
			} catch (error) {
				console.error("OrganizeWorkflow contradiction detection failed", error);
				return { contradictions: [] };
			}
		});
		await this.reportProgress({ stage: "contradictions", percent: 0.72 });

		const summary = await step.do("assemble-extraction-summary", async () =>
			buildExtractionSummary(noteIds, notes, knowledgeDraft, collectionDraft, contradictionDraft),
		);
		await this.reportProgress({ stage: "assembled", percent: 0.82 });

		await step.do("persist", async () => {
			await persistExtractions(this.env, summary, userId);
		});

		await step.do("notify-index", async () => {
			const namespace = this.env.INDEX_AGENT as DurableObjectNamespace;
			const indexAgentId = namespace.idFromName(userId);
			const indexAgent = namespace.get(indexAgentId);
			await indexAgent.fetch("https://index-agent/internal", {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify({
					action: "collections",
					collections: summary.collections.map((collection) => ({
						id: collection.id,
						title: collection.title,
						summary: collection.summary,
						status: "active",
						updatedAt: Date.now(),
					})),
				}),
			});

			await indexAgent.fetch("https://index-agent/internal", {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify({
					action: "action_items",
					actionItems: summary.actionItems.map((item) => ({
						id: item.id,
						description: item.description,
						status: item.status,
						deadline: item.deadline ?? null,
						noteId: item.noteId ?? null,
						updatedAt: Date.now(),
					})),
				}),
			});

			await indexAgent.fetch("https://index-agent/internal", {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify({
					action: "contradictions",
					contradictions: summary.contradictions.map((item) => ({
						id: item.id,
						factAId: item.factAId,
						factBId: item.factBId,
						status: item.status,
						updatedAt: Date.now(),
					})),
				}),
			});
		});

		await step.do("mark-processed", async () => {
			if (noteIds.length === 0) {
				return;
			}

			await this.env.DB.prepare(
				`UPDATE notes SET processed_at = ?1 WHERE id IN (${noteIds
					.map(() => "?")
					.join(",")}) AND user_id = ?${noteIds.length + 2}`,
			)
				.bind(Date.now(), ...noteIds, userId)
				.run();
		});

		await step.reportComplete({
			processed: noteIds.length,
			collections: summary.collections.length,
			contradictions: summary.contradictions.length,
		});
	}
}
