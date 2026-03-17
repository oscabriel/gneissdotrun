import type { CaptureInvocationSource } from "@gneissdotrun/api/capture-contract";
import { parseSlashCommands, type SlashCommandIntent } from "@gneissdotrun/api/slash-commands";

import type { RoutingDecision } from "./agents/shared";
import { listNoteHistory } from "./history";

export interface SlashCommandContextEntry {
	id: string;
	title: string;
	summary: string;
	updatedAt: number;
}

export interface SlashCommandFactEntry {
	id: string;
	text: string;
	category: string;
	sourceNoteId: string | null;
	updatedAt: number;
}

export interface RewriteCommandContext {
	interactionType: "capture" | "slash_command";
	commandName: string | null;
	commandArgument: string;
	rawCommand: string;
	scope: "note" | "blank_capture";
	recentHistory: Array<{
		routeKind: string;
		prompt: string;
		actionSummary: string;
		timestamp: number;
	}>;
	relatedNotes: SlashCommandContextEntry[];
	collections: SlashCommandContextEntry[];
	facts: SlashCommandFactEntry[];
	sourceNoteIds: string[];
}

export interface SlashCommandExecutionPlan {
	command: SlashCommandIntent;
	routing: RoutingDecision;
	rewriteContext: RewriteCommandContext;
	preferEphemeralAnswer: boolean;
}

export interface ActiveNoteLike {
	id: string;
	title: string;
	content: string;
	summary: string;
	tags: string[];
	updatedAt: number;
	createdAt: number;
}

export function getPrimarySlashCommand(
	pendingCommands: SlashCommandIntent[] | undefined,
	userInput: string,
): SlashCommandIntent | null {
	const candidates = (
		pendingCommands && pendingCommands.length > 0 ? pendingCommands : parseSlashCommands(userInput)
	).filter((command) => command.kind !== "editor");

	return candidates[0] ?? null;
}

export async function createSlashCommandExecutionPlan(
	env: Env,
	params: {
		userId: string;
		targetNote: ActiveNoteLike | null;
		userInput: string;
		pendingCommands?: SlashCommandIntent[];
		invocationSource?: CaptureInvocationSource;
	},
): Promise<SlashCommandExecutionPlan | null> {
	const command = getPrimarySlashCommand(params.pendingCommands, params.userInput);
	if (!command) {
		return null;
	}

	const isNoteRun = params.invocationSource === "note_run";
	if (!isNoteRun && command.kind === "freeform") {
		return null;
	}

	const hasTargetNote = Boolean(params.targetNote);
	const preferEphemeralAnswer =
		command.commandName === "ask" && !hasTargetNote && params.invocationSource !== "note_run";
	const routeKind = preferEphemeralAnswer
		? "ephemeral_answer"
		: hasTargetNote
			? "update_existing"
			: "new_note";

	const rewriteContext = await buildRewriteCommandContext(env, {
		userId: params.userId,
		noteId: params.targetNote?.id,
		command,
		scope: hasTargetNote ? "note" : "blank_capture",
	});

	return {
		command,
		routing: {
			kind: routeKind,
			confidence: preferEphemeralAnswer ? 0.88 : 0.94,
			reason: preferEphemeralAnswer
				? "Blank-page /ask stays ephemeral."
				: `Explicit slash command /${command.commandName ?? "custom"} matched.`,
			tags: ["slash_command", command.kind, command.commandName ?? "custom"],
			target: preferEphemeralAnswer ? "none" : "rewrite-agent",
		},
		rewriteContext,
		preferEphemeralAnswer,
	};
}

async function buildRewriteCommandContext(
	env: Env,
	params: {
		userId: string;
		noteId?: string;
		command: SlashCommandIntent;
		scope: "note" | "blank_capture";
	},
): Promise<RewriteCommandContext> {
	const [recentHistory, relatedNotes, collections, facts] = await Promise.all([
		loadRecentHistory(env, params.userId, params.noteId),
		loadRelatedNotes(env, params.userId, params.noteId),
		loadCollections(env, params.userId),
		loadFacts(env, params.userId, params.noteId),
	]);

	return {
		interactionType: "slash_command",
		commandName: params.command.commandName,
		commandArgument: params.command.argument,
		rawCommand: params.command.raw,
		scope: params.scope,
		recentHistory,
		relatedNotes,
		collections,
		facts,
		sourceNoteIds: Array.from(
			new Set(
				facts
					.map((fact) => fact.sourceNoteId)
					.filter((noteId): noteId is string => typeof noteId === "string" && noteId.length > 0),
			),
		),
	};
}

async function loadRecentHistory(
	env: Env,
	userId: string,
	noteId?: string,
): Promise<RewriteCommandContext["recentHistory"]> {
	if (!noteId) {
		return [];
	}

	try {
		const entries = await listNoteHistory(env.DB, userId, noteId, 5);
		return entries.map((entry) => ({
			routeKind: entry.routeKind,
			prompt: entry.prompt,
			actionSummary: entry.actionSummary,
			timestamp: entry.timestamp,
		}));
	} catch {
		return [];
	}
}

async function loadRelatedNotes(
	env: Env,
	userId: string,
	noteId?: string,
): Promise<SlashCommandContextEntry[]> {
	try {
		const rows = await env.DB.prepare(
			"SELECT id, title, summary, updated_at FROM notes WHERE user_id = ?1 AND deleted_at IS NULL AND (?2 IS NULL OR id != ?2) ORDER BY updated_at DESC LIMIT 6",
		)
			.bind(userId, noteId ?? null)
			.all<{
				id: string;
				title: string;
				summary: string;
				updated_at: number;
			}>();

		return (rows.results ?? []).map((row) => ({
			id: row.id,
			title: row.title,
			summary: row.summary,
			updatedAt: row.updated_at,
		}));
	} catch {
		return [];
	}
}

async function loadCollections(env: Env, userId: string): Promise<SlashCommandContextEntry[]> {
	try {
		const rows = await env.DB.prepare(
			"SELECT id, title, summary, updated_at FROM collections WHERE user_id = ?1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 4",
		)
			.bind(userId)
			.all<{
				id: string;
				title: string;
				summary: string;
				updated_at: number;
			}>();

		return (rows.results ?? []).map((row) => ({
			id: row.id,
			title: row.title,
			summary: row.summary,
			updatedAt: row.updated_at,
		}));
	} catch {
		return [];
	}
}

async function loadFacts(
	env: Env,
	userId: string,
	noteId?: string,
): Promise<SlashCommandFactEntry[]> {
	try {
		const rows = await env.DB.prepare(
			"SELECT id, fact, category, source_note_id, updated_at FROM facts WHERE user_id = ?1 AND status = 'active' AND (?2 IS NULL OR source_note_id = ?2) ORDER BY updated_at DESC LIMIT 6",
		)
			.bind(userId, noteId ?? null)
			.all<{
				id: string;
				fact: string;
				category: string;
				source_note_id: string | null;
				updated_at: number;
			}>();

		return (rows.results ?? []).map((row) => ({
			id: row.id,
			text: row.fact,
			category: row.category,
			sourceNoteId: row.source_note_id,
			updatedAt: row.updated_at,
		}));
	} catch {
		return [];
	}
}
