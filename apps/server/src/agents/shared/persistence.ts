import { createId } from "./id";
import { embedNoteForVectorize, upsertEmbeddings } from "../vectorize";
import { createAuditLog } from "../../audit";
import { sanitizeTitleForStorage } from "../../note-title";

import type { IndexedNote } from "./agent-env";

interface NotePersistenceInput {
	noteId: string;
	userId: string;
	title: string;
	content: string;
	summary: string;
	tags: string[];
	routingContext?: {
		kind: string;
		reason: string;
	};
	updatedAt?: number;
	processedAt?: number | null;
}

interface AgentNamespaceEnv {
	DB: D1Database;
	INDEX_AGENT: unknown;
	VECTORIZE: unknown;
}

async function hashContent(content: string): Promise<string> {
	const encoded = new TextEncoder().encode(content);
	const digest = await crypto.subtle.digest("SHA-256", encoded);
	const hash = Array.from(new Uint8Array(digest))
		.map((value) => value.toString(16).padStart(2, "0"))
		.join("");
	return `sha256_${hash}`;
}

export async function persistNoteAndNotify(
	env: AgentNamespaceEnv,
	input: NotePersistenceInput,
): Promise<IndexedNote> {
	const now = input.updatedAt ?? Date.now();
	const trimmedTitle = sanitizeTitleForStorage(input.title);
	const summary = input.summary.trim();
	const contentHash = await hashContent(input.content);
	const tags = input.tags ?? [];

	const processedAt = input.processedAt ?? null;

	await env.DB.prepare(
		"UPDATE notes SET title = ?1, content = ?2, summary = ?3, tags = ?4, content_hash = ?5, updated_at = ?6, processed_at = ?7 WHERE id = ?8 AND user_id = ?9",
	)
		.bind(
			trimmedTitle,
			input.content,
			summary,
			JSON.stringify(tags),
			contentHash,
			now,
			processedAt,
			input.noteId,
			input.userId,
		)
		.run();

	if (input.routingContext) {
		await env.DB.prepare(
			"INSERT INTO note_extractions (id, user_id, note_id, kind, payload, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
		)
			.bind(
				createId("extract"),
				input.userId,
				input.noteId,
				"routing_context",
				JSON.stringify(input.routingContext),
				now,
			)
			.run();
	}

	try {
		await createAuditLog(env.DB, {
			userId: input.userId,
			noteId: input.noteId,
			eventType: "rewrite_mutation",
			routeKind: input.routingContext?.kind,
			mutationKind: "persist_note_and_notify",
			success: true,
			payload: {
				reason: input.routingContext?.reason ?? null,
				contentHash,
				updatedAt: now,
				processedAt,
				tags,
			},
			createdAt: now,
		});
	} catch (error) {
		console.error("persistNoteAndNotify audit persistence failed", error);
	}

	try {
		const embedding = await embedNoteForVectorize(
			input.noteId,
			`${trimmedTitle}\n\n${input.content}`,
		);
		await upsertEmbeddings(env.VECTORIZE as VectorizeIndex, [embedding]);
	} catch (error) {
		console.error("persistNoteAndNotify embedding upsert failed", error);
	}

	return {
		id: input.noteId,
		title: trimmedTitle,
		summary,
		updatedAt: now,
	};
}

export async function notifyIndexAgent(
	env: AgentNamespaceEnv,
	indexAgentName: string,
	note: IndexedNote,
): Promise<void> {
	const namespace = env.INDEX_AGENT as DurableObjectNamespace;
	const indexAgentId = namespace.idFromName(indexAgentName);
	const indexAgent = namespace.get(indexAgentId);
	await indexAgent.fetch("https://index-agent/internal", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({
			action: "upsert",
			note,
		}),
	});
}
