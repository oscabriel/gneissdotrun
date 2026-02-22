import type {
	CaptureErrorCode,
	RouteExecutionKind,
	RouteExecutionOutcome,
	RouteExecutionSecondaryEffect,
} from "@gneissdotrun/api/capture-contract";
import { getAgentByName } from "agents";

import type { IndexAgent, RouterAgent } from "./agents";
import { generateRewriteText } from "./agents/shared";
import type { RoutingDecision } from "./agents/shared";
import { queueFanOutInBackground } from "./agents/workflows/fanout-workflow";
import { createAuditLog } from "./audit";
import { createNoteHistoryEvent, createNoteVersion, ensureHistorySchema } from "./history";

interface CaptureRequestInput {
	userId: string;
	noteId?: string;
	userInput: string;
}

export type RewriteProgressUpdate =
	| {
			mode: "append";
			text: string;
	  }
	| {
			mode: "replace";
			text: string;
	  };

interface CaptureExecutionOptions {
	onRewriteProgress?: (update: RewriteProgressUpdate) => Promise<void> | void;
}

interface CaptureExecutionResult {
	decision: {
		kind: RouteExecutionKind;
		confidence: number;
		reason: string;
		tags: string[];
		target: "rewrite-agent" | "organization-agent" | "none";
	};
	outcome: RouteExecutionOutcome;
}

interface CaptureAuditEvent {
	eventId: string;
	userId: string;
	routeKind: RouteExecutionKind;
	uiAction: RouteExecutionOutcome["uiAction"];
	noteId?: string;
	secondaryEffects: RouteExecutionSecondaryEffect[];
	success: boolean;
	errorCode?: CaptureErrorCode;
	timestamp: number;
}

interface UserNote {
	id: string;
	title: string;
	content: string;
	summary: string;
	tags: string[];
	updatedAt: number;
	createdAt: number;
}

interface WorkspaceActionResult {
	label: string;
	toastMessage: string;
	effectId?: string;
}

const CONFIDENCE_HIGH = 0.75;
const CONFIDENCE_MEDIUM = 0.45;

const ROUTE_KINDS: RouteExecutionKind[] = [
	"new_note",
	"update_existing",
	"correction",
	"split",
	"fan_out",
	"workspace_action",
	"ephemeral_answer",
	"store_preference",
	"duplicate",
];

const WORKSPACE_ACTION_ALLOWLIST = new Set([
	"archive_note(s)",
	"mark_collection_resolved",
	"rename_collection",
	"link_notes",
	"unlink_notes",
]);
const NOTE_HISTORY_EFFECT_TYPES = new Set<RouteExecutionSecondaryEffect["type"]>([
	"created_note",
	"updated_note",
]);

const UUID_PATTERN =
	/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/g;
const COLLECTION_ID_PATTERN = /collection_[0-9a-fA-F-]{36}/;

function compactSummary(content: string): string {
	return content.replace(/\s+/g, " ").trim().slice(0, 240);
}

function stripSlashCommandLines(input: string): string {
	const lines = input.split("\n");
	const filtered = lines.filter((line) => !/^\s*\/[a-z-]+(?:\s+.*)?\s*$/i.test(line.trim()));
	return filtered.join("\n").trimEnd();
}

function deriveTitle(input: string): string {
	const firstLine = input.split("\n")[0]?.trim() ?? "";
	const cleaned = firstLine.replace(/^#+\s*/, "").trim();
	if (!cleaned) {
		return "Untitled note";
	}

	return cleaned.slice(0, 120);
}

function parseTags(raw: string): string[] {
	try {
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) {
			return [];
		}

		return parsed.filter((value): value is string => typeof value === "string");
	} catch {
		return [];
	}
}

function normalizeOutcome(outcome: RouteExecutionOutcome): RouteExecutionOutcome {
	return {
		...outcome,
		secondaryEffects: outcome.secondaryEffects ?? [],
	};
}

function clampConfidence(value: number): number {
	if (!Number.isFinite(value)) {
		return 0.5;
	}

	return Math.max(0, Math.min(1, value));
}

function normalizeDecision(raw: {
	kind: string;
	confidence: number;
	reason: string;
	tags: string[];
	target: "rewrite-agent" | "organization-agent" | "none";
}): CaptureExecutionResult["decision"] {
	const kind = ROUTE_KINDS.includes(raw.kind as RouteExecutionKind)
		? (raw.kind as RouteExecutionKind)
		: "new_note";

	return {
		kind,
		confidence: clampConfidence(raw.confidence),
		reason: raw.reason || "Fallback route decision.",
		tags: Array.from(new Set((raw.tags ?? []).map((tag) => tag.trim()).filter(Boolean))),
		target: raw.target,
	};
}

function toRoutingDecision(decision: CaptureExecutionResult["decision"]): RoutingDecision {
	return {
		kind: decision.kind,
		confidence: decision.confidence,
		reason: decision.reason,
		tags: decision.tags,
		target: decision.target,
	};
}

function normalizeWikiLinkTarget(input: string): string {
	return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function enforceExistingWikiLinks(markdown: string, candidates: Array<{ id: string; title: string }>): string {
	if (markdown.length === 0) {
		return markdown;
	}

	const allowedByNormalizedTitle = new Map(
		candidates
			.filter((candidate) => candidate.title.trim().length > 0)
			.map((candidate) => [normalizeWikiLinkTarget(candidate.title), candidate.title.trim()]),
	);

	return markdown.replace(/\[\[([^\]\n]+)\]\]/g, (fullMatch, targetLabel: string) => {
		const normalized = normalizeWikiLinkTarget(targetLabel);
		if (!normalized) {
			return fullMatch;
		}

		const canonical = allowedByNormalizedTitle.get(normalized);
		if (!canonical) {
			return targetLabel.trim();
		}

		return `[[${canonical}]]`;
	});
}

function fallbackRewriteContent(currentContent: string, userInput: string): string {
	const cleanedCurrent = stripSlashCommandLines(currentContent).trim();
	const cleanedInput = stripSlashCommandLines(userInput).trim();

	if (cleanedCurrent.length === 0) {
		return cleanedInput;
	}

	if (cleanedInput.length === 0) {
		return cleanedCurrent;
	}

	return `${cleanedCurrent}\n\n${cleanedInput}`.trim();
}

async function rewriteNoteContent(
	env: Env,
	userId: string,
	decision: CaptureExecutionResult["decision"],
	currentContent: string,
	userInput: string,
	currentNoteId?: string,
	options?: {
		onProgress?: (update: RewriteProgressUpdate) => Promise<void> | void;
	},
): Promise<string> {
	const recentNotes = await listRecentNotes(env, userId, 40);
	const wikiLinkCandidates = recentNotes
		.filter((note) => note.id !== currentNoteId)
		.map((note) => ({ id: note.id, title: note.title }));
	const fallback = fallbackRewriteContent(currentContent, userInput);
	if (!fallback) {
		return "";
	}

	try {
		const response = await generateRewriteText({
			noteContent: currentContent,
			userInput,
			routing: toRoutingDecision(decision),
			wikiLinkCandidates,
			temperature: 0.2,
			onDelta: async (delta) => {
				if (!options?.onProgress) {
					return;
				}

				await options.onProgress({
					mode: "append",
					text: delta,
				});
			},
		});

		const rewritten = enforceExistingWikiLinks(
			stripSlashCommandLines(response.text).trim(),
			wikiLinkCandidates,
		);
		if (rewritten.length > 0) {
			return rewritten;
		}
	} catch (error) {
		const shouldReport = !(error instanceof Error) || !/api key is missing/i.test(error.message);
		if (shouldReport) {
			console.error("capture.rewrite.failed", {
				agentName: "CapturePipeline",
				workflowId: null,
				routeKind: decision.kind,
				noteId: null,
				error,
			});
		}
	}

	if (options?.onProgress) {
		const safeFallback = enforceExistingWikiLinks(fallback, wikiLinkCandidates);
		await options.onProgress({
			mode: "replace",
			text: safeFallback,
		});

		return safeFallback;
	}

	return enforceExistingWikiLinks(fallback, wikiLinkCandidates);
}

function heuristicDecision(
	userInput: string,
	hasExistingNote: boolean,
): CaptureExecutionResult["decision"] {
	const lower = userInput.trim().toLowerCase();

	if (lower.startsWith("/ask") || lower.endsWith("?")) {
		return {
			kind: "ephemeral_answer",
			confidence: 0.7,
			reason: "Question-like prompt detected.",
			tags: ["ephemeral"],
			target: "none",
		};
	}

	if (lower.startsWith("/remember") || lower.includes("prefer")) {
		return {
			kind: "store_preference",
			confidence: 0.7,
			reason: "Preference cue detected.",
			tags: ["preference"],
			target: "none",
		};
	}

	if (lower.includes("split") || lower.includes("separate")) {
		return {
			kind: "split",
			confidence: 0.68,
			reason: "Split intent detected.",
			tags: ["split"],
			target: "rewrite-agent",
		};
	}

	if (lower.includes("and also") || lower.includes("plus")) {
		return {
			kind: "fan_out",
			confidence: 0.67,
			reason: "Fan-out intent detected.",
			tags: ["fanout"],
			target: "organization-agent",
		};
	}

	if (lower.startsWith("fix") || lower.startsWith("correct")) {
		return {
			kind: "correction",
			confidence: 0.66,
			reason: "Correction intent detected.",
			tags: ["correction"],
			target: "rewrite-agent",
		};
	}

	if (hasExistingNote) {
		return {
			kind: "update_existing",
			confidence: 0.62,
			reason: "Default update path.",
			tags: ["update"],
			target: "rewrite-agent",
		};
	}

	return {
		kind: "new_note",
		confidence: 0.56,
		reason: "Default new-note path.",
		tags: ["new_note"],
		target: "rewrite-agent",
	};
}

function extractSplitSegments(input: string): string[] {
	const cleaned = stripSlashCommandLines(input).trim();
	if (!cleaned) {
		return [];
	}

	const paragraphSegments = cleaned
		.split(/\n\s*\n+/)
		.map((segment) => segment.trim())
		.filter(Boolean);

	if (paragraphSegments.length >= 2) {
		return paragraphSegments;
	}

	const sentenceSegments = cleaned
		.split(/(?<=[.!?])\s+/)
		.map((segment) => segment.trim())
		.filter(Boolean);

	if (sentenceSegments.length >= 2) {
		return sentenceSegments;
	}

	const midpoint = Math.floor(cleaned.length / 2);
	return [cleaned.slice(0, midpoint).trim(), cleaned.slice(midpoint).trim()].filter(Boolean);
}

function selectPrimaryNoteId(
	candidates: Array<{
		noteId: string;
		relevanceScore: number;
		touchedAt: number;
		createdOrder: number;
	}>,
): string | null {
	if (!candidates.length) {
		return null;
	}

	const sorted = [...candidates].sort((left, right) => {
		if (left.relevanceScore !== right.relevanceScore) {
			return right.relevanceScore - left.relevanceScore;
		}

		if (left.touchedAt !== right.touchedAt) {
			return right.touchedAt - left.touchedAt;
		}

		return left.createdOrder - right.createdOrder;
	});

	return sorted[0]?.noteId ?? null;
}

function captureError(
	code: CaptureErrorCode,
	message: string,
	recoverable: boolean,
	status: number,
): CaptureExecutionError {
	return new CaptureExecutionError(code, message, recoverable, status);
}

class CaptureExecutionError extends Error {
	constructor(
		public readonly code: CaptureErrorCode,
		message: string,
		public readonly recoverable: boolean,
		public readonly status: number,
	) {
		super(message);
	}
}

async function getNoteById(env: Env, userId: string, noteId: string): Promise<UserNote | null> {
	const row = await env.DB.prepare(
		"SELECT id, title, content, summary, tags, updated_at, created_at FROM notes WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL",
	)
		.bind(noteId, userId)
		.first<{
			id: string;
			title: string;
			content: string;
			summary: string;
			tags: string;
			updated_at: number;
			created_at: number;
		}>();

	if (!row) {
		return null;
	}

	return {
		id: row.id,
		title: row.title,
		content: row.content,
		summary: row.summary,
		tags: parseTags(row.tags),
		updatedAt: row.updated_at,
		createdAt: row.created_at,
	};
}

async function listRecentNotes(env: Env, userId: string, limit: number): Promise<UserNote[]> {
	const rows = await env.DB.prepare(
		"SELECT id, title, content, summary, tags, updated_at, created_at FROM notes WHERE user_id = ?1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT ?2",
	)
		.bind(userId, limit)
		.all<{
			id: string;
			title: string;
			content: string;
			summary: string;
			tags: string;
			updated_at: number;
			created_at: number;
		}>();

	return (rows.results ?? []).map((row) => ({
		id: row.id,
		title: row.title,
		content: row.content,
		summary: row.summary,
		tags: parseTags(row.tags),
		updatedAt: row.updated_at,
		createdAt: row.created_at,
	}));
}

async function notifyIndexUpsert(env: Env, userId: string, note: UserNote): Promise<void> {
	const indexAgent = await getAgentByName<Env, IndexAgent>(env.INDEX_AGENT, userId);
	await indexAgent.fetch("https://index-agent/internal", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({
			action: "upsert",
			note: {
				id: note.id,
				title: note.title,
				summary: note.summary,
				updatedAt: note.updatedAt,
			},
		}),
	});
}

async function notifyIndexRemove(env: Env, userId: string, noteId: string): Promise<void> {
	const indexAgent = await getAgentByName<Env, IndexAgent>(env.INDEX_AGENT, userId);
	await indexAgent.fetch("https://index-agent/internal", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({
			action: "remove",
			noteId,
		}),
	});
}

async function createNote(env: Env, userId: string, rawContent: string): Promise<UserNote> {
	const now = Date.now();
	const content = stripSlashCommandLines(rawContent).trim();
	const title = deriveTitle(content);
	const noteId = crypto.randomUUID();
	const summary = compactSummary(content);

	await env.DB.prepare(
		"INSERT INTO notes (id, user_id, title, content, summary, tags, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
	)
		.bind(noteId, userId, title, content, summary, JSON.stringify([]), now, now)
		.run();

	const note: UserNote = {
		id: noteId,
		title,
		content,
		summary,
		tags: [],
		updatedAt: now,
		createdAt: now,
	};

	await notifyIndexUpsert(env, userId, note);
	return note;
}

async function updateNote(
	env: Env,
	userId: string,
	note: UserNote,
	rawInput: string,
	mode: "append" | "replace",
): Promise<UserNote> {
	const now = Date.now();
	const cleanedInput = stripSlashCommandLines(rawInput).trim();

	const nextContent =
		mode === "replace"
			? cleanedInput || note.content
			: [note.content.trim(), cleanedInput].filter(Boolean).join("\n\n").trim();
	const nextSummary = compactSummary(nextContent);

	await env.DB.prepare(
		"UPDATE notes SET content = ?1, summary = ?2, updated_at = ?3 WHERE id = ?4 AND user_id = ?5 AND deleted_at IS NULL",
	)
		.bind(nextContent, nextSummary, now, note.id, userId)
		.run();

	const updated: UserNote = {
		...note,
		content: nextContent,
		summary: nextSummary,
		updatedAt: now,
	};

	await notifyIndexUpsert(env, userId, updated);
	return updated;
}

async function classifyDecision(
	env: Env,
	userId: string,
	request: CaptureRequestInput,
	targetNote: UserNote | null,
): Promise<CaptureExecutionResult["decision"]> {
	const routerAgent = await getAgentByName<Env, RouterAgent>(env.ROUTER_AGENT, userId);
	const routeNoteId = targetNote?.id ?? `capture_${crypto.randomUUID()}`;
	const response = await routerAgent.fetch("https://router-agent/internal", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({
			noteId: routeNoteId,
			noteContent: targetNote?.content ?? "",
			userInput: request.userInput,
		}),
	});

	if (!response.ok) {
		return heuristicDecision(request.userInput, Boolean(targetNote));
	}

	const payload = (await response.json()) as {
		decision?: {
			kind: string;
			confidence: number;
			reason: string;
			tags: string[];
			target: "rewrite-agent" | "organization-agent" | "none";
		};
	};

	if (!payload.decision) {
		return heuristicDecision(request.userInput, Boolean(targetNote));
	}

	return normalizeDecision(payload.decision);
}

function successToast(message: string): RouteExecutionOutcome["toast"] {
	return { message, tone: "success" };
}

function warningToast(message: string): RouteExecutionOutcome["toast"] {
	return { message, tone: "warning" };
}

function infoToast(message: string): RouteExecutionOutcome["toast"] {
	return { message, tone: "info" };
}

async function executeWorkspaceAction(
	env: Env,
	userId: string,
	userInput: string,
	targetNote: UserNote | null,
): Promise<WorkspaceActionResult> {
	const lower = userInput.toLowerCase();

	if (lower.includes("archive")) {
		const ids = Array.from(new Set(userInput.match(UUID_PATTERN) ?? []));
		const targetIds = ids.length > 0 ? ids : targetNote ? [targetNote.id] : [];

		if (targetIds.length === 0) {
			throw captureError(
				"ROUTE_EXECUTION_FAILED",
				"Archive action requires a target note.",
				true,
				400,
			);
		}

		const now = Date.now();
		for (const noteId of targetIds) {
			await env.DB.prepare(
				"UPDATE notes SET deleted_at = ?1, updated_at = ?2 WHERE id = ?3 AND user_id = ?4 AND deleted_at IS NULL",
			)
				.bind(now, now, noteId, userId)
				.run();
			await notifyIndexRemove(env, userId, noteId);
		}

		return {
			label: "archive_note(s)",
			toastMessage: `Archived ${targetIds.length} note${targetIds.length === 1 ? "" : "s"}.`,
			effectId: targetIds[0],
		};
	}

	if (lower.includes("mark") && lower.includes("collection") && lower.includes("resolved")) {
		const explicitId = userInput.match(COLLECTION_ID_PATTERN)?.[0] ?? null;
		const collectionRow = explicitId
			? { id: explicitId }
			: await env.DB.prepare(
					"SELECT id FROM collections WHERE user_id = ?1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1",
				)
					.bind(userId)
					.first<{ id: string }>();

		if (!collectionRow) {
			throw captureError(
				"ROUTE_EXECUTION_FAILED",
				"No collection available to mark as resolved.",
				true,
				400,
			);
		}

		await env.DB.prepare(
			"UPDATE collections SET status = 'resolved', updated_at = ?1 WHERE id = ?2 AND user_id = ?3 AND deleted_at IS NULL",
		)
			.bind(Date.now(), collectionRow.id, userId)
			.run();

		return {
			label: "mark_collection_resolved",
			toastMessage: "Marked collection as resolved.",
			effectId: collectionRow.id,
		};
	}

	if (lower.includes("rename") && lower.includes("collection")) {
		const explicitId = userInput.match(COLLECTION_ID_PATTERN)?.[0] ?? null;
		const nextTitleMatch = userInput.match(/\bto\b\s+(.+)$/i);
		const nextTitle = nextTitleMatch?.[1]?.trim() ?? "Renamed collection";

		const collectionRow = explicitId
			? { id: explicitId }
			: await env.DB.prepare(
					"SELECT id FROM collections WHERE user_id = ?1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 1",
				)
					.bind(userId)
					.first<{ id: string }>();

		if (!collectionRow) {
			throw captureError("ROUTE_EXECUTION_FAILED", "No collection available to rename.", true, 400);
		}

		await env.DB.prepare(
			"UPDATE collections SET title = ?1, updated_at = ?2 WHERE id = ?3 AND user_id = ?4 AND deleted_at IS NULL",
		)
			.bind(nextTitle.slice(0, 120), Date.now(), collectionRow.id, userId)
			.run();

		return {
			label: "rename_collection",
			toastMessage: "Renamed collection.",
			effectId: collectionRow.id,
		};
	}

	if (lower.includes("unlink") && lower.includes("note")) {
		const ids = Array.from(new Set(userInput.match(UUID_PATTERN) ?? []));
		if (ids.length < 2) {
			throw captureError("ROUTE_EXECUTION_FAILED", "Unlink action needs two note ids.", true, 400);
		}

		await env.DB.prepare(
			"DELETE FROM note_links WHERE (from_note_id = ?1 AND to_note_id = ?2) OR (from_note_id = ?2 AND to_note_id = ?1)",
		)
			.bind(ids[0], ids[1])
			.run();

		return {
			label: "unlink_notes",
			toastMessage: "Unlinked notes.",
			effectId: `${ids[0]}:${ids[1]}`,
		};
	}

	if (lower.includes("link") && lower.includes("note")) {
		const ids = Array.from(new Set(userInput.match(UUID_PATTERN) ?? []));
		const candidateIds = ids.length >= 2 ? ids : targetNote ? [targetNote.id, ...ids] : ids;

		if (candidateIds.length < 2) {
			throw captureError("ROUTE_EXECUTION_FAILED", "Link action needs two note ids.", true, 400);
		}

		await env.DB.prepare(
			"INSERT INTO note_links (id, from_note_id, to_note_id, link_type, confidence, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
		)
			.bind(
				`link_${crypto.randomUUID()}`,
				candidateIds[0],
				candidateIds[1],
				"related",
				85,
				Date.now(),
			)
			.run();

		return {
			label: "link_notes",
			toastMessage: "Linked notes.",
			effectId: `${candidateIds[0]}:${candidateIds[1]}`,
		};
	}

	throw captureError(
		"ROUTE_EXECUTION_FAILED",
		"Workspace action is not in the v1 allowlist.",
		true,
		400,
	);
}

function buildHistoryActionSummary(
	decision: CaptureExecutionResult["decision"],
	outcome: RouteExecutionOutcome,
): string {
	if (outcome.toast?.message) {
		return outcome.toast.message;
	}

	const routeLabel = decision.kind.replaceAll("_", " ");
	switch (decision.kind) {
		case "new_note":
			return "Created a new note.";
		case "update_existing":
			return "Updated the active note.";
		case "correction":
			return "Applied a correction to the note.";
		case "split":
			return "Split capture into multiple notes.";
		case "fan_out":
			return "Accepted fan-out and queued background organization.";
		case "workspace_action":
			return "Applied a workspace action.";
		case "store_preference":
			return "Stored a workspace preference.";
		case "duplicate":
			return "Detected duplicate capture and skipped note creation.";
		case "ephemeral_answer":
			return "Returned an ephemeral answer.";
		default:
			return `Executed ${routeLabel}.`;
	}
}

function collectHistoryNoteIds(
	request: CaptureRequestInput,
	decision: CaptureExecutionResult["decision"],
	outcome: RouteExecutionOutcome,
): string[] {
	const noteIds = new Set<string>();

	if (outcome.noteId) {
		noteIds.add(outcome.noteId);
	}

	for (const noteId of outcome.noteIds ?? []) {
		noteIds.add(noteId);
	}

	for (const effect of outcome.secondaryEffects ?? []) {
		if (effect.id && NOTE_HISTORY_EFFECT_TYPES.has(effect.type)) {
			noteIds.add(effect.id);
		}
	}

	if (decision.kind === "workspace_action") {
		for (const noteId of request.userInput.match(UUID_PATTERN) ?? []) {
			noteIds.add(noteId);
		}

		if (request.noteId) {
			noteIds.add(request.noteId);
		}
	}

	return [...noteIds];
}

async function recordCaptureHistory(
	env: Env,
	request: CaptureRequestInput,
	decision: CaptureExecutionResult["decision"],
	outcome: RouteExecutionOutcome,
): Promise<void> {
	const noteIds = collectHistoryNoteIds(request, decision, outcome);
	if (noteIds.length === 0) {
		return;
	}

	await ensureHistorySchema(env.DB);
	const prompt = request.userInput.trim().slice(0, 5000);
	const actionSummary = buildHistoryActionSummary(decision, outcome);

	for (const noteId of noteIds) {
		const note = await getNoteById(env, request.userId, noteId);
		if (!note) {
			continue;
		}

		const versionId = await createNoteVersion(env.DB, {
			noteId: note.id,
			userId: request.userId,
			title: note.title,
			content: note.content,
			summary: note.summary,
			tags: note.tags,
		});

		await createNoteHistoryEvent(env.DB, {
			noteId: note.id,
			userId: request.userId,
			routeKind: decision.kind,
			prompt,
			actionSummary,
			versionId,
		});
	}
}

function buildAuditEvent(params: {
	decision: CaptureExecutionResult["decision"];
	outcome: RouteExecutionOutcome;
	userId: string;
	success: boolean;
	errorCode?: CaptureErrorCode;
}): CaptureAuditEvent {
	return {
		eventId: `capture_${crypto.randomUUID()}`,
		userId: params.userId,
		routeKind: params.decision.kind,
		uiAction: params.outcome.uiAction,
		noteId: params.outcome.noteId,
		secondaryEffects: params.outcome.secondaryEffects ?? [],
		success: params.success,
		errorCode: params.errorCode,
		timestamp: Date.now(),
	};
}

async function persistCaptureAudit(db: D1Database, event: CaptureAuditEvent): Promise<void> {
	try {
		await createAuditLog(db, {
			id: event.eventId,
			userId: event.userId,
			noteId: event.noteId,
			eventType: "routing_mutation",
			routeKind: event.routeKind,
			mutationKind: "capture_execution",
			success: event.success,
			errorCode: event.errorCode,
			payload: {
				uiAction: event.uiAction,
				secondaryEffects: event.secondaryEffects,
				timestamp: event.timestamp,
			},
			createdAt: event.timestamp,
		});
	} catch (error) {
		console.error("capture.audit.persist_failed", error);
	}
}

export function toCaptureErrorEnvelope(error: unknown): {
	status: number;
	body: {
		error: {
			code: CaptureErrorCode;
			message: string;
			recoverable: boolean;
		};
	};
} {
	if (error instanceof CaptureExecutionError) {
		return {
			status: error.status,
			body: {
				error: {
					code: error.code,
					message: error.message,
					recoverable: error.recoverable,
				},
			},
		};
	}

	return {
		status: 500,
		body: {
			error: {
				code: "INTERNAL",
				message: "Capture failed unexpectedly.",
				recoverable: false,
			},
		},
	};
}

export async function executeCapture(
	env: Env,
	request: CaptureRequestInput,
	options: CaptureExecutionOptions = {},
): Promise<CaptureExecutionResult> {
	const targetNote = request.noteId ? await getNoteById(env, request.userId, request.noteId) : null;

	if (request.noteId && !targetNote) {
		throw captureError("INVALID_INPUT", "noteId is invalid for this user.", true, 400);
	}

	const decision = await classifyDecision(env, request.userId, request, targetNote);
	const cleanedInput = stripSlashCommandLines(request.userInput).trim();

	const executeNewNote = async (
		toast?: RouteExecutionOutcome["toast"],
	): Promise<CaptureExecutionResult> => {
		const rewritten = await rewriteNoteContent(
			env,
			request.userId,
			decision,
			"",
			cleanedInput || request.userInput,
			undefined,
			{
			onProgress: options.onRewriteProgress,
			},
		);
		const created = await createNote(
			env,
			request.userId,
			rewritten || cleanedInput || request.userInput,
		);
		const outcome = normalizeOutcome({
			kind: "new_note",
			uiAction: "open_note",
			noteId: created.id,
			toast,
			secondaryEffects: [{ type: "created_note", id: created.id }],
		});

		return { decision, outcome };
	};

	const executeUpdateExisting = async (
		note: UserNote,
		toast?: RouteExecutionOutcome["toast"],
	): Promise<CaptureExecutionResult> => {
		const rewritten = await rewriteNoteContent(
			env,
			request.userId,
			decision,
			note.content,
			request.userInput,
			note.id,
			{
			onProgress: options.onRewriteProgress,
			},
		);
		const updated = await updateNote(
			env,
			request.userId,
			note,
			rewritten || note.content,
			"replace",
		);
		const outcome = normalizeOutcome({
			kind: "update_existing",
			uiAction: "open_note",
			noteId: updated.id,
			toast,
			secondaryEffects: [{ type: "updated_note", id: updated.id }],
		});

		return { decision, outcome };
	};

	let result: CaptureExecutionResult;

	try {
		switch (decision.kind) {
			case "new_note": {
				result = await executeNewNote();
				break;
			}
			case "update_existing": {
				if (!targetNote) {
					result = await executeNewNote(
						warningToast("No active note selected. Created a new note."),
					);
					break;
				}

				result = await executeUpdateExisting(targetNote);
				break;
			}
			case "correction": {
				if (decision.confidence < CONFIDENCE_MEDIUM) {
					result = await executeNewNote(
						warningToast("Low correction confidence. Saved as a new note instead."),
					);
					break;
				}

				if (!targetNote) {
					result = await executeNewNote(
						warningToast("No correction target found. Saved as a new note."),
					);
					break;
				}

				const rewritten = await rewriteNoteContent(
					env,
					request.userId,
					decision,
					targetNote.content,
									request.userInput,
					targetNote.id,
									{
										onProgress: options.onRewriteProgress,
									},
								);
				const updated = await updateNote(
					env,
					request.userId,
					targetNote,
					rewritten || targetNote.content,
					"replace",
				);
				result = {
					decision,
					outcome: normalizeOutcome({
						kind: "correction",
						uiAction: "open_note",
						noteId: updated.id,
						toast:
							decision.confidence < CONFIDENCE_HIGH
								? warningToast("Applied correction with medium confidence.")
								: successToast("Applied correction."),
						secondaryEffects: [{ type: "updated_note", id: updated.id }],
					}),
				};
				break;
			}
			case "split": {
				const segments = extractSplitSegments(request.userInput);
				if (segments.length < 2) {
					result = await executeNewNote(
						warningToast("Not enough segments to split. Saved as one note."),
					);
					break;
				}

				const created: UserNote[] = [];
				for (const [index, segment] of segments.entries()) {
					const rewritten = await rewriteNoteContent(env, request.userId, decision, "", segment, undefined, {
						onProgress: index === 0 ? options.onRewriteProgress : undefined,
					});
					created.push(await createNote(env, request.userId, rewritten || segment));
				}

				const primaryId =
					selectPrimaryNoteId(
						created.map((note, index) => ({
							noteId: note.id,
							relevanceScore: 1 / (index + 1),
							touchedAt: note.updatedAt,
							createdOrder: index,
						})),
					) ?? created[0]!.id;

				result = {
					decision,
					outcome: normalizeOutcome({
						kind: "split",
						uiAction: "open_note",
						noteId: primaryId,
						noteIds: created.map((note) => note.id),
						toast: infoToast(`Split into ${created.length} notes.`),
						secondaryEffects: created.map<RouteExecutionSecondaryEffect>((note) => ({
							type: "created_note",
							id: note.id,
						})),
					}),
				};
				break;
			}
			case "fan_out": {
				const rewrittenPrimary = await rewriteNoteContent(
					env,
					request.userId,
					decision,
					targetNote?.content ?? "",
								cleanedInput || request.userInput,
					targetNote?.id,
								{
									onProgress: options.onRewriteProgress,
								},
							);
				const primary = targetNote
					? await updateNote(
							env,
							request.userId,
							targetNote,
							rewrittenPrimary || targetNote.content,
							"replace",
						)
					: await createNote(
							env,
							request.userId,
							rewrittenPrimary || cleanedInput || request.userInput,
						);
				const recent = await listRecentNotes(env, request.userId, 6);
				const fanoutTargets = recent
					.map((note) => note.id)
					.filter((noteId) => noteId !== primary.id)
					.slice(0, 5);

				queueFanOutInBackground(env, {
					userId: request.userId,
					targetNoteIds: fanoutTargets,
					input: cleanedInput || request.userInput,
				});

				const primaryId =
					selectPrimaryNoteId([
						{
							noteId: primary.id,
							relevanceScore: 1,
							touchedAt: primary.updatedAt,
							createdOrder: 0,
						},
					]) ?? primary.id;

				result = {
					decision,
					outcome: normalizeOutcome({
						kind: "fan_out",
						uiAction: "open_note",
						noteId: primaryId,
						toast: infoToast("Fan-out accepted and queued in the background."),
						secondaryEffects: [
							{ type: "queued_fanout", id: primaryId },
							...(targetNote ? [] : [{ type: "created_note" as const, id: primaryId }]),
						],
					}),
				};
				break;
			}
			case "workspace_action": {
				const actionResult = await executeWorkspaceAction(
					env,
					request.userId,
					request.userInput,
					targetNote,
				);

				if (!WORKSPACE_ACTION_ALLOWLIST.has(actionResult.label)) {
					throw captureError(
						"ROUTE_EXECUTION_FAILED",
						"Workspace action is not in the v1 allowlist.",
						true,
						400,
					);
				}

				result = {
					decision,
					outcome: normalizeOutcome({
						kind: "workspace_action",
						uiAction: "stay_blank",
						toast: successToast(actionResult.toastMessage),
						secondaryEffects: [
							{ type: "action_executed", id: actionResult.effectId, label: actionResult.label },
						],
					}),
				};
				break;
			}
			case "ephemeral_answer": {
				const question = request.userInput.replace(/^\/ask\s*/i, "").trim();
				result = {
					decision,
					outcome: normalizeOutcome({
						kind: "ephemeral_answer",
						uiAction: "show_ephemeral",
						ephemeral: {
							content: question || "Here is a quick answer.",
							dismiss: "on_input",
							timeoutMs: 8000,
						},
					}),
				};
				break;
			}
			case "store_preference": {
				const now = Date.now();
				const preference =
					request.userInput.replace(/^\/remember\s*/i, "").trim() || request.userInput;
				const id = `pref_${crypto.randomUUID()}`;

				await env.DB.prepare(
					"INSERT INTO user_preferences (id, user_id, category, preference, confidence, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
				)
					.bind(
						id,
						request.userId,
						"general",
						preference,
						Math.round(decision.confidence * 100),
						now,
						now,
					)
					.run();

				result = {
					decision,
					outcome: normalizeOutcome({
						kind: "store_preference",
						uiAction: "stay_blank",
						toast: successToast("Preference saved."),
						secondaryEffects: [{ type: "preference_saved", id }],
					}),
				};
				break;
			}
			case "duplicate": {
				if (decision.confidence < CONFIDENCE_MEDIUM) {
					result = await executeNewNote(
						warningToast("Duplicate confidence is low. Saved as a new note instead."),
					);
					break;
				}

				const recent = await listRecentNotes(env, request.userId, 1);
				const hint = recent[0] ? ` Similar note: ${recent[0].title}.` : "";

				result = {
					decision,
					outcome: normalizeOutcome({
						kind: "duplicate",
						uiAction: "stay_blank",
						toast:
							decision.confidence < CONFIDENCE_HIGH
								? warningToast(`Looks like a duplicate.${hint}`)
								: infoToast(`Skipped duplicate note creation.${hint}`),
					}),
				};
				break;
			}
			default: {
				throw captureError(
					"ROUTE_EXECUTION_FAILED",
					`Unsupported route kind: ${decision.kind}`,
					false,
					500,
				);
			}
		}

		await recordCaptureHistory(env, request, result.decision, result.outcome);

		const auditEvent = buildAuditEvent({
			decision: result.decision,
			outcome: result.outcome,
			userId: request.userId,
			success: true,
		});
		await persistCaptureAudit(env.DB, auditEvent);
		console.info("capture.audit", auditEvent);

		return result;
	} catch (error) {
		const envelope = toCaptureErrorEnvelope(error);
		console.error("capture.execution.failed", {
			agentName: "CapturePipeline",
			workflowId: null,
			routeKind: decision.kind,
			noteId: request.noteId ?? null,
			errorCode: envelope.body.error.code,
			error,
		});

		const auditEvent: CaptureAuditEvent = {
			eventId: `capture_${crypto.randomUUID()}`,
			userId: request.userId,
			routeKind: decision.kind,
			uiAction: "stay_blank",
			noteId: undefined,
			secondaryEffects: [],
			success: false,
			errorCode: envelope.body.error.code,
			timestamp: Date.now(),
		};
		await persistCaptureAudit(env.DB, auditEvent);
		console.info("capture.audit", auditEvent);
		throw error;
	}
}
