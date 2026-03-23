import { getAgentByName } from "agents";

import type { IndexAgent } from "./agents";
import { generateRewriteText } from "./agents/shared";
import {
	deriveNoteTitleFromContent,
	sanitizeTitleForStorage,
	shouldAutoRetitle,
} from "./note-title";
import { triggerOrganizationRefresh } from "./organization-refresh";

const AUTO_REWRITE_DEBOUNCE_MS = 2500;
const AUTO_REWRITE_PROMPT =
	"Rewrite and organize this note for clarity. Preserve the original meaning, keep concise markdown structure, and add valid [[Wiki Links]] when helpful.";
const SLASH_COMMAND_LINE_PATTERN = /^\s*\/[a-z-]+(?:\s+.*)?\s*$/i;

interface AutoRewriteInput {
	userId: string;
	noteId: string;
	expectedUpdatedAt: number;
	reason: string;
}

interface AutoRewriteNote {
	id: string;
	title: string;
	content: string;
	tags: string[];
	updatedAt: number;
}

interface ExecutionContextLike {
	waitUntil?: (promise: Promise<unknown>) => void;
}

interface AutoRewriteDependencies {
	sleepMs?: (ms: number) => Promise<void>;
	now?: () => number;
	rewriteGenerator?: typeof generateRewriteText;
	notifyIndexUpsert?: (input: {
		env: Env;
		userId: string;
		noteId: string;
		title: string;
		summary: string;
		tags: string[];
		updatedAt: number;
	}) => Promise<void>;
	triggerOrganization?: typeof triggerOrganizationRefresh;
}

function sleepMs(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function compactSummary(content: string): string {
	return content.replace(/\s+/g, " ").trim().slice(0, 240);
}

function stripSlashCommandLines(input: string): string {
	const lines = input.split("\n");
	const filtered = lines.filter((line) => !SLASH_COMMAND_LINE_PATTERN.test(line.trim()));
	return filtered.join("\n").trimEnd();
}

function normalizeWikiLinkTarget(input: string): string {
	return input.trim().toLowerCase().replace(/\s+/g, " ");
}

function enforceExistingWikiLinks(
	markdown: string,
	candidates: Array<{ id: string; title: string }>,
): string {
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

async function loadNote(env: Env, userId: string, noteId: string): Promise<AutoRewriteNote | null> {
	const row = await env.DB.prepare(
		"SELECT id, title, content, tags, updated_at FROM notes WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL",
	)
		.bind(noteId, userId)
		.first<{
			id: string;
			title: string;
			content: string;
			tags: string;
			updated_at: number;
		}>();

	if (!row) {
		return null;
	}

	let tags: string[] = [];
	try {
		tags = JSON.parse(row.tags) as string[];
	} catch {
		tags = [];
	}

	return {
		id: row.id,
		title: row.title,
		content: row.content,
		tags,
		updatedAt: row.updated_at,
	};
}

async function loadWikiLinkCandidates(
	env: Env,
	userId: string,
	noteId: string,
): Promise<Array<{ id: string; title: string }>> {
	const rows = await env.DB.prepare(
		"SELECT id, title FROM notes WHERE user_id = ?1 AND deleted_at IS NULL AND id != ?2 ORDER BY updated_at DESC LIMIT 40",
	)
		.bind(userId, noteId)
		.all<{ id: string; title: string }>();

	return rows.results ?? [];
}

async function defaultNotifyIndexUpsert(input: {
	env: Env;
	userId: string;
	noteId: string;
	title: string;
	summary: string;
	tags: string[];
	updatedAt: number;
}): Promise<void> {
	const indexAgent = await getAgentByName<Env, IndexAgent>(input.env.INDEX_AGENT, input.userId);
	await indexAgent.fetch("https://index-agent/internal", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({
			action: "upsert",
			note: {
				id: input.noteId,
				title: input.title,
				summary: input.summary,
				tags: input.tags,
				updatedAt: input.updatedAt,
			},
		}),
	});
}

export async function runAutoRewriteForNote(
	env: Env,
	input: AutoRewriteInput,
	dependencies: AutoRewriteDependencies = {},
): Promise<{ status: string; noteId: string }> {
	const sleep = dependencies.sleepMs ?? sleepMs;
	const now = dependencies.now ?? Date.now;
	const rewriteGenerator = dependencies.rewriteGenerator ?? generateRewriteText;
	const notifyIndexUpsert = dependencies.notifyIndexUpsert ?? defaultNotifyIndexUpsert;
	const triggerOrganization = dependencies.triggerOrganization ?? triggerOrganizationRefresh;

	await sleep(AUTO_REWRITE_DEBOUNCE_MS);

	const note = await loadNote(env, input.userId, input.noteId);
	if (!note) {
		return { status: "skipped_missing", noteId: input.noteId };
	}

	if (note.updatedAt !== input.expectedUpdatedAt) {
		return { status: "skipped_stale", noteId: input.noteId };
	}

	const currentContent = stripSlashCommandLines(note.content).trim();
	if (currentContent.length === 0) {
		return { status: "skipped_empty", noteId: input.noteId };
	}

	const wikiLinkCandidates = await loadWikiLinkCandidates(env, input.userId, input.noteId);
	const rewrite = await rewriteGenerator({
		noteContent: currentContent,
		userInput: AUTO_REWRITE_PROMPT,
		routing: {
			kind: "update_existing",
			confidence: 0.94,
			reason: "Automatic post-save rewrite",
			tags: ["auto_rewrite", "post_save"],
			target: "rewrite-agent",
		},
		wikiLinkCandidates,
		temperature: 0.15,
	});

	const rewritten = enforceExistingWikiLinks(
		stripSlashCommandLines(rewrite.text).trim(),
		wikiLinkCandidates,
	);
	if (!rewritten) {
		return { status: "skipped_no_rewrite", noteId: input.noteId };
	}

	if (rewritten === currentContent) {
		return { status: "skipped_no_change", noteId: input.noteId };
	}

	const updatedAt = now();
	const summary = compactSummary(rewritten);
	const nextTitle = sanitizeTitleForStorage(
		shouldAutoRetitle(note.title) ? deriveNoteTitleFromContent(rewritten) : note.title,
	);

	await env.DB.prepare(
		"UPDATE notes SET title = ?1, content = ?2, summary = ?3, updated_at = ?4, processed_at = NULL WHERE id = ?5 AND user_id = ?6 AND deleted_at IS NULL AND updated_at = ?7",
	)
		.bind(
			nextTitle,
			rewritten,
			summary,
			updatedAt,
			input.noteId,
			input.userId,
			input.expectedUpdatedAt,
		)
		.run();

	const persisted = await loadNote(env, input.userId, input.noteId);
	if (!persisted || persisted.updatedAt !== updatedAt) {
		return { status: "skipped_conflict", noteId: input.noteId };
	}

	try {
		await notifyIndexUpsert({
			env,
			userId: input.userId,
			noteId: input.noteId,
			title: persisted.title,
			summary,
			tags: persisted.tags,
			updatedAt,
		});
	} catch (error) {
		console.error("Auto rewrite index upsert failed", {
			error,
			userId: input.userId,
			noteId: input.noteId,
		});
	}

	void triggerOrganization(env, input.userId, [input.noteId], {
		reason: `${input.reason}:auto_rewrite`,
	});

	return {
		status: "rewritten",
		noteId: input.noteId,
	};
}

export function scheduleAutoRewriteForNote(
	env: Env,
	input: AutoRewriteInput,
	options: {
		executionCtx?: ExecutionContextLike | null;
		dependencies?: AutoRewriteDependencies;
	} = {},
): void {
	const task = runAutoRewriteForNote(env, input, options.dependencies)
		.then((result) => {
			console.info("auto_rewrite", {
				userId: input.userId,
				noteId: input.noteId,
				reason: input.reason,
				status: result.status,
			});
		})
		.catch((error) => {
			console.error("Auto rewrite failed", {
				error,
				userId: input.userId,
				noteId: input.noteId,
				reason: input.reason,
			});
		});

	if (options.executionCtx?.waitUntil) {
		options.executionCtx.waitUntil(task);
		return;
	}

	void task;
}

export { AUTO_REWRITE_DEBOUNCE_MS };
