import { createContext } from "@gneissdotrun/api/context";
import { appRouter } from "@gneissdotrun/api/routers/index";
import { auth } from "@gneissdotrun/auth";
import { env } from "@gneissdotrun/env/server";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { getAgentByName } from "agents";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { validator } from "hono/validator";
import z from "zod";

import { registerAgentRoutes } from "./agents-routing";
import { type CaptureLifecycleEvent, executeCapture, toCaptureErrorEnvelope } from "./capture";
import {
	createNoteHistoryEvent,
	createNoteVersion,
	ensureHistorySchema,
	getNoteVersion,
	listNoteHistory,
} from "./history";
import type { IndexAgent, OrganizationAgent, SurfacingAgent } from "./agents";
import { rateLimitMiddleware } from "./middleware/rate-limit";
import { normalizeNoteIds, triggerOrganizationRefresh } from "./organization-refresh";
import { scheduleAutoRewriteForNote } from "./auto-rewrite";
import {
	deriveNoteTitleFromContent,
	sanitizeTitleForStorage,
	titleContainsLinks,
} from "./note-title";

const app = new Hono<{ Bindings: Env }>();

const captureRateLimit = rateLimitMiddleware({
	bucket: "capture",
	maxRequests: 30,
	windowSeconds: 60,
	responseKind: "capture",
	message: "Too many capture requests. Please try again in a moment.",
});

const queryRateLimit = rateLimitMiddleware({
	bucket: "surfacing_query",
	maxRequests: 20,
	windowSeconds: 60,
	responseKind: "generic",
	message: "Too many queries. Please try again in a moment.",
});

const uploadRateLimit = rateLimitMiddleware({
	bucket: "upload",
	maxRequests: 10,
	windowSeconds: 60,
	responseKind: "generic",
	message: "Too many uploads. Please try again in a moment.",
});

const createNotePayloadSchema = z.object({
	title: z.string().trim().max(120).optional(),
	content: z.string().max(100_000).default(""),
	tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});

const createNoteValidator = validator("json", (value, c) => {
	const parsed = createNotePayloadSchema.safeParse(value);
	if (!parsed.success) {
		return c.json(
			{
				error: "Invalid note payload",
				issues: z.flattenError(parsed.error),
			},
			400,
		);
	}

	if (parsed.data.title && titleContainsLinks(parsed.data.title)) {
		return c.json(
			{
				error: "Invalid note payload",
				issues: {
					fieldErrors: {
						title: ["Title cannot contain links."],
					},
				},
			},
			400,
		);
	}

	return parsed.data;
});

const updateNotePayloadSchema = z.object({
	title: z.string().trim().max(120).optional(),
	content: z.string().max(100_000),
});

const updateNoteValidator = validator("json", (value, c) => {
	const parsed = updateNotePayloadSchema.safeParse(value);
	if (!parsed.success) {
		return c.json(
			{
				error: "Invalid note update payload",
				issues: z.flattenError(parsed.error),
			},
			400,
		);
	}

	if (parsed.data.title && titleContainsLinks(parsed.data.title)) {
		return c.json(
			{
				error: "Invalid note update payload",
				issues: {
					fieldErrors: {
						title: ["Title cannot contain links."],
					},
				},
			},
			400,
		);
	}

	return parsed.data;
});

const capturePayloadSchema = z.object({
	noteId: z.uuid().optional(),
	userInput: z.string().trim().min(1).max(50_000),
});

const captureValidator = validator("json", (value, c) => {
	const parsed = capturePayloadSchema.safeParse(value);
	if (!parsed.success) {
		return c.json(
			{
				error: {
					code: "INVALID_INPUT",
					message: "Invalid capture payload",
					recoverable: true,
				},
				issues: z.flattenError(parsed.error),
			},
			400,
		);
	}

	return parsed.data;
});
const noteIdParamSchema = z.object({
	noteId: z.uuid(),
});

const noteIdParamValidator = validator("param", (value, c) => {
	const parsed = noteIdParamSchema.safeParse(value);
	if (!parsed.success) {
		return c.json(
			{
				error: "Invalid note id",
				issues: z.flattenError(parsed.error),
			},
			400,
		);
	}

	return parsed.data;
});

const revertNotePayloadSchema = z.object({
	versionId: z
		.string()
		.trim()
		.regex(/^version_[0-9a-fA-F-]{36}$/),
});

const revertNoteValidator = validator("json", (value, c) => {
	const parsed = revertNotePayloadSchema.safeParse(value);
	if (!parsed.success) {
		return c.json(
			{
				error: "Invalid revert payload",
				issues: z.flattenError(parsed.error),
			},
			400,
		);
	}

	return parsed.data;
});

const surfacingQueryPayloadSchema = z.object({
	question: z.string().trim().min(1).max(5_000),
});

const collectionIdSchema = z
	.string()
	.trim()
	.regex(/^collection_[0-9a-fA-F-]{36}$/);

const noteIdListSchema = z.array(z.uuid()).max(100);

const collectionLifecyclePayloadSchema = z.discriminatedUnion("action", [
	z.object({
		action: z.literal("set_collection_status"),
		collectionId: collectionIdSchema,
		status: z.enum(["active", "resolved", "archived"]),
	}),
	z.object({
		action: z.literal("rename_collection"),
		collectionId: collectionIdSchema,
		title: z.string().trim().min(1).max(120),
	}),
	z.object({
		action: z.literal("refresh_collections"),
	}),
	z.object({
		action: z.literal("run_organize"),
		noteIds: noteIdListSchema.optional(),
	}),
]);

const runFanOutPayloadSchema = z.object({
	sourceNoteId: z.uuid().optional(),
	targetNoteIds: noteIdListSchema.optional(),
	input: z.string().trim().max(50_000).optional(),
});

const contradictionIdSchema = z
	.string()
	.trim()
	.regex(/^contradiction_[0-9a-fA-F-]{36}$/);

const contradictionAnalyzePayloadSchema = z.object({
	contradictionId: contradictionIdSchema,
});

const contradictionResolvePayloadSchema = z.object({
	workflowId: z.string().trim().min(1),
	keep: z.enum(["factA", "factB"]),
	reason: z.string().trim().max(500).optional(),
});

const surfacingQueryValidator = validator("json", (value, c) => {
	const parsed = surfacingQueryPayloadSchema.safeParse(value);
	if (!parsed.success) {
		return c.json(
			{
				error: "Invalid surfacing query payload",
				issues: z.flattenError(parsed.error),
			},
			400,
		);
	}

	return parsed.data;
});

const collectionLifecycleValidator = validator("json", (value, c) => {
	const parsed = collectionLifecyclePayloadSchema.safeParse(value);
	if (!parsed.success) {
		return c.json(
			{
				error: "Invalid collection lifecycle payload",
				issues: z.flattenError(parsed.error),
			},
			400,
		);
	}

	return parsed.data;
});

const runFanOutValidator = validator("json", (value, c) => {
	const parsed = runFanOutPayloadSchema.safeParse(value);
	if (!parsed.success) {
		return c.json(
			{
				error: "Invalid fan-out payload",
				issues: z.flattenError(parsed.error),
			},
			400,
		);
	}

	return parsed.data;
});

const contradictionAnalyzeValidator = validator("json", (value, c) => {
	const parsed = contradictionAnalyzePayloadSchema.safeParse(value);
	if (!parsed.success) {
		return c.json(
			{
				error: "Invalid contradiction analyze payload",
				issues: z.flattenError(parsed.error),
			},
			400,
		);
	}

	return parsed.data;
});

const contradictionResolveValidator = validator("json", (value, c) => {
	const parsed = contradictionResolvePayloadSchema.safeParse(value);
	if (!parsed.success) {
		return c.json(
			{
				error: "Invalid contradiction resolve payload",
				issues: z.flattenError(parsed.error),
			},
			400,
		);
	}

	return parsed.data;
});

const uploadFormValidator = validator("form", (value, c) => {
	const file = value.file;
	if (!(file instanceof File)) {
		return c.json({ error: "file is required" }, 400);
	}

	if (file.size === 0) {
		return c.json({ error: "file must not be empty" }, 400);
	}

	if (file.size > 20 * 1024 * 1024) {
		return c.json({ error: "file must be 20MB or smaller" }, 400);
	}

	const noteId =
		typeof value.noteId === "string" && value.noteId.length > 0 ? value.noteId : undefined;

	return {
		file,
		noteId,
	};
});

async function getSessionUser(request: Request) {
	const session = await auth.api.getSession({
		headers: request.headers,
	});

	return session?.user ?? null;
}

function sanitizeFileName(name: string): string {
	return name.replaceAll(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function getExecutionCtxSafe(c: { executionCtx: ExecutionContext }): ExecutionContext | null {
	try {
		return c.executionCtx;
	} catch {
		return null;
	}
}

app.use(logger());
app.use(
	"/*",
	cors({
		origin: env.CORS_ORIGIN,
		allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));
app.use("/api/capture", captureRateLimit);
app.use("/api/surfacing/query", queryRateLimit);
app.use("/api/uploads", uploadRateLimit);
registerAgentRoutes(app);

app.get("/api/notes", async (c) => {
	const user = await getSessionUser(c.req.raw);
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const result = await c.env.DB.prepare(
		"SELECT id, title, content, summary, tags, updated_at FROM notes WHERE user_id = ?1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 200",
	)
		.bind(user.id)
		.all<{
			id: string;
			title: string;
			content: string;
			summary: string;
			tags: string;
			updated_at: number;
		}>();

	const notes = (result.results ?? []).map((row) => {
		let parsedTags: string[] = [];
		try {
			parsedTags = JSON.parse(row.tags) as string[];
		} catch {
			parsedTags = [];
		}

		return {
			id: row.id,
			title: row.title,
			content: row.content,
			summary: row.summary,
			tags: parsedTags,
			updatedAt: row.updated_at,
		};
	});

	return c.json({ notes });
});

app.get("/api/notes/:noteId/history", noteIdParamValidator, async (c) => {
	const user = await getSessionUser(c.req.raw);
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const { noteId } = c.req.valid("param");
	await ensureHistorySchema(c.env.DB);

	const note = await c.env.DB.prepare(
		"SELECT id, title FROM notes WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL",
	)
		.bind(noteId, user.id)
		.first<{ id: string; title: string }>();

	if (!note) {
		return c.json({ error: "Note not found" }, 404);
	}

	const history = await listNoteHistory(c.env.DB, user.id, noteId);
	return c.json({
		note,
		history,
	});
});

app.post("/api/notes/:noteId/revert", noteIdParamValidator, revertNoteValidator, async (c) => {
	const user = await getSessionUser(c.req.raw);
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const { noteId } = c.req.valid("param");
	const { versionId } = c.req.valid("json");
	await ensureHistorySchema(c.env.DB);

	const existingNote = await c.env.DB.prepare(
		"SELECT id FROM notes WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL",
	)
		.bind(noteId, user.id)
		.first<{ id: string }>();

	if (!existingNote) {
		return c.json({ error: "Note not found" }, 404);
	}

	const version = await getNoteVersion(c.env.DB, user.id, noteId, versionId);
	if (!version) {
		return c.json({ error: "Version not found" }, 404);
	}

	const now = Date.now();
	const title = sanitizeTitleForStorage(version.title);
	const summary =
		version.summary.trim().length > 0
			? version.summary
			: version.content.replace(/\s+/g, " ").trim().slice(0, 240);

	await c.env.DB.prepare(
		"UPDATE notes SET title = ?1, content = ?2, summary = ?3, tags = ?4, updated_at = ?5, processed_at = NULL WHERE id = ?6 AND user_id = ?7 AND deleted_at IS NULL",
	)
		.bind(title, version.content, summary, JSON.stringify(version.tags), now, noteId, user.id)
		.run();

	const newVersionId = await createNoteVersion(c.env.DB, {
		noteId,
		userId: user.id,
		title,
		content: version.content,
		summary,
		tags: version.tags,
		createdAt: now,
	});

	await createNoteHistoryEvent(c.env.DB, {
		noteId,
		userId: user.id,
		routeKind: "revert",
		prompt: "Manual revert from history view.",
		actionSummary: `Reverted to snapshot ${version.id}.`,
		versionId: newVersionId,
		createdAt: now,
	});

	console.info("history.audit", {
		eventId: `history_${crypto.randomUUID()}`,
		userId: user.id,
		noteId,
		action: "revert_note",
		fromVersionId: version.id,
		toVersionId: newVersionId,
		timestamp: now,
	});

	try {
		const indexAgent = await getAgentByName<Env, IndexAgent>(c.env.INDEX_AGENT, user.id);
		await indexAgent.fetch("https://index-agent/internal", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				action: "upsert",
				note: {
					id: noteId,
					title,
					summary,
					updatedAt: now,
				},
			}),
		});
	} catch (error) {
		console.error("Failed to notify index agent for revert", error);
	}

	void triggerOrganizationRefresh(c.env, user.id, [noteId], {
		reason: "note:revert",
	});

	return c.json({
		note: {
			id: noteId,
			title,
			content: version.content,
			summary,
			tags: version.tags,
			updatedAt: now,
		},
		revertedFromVersionId: version.id,
		revertedToVersionId: newVersionId,
	});
});

app.post("/api/capture", captureValidator, async (c) => {
	const user = await getSessionUser(c.req.raw);
	if (!user) {
		return c.json(
			{
				error: {
					code: "UNAUTHORIZED",
					message: "Unauthorized",
					recoverable: true,
				},
			},
			401,
		);
	}

	const input = c.req.valid("json");
	const streamRequested = c.req.query("stream") === "1";

	if (streamRequested) {
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			start(controller) {
				const writeEvent = (event: unknown) => {
					controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
				};

				const writeLifecycleEvent = (event: CaptureLifecycleEvent) => {
					writeEvent(event);
				};

				void (async () => {
					try {
						const result = await executeCapture(
							c.env,
							{
								userId: user.id,
								noteId: input.noteId,
								userInput: input.userInput,
							},
							{
								onLifecycleEvent: writeLifecycleEvent,
								onRewriteProgress: (update) => {
									writeEvent({
										type: "rewrite_progress",
										update,
									});
								},
							},
						);

						writeEvent({
							type: "outcome",
							outcome: result.outcome,
							decision: result.decision,
						});
					} catch (error) {
						const envelope = toCaptureErrorEnvelope(error);
						writeEvent({
							type: "error",
							error: envelope.body.error,
						});
					} finally {
						controller.close();
					}
				})();
			},
		});

		return new Response(stream, {
			headers: {
				"cache-control": "no-cache",
				"content-type": "application/x-ndjson; charset=utf-8",
			},
		});
	}

	try {
		const result = await executeCapture(c.env, {
			userId: user.id,
			noteId: input.noteId,
			userInput: input.userInput,
		});

		return c.json({
			outcome: result.outcome,
			decision: result.decision,
		});
	} catch (error) {
		const envelope = toCaptureErrorEnvelope(error);
		return c.json(envelope.body, {
			status: envelope.status as 400 | 401 | 429 | 500 | 502,
		});
	}
});

app.post("/api/notes", createNoteValidator, async (c) => {
	const user = await getSessionUser(c.req.raw);
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const input = c.req.valid("json");
	const noteId = crypto.randomUUID();
	const title = sanitizeTitleForStorage(
		input.title && input.title.length > 0 ? input.title : deriveNoteTitleFromContent(input.content),
	);
	const now = Date.now();

	await c.env.DB.prepare(
		"INSERT INTO notes (id, user_id, title, content, summary, tags, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
	)
		.bind(noteId, user.id, title, input.content, "", JSON.stringify(input.tags), now, now)
		.run();

	try {
		const indexAgent = await getAgentByName<Env, IndexAgent>(c.env.INDEX_AGENT, user.id);
		await indexAgent.fetch("https://index-agent/internal", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				action: "upsert",
				note: {
					id: noteId,
					title,
					summary: "",
					updatedAt: now,
				},
			}),
		});

		if (input.content.trim().length > 0) {
			void triggerOrganizationRefresh(c.env, user.id, [noteId], {
				reason: "note:create",
			});
			scheduleAutoRewriteForNote(
				c.env,
				{
					userId: user.id,
					noteId,
					expectedUpdatedAt: now,
					reason: "note:create",
				},
				{ executionCtx: getExecutionCtxSafe(c) },
			);
		}
	} catch (error) {
		console.error("Failed to notify agents", error);
	}

	return c.json({
		note: {
			id: noteId,
			title,
			content: input.content,
			tags: input.tags,
			updatedAt: now,
		},
	});
});

app.put("/api/notes/:noteId", noteIdParamValidator, updateNoteValidator, async (c) => {
	const user = await getSessionUser(c.req.raw);
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const { noteId } = c.req.valid("param");
	const input = c.req.valid("json");
	const existing = await c.env.DB.prepare(
		"SELECT id, title, tags FROM notes WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL",
	)
		.bind(noteId, user.id)
		.first<{ id: string; title: string; tags: string }>();

	if (!existing) {
		return c.json({ error: "Note not found" }, 404);
	}

	const now = Date.now();
	const hasExplicitTitle = Boolean(input.title && input.title.length > 0);
	const title = sanitizeTitleForStorage(
		hasExplicitTitle ? (input.title as string) : existing.title,
	);
	const summary = input.content.replace(/\s+/g, " ").trim().slice(0, 240);

	await c.env.DB.prepare(
		"UPDATE notes SET title = ?1, content = ?2, summary = ?3, updated_at = ?4, processed_at = NULL WHERE id = ?5 AND user_id = ?6 AND deleted_at IS NULL",
	)
		.bind(title, input.content, summary, now, noteId, user.id)
		.run();

	let tags: string[] = [];
	try {
		tags = JSON.parse(existing.tags) as string[];
	} catch {
		tags = [];
	}

	try {
		const indexAgent = await getAgentByName<Env, IndexAgent>(c.env.INDEX_AGENT, user.id);
		await indexAgent.fetch("https://index-agent/internal", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				action: "upsert",
				note: {
					id: noteId,
					title,
					summary,
					updatedAt: now,
				},
			}),
		});
	} catch (error) {
		console.error("Failed to notify index agent for note update", error);
	}

	void triggerOrganizationRefresh(c.env, user.id, [noteId], {
		reason: "note:update",
	});

	return c.json({
		note: {
			id: noteId,
			title,
			content: input.content,
			tags,
			updatedAt: now,
		},
	});
});

app.delete("/api/notes/:noteId", noteIdParamValidator, async (c) => {
	const user = await getSessionUser(c.req.raw);
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const { noteId } = c.req.valid("param");
	const existing = await c.env.DB.prepare(
		"SELECT id FROM notes WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL",
	)
		.bind(noteId, user.id)
		.first<{ id: string }>();

	if (!existing) {
		return c.json({ error: "Note not found" }, 404);
	}

	const now = Date.now();
	await c.env.DB.prepare(
		"UPDATE notes SET deleted_at = ?1, updated_at = ?2 WHERE id = ?3 AND user_id = ?4 AND deleted_at IS NULL",
	)
		.bind(now, now, noteId, user.id)
		.run();

	try {
		const indexAgent = await getAgentByName<Env, IndexAgent>(c.env.INDEX_AGENT, user.id);
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
	} catch (error) {
		console.error("Failed to notify index agent for note delete", error);
	}

	return c.json({
		noteId,
		deletedAt: now,
	});
});

app.post("/api/notes/:noteId/restore", noteIdParamValidator, async (c) => {
	const user = await getSessionUser(c.req.raw);
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const { noteId } = c.req.valid("param");
	const existing = await c.env.DB.prepare(
		"SELECT id, title, summary, updated_at FROM notes WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NOT NULL",
	)
		.bind(noteId, user.id)
		.first<{ id: string; title: string; summary: string; updated_at: number }>();

	if (!existing) {
		return c.json({ error: "Archived note not found" }, 404);
	}

	const now = Date.now();
	await c.env.DB.prepare(
		"UPDATE notes SET deleted_at = NULL, updated_at = ?1 WHERE id = ?2 AND user_id = ?3 AND deleted_at IS NOT NULL",
	)
		.bind(now, noteId, user.id)
		.run();

	try {
		const indexAgent = await getAgentByName<Env, IndexAgent>(c.env.INDEX_AGENT, user.id);
		await indexAgent.fetch("https://index-agent/internal", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				action: "upsert",
				note: {
					id: noteId,
					title: existing.title,
					summary: existing.summary,
					updatedAt: now,
				},
			}),
		});
	} catch (error) {
		console.error("Failed to notify index agent for note restore", error);
	}

	return c.json({
		note: {
			id: noteId,
			title: existing.title,
			summary: existing.summary,
			updatedAt: now,
		},
	});
});

app.post("/api/surfacing/query", surfacingQueryValidator, async (c) => {
	const user = await getSessionUser(c.req.raw);
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const input = c.req.valid("json");
	const surfacingAgent = await getAgentByName<Env, SurfacingAgent>(c.env.SURFACING_AGENT, user.id);
	const response = await surfacingAgent.fetch("https://surfacing-agent/internal", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({
			action: "query",
			question: input.question,
		}),
	});

	if (!response.ok) {
		return c.json({ error: "SurfacingAgent query failed" }, 502);
	}

	const payload = (await response.json()) as {
		answer: string;
		citations: Array<{ id: string; title: string }>;
		relatedCollections: Array<{ id: string; title: string; summary: string }>;
		followUps: string[];
	};

	return c.json(payload);
});

app.get("/api/collections", async (c) => {
	const user = await getSessionUser(c.req.raw);
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const organizationAgent = await getAgentByName<Env, OrganizationAgent>(
		c.env.ORGANIZATION_AGENT,
		user.id,
	);
	const response = await organizationAgent.fetch("https://organization-agent/internal", {
		method: "GET",
	});

	if (!response.ok) {
		return c.json({ error: "OrganizationAgent collections fetch failed" }, 502);
	}

	const payload = (await response.json()) as {
		collections: Array<{
			id: string;
			title: string;
			summary: string;
			status: "active" | "resolved" | "archived";
			noteCount: number;
			lastCaptureAt: number | null;
			updatedAt: number;
		}>;
	};

	return c.json(payload);
});

app.post("/api/collections/lifecycle", collectionLifecycleValidator, async (c) => {
	const user = await getSessionUser(c.req.raw);
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const input = c.req.valid("json");
	if (input.action === "run_organize") {
		let noteIds = normalizeNoteIds(input.noteIds ?? []);
		if (noteIds.length === 0) {
			const pending = await c.env.DB.prepare(
				"SELECT id FROM notes WHERE user_id = ?1 AND deleted_at IS NULL AND processed_at IS NULL ORDER BY updated_at DESC LIMIT 50",
			)
				.bind(user.id)
				.all<{ id: string }>();
			noteIds = normalizeNoteIds((pending.results ?? []).map((row) => row.id));
		}

		if (noteIds.length === 0) {
			return c.json({ ok: true, workflowTriggered: false, noteIds: [] });
		}

		const result = await triggerOrganizationRefresh(c.env, user.id, noteIds, {
			reason: "collections:lifecycle:run_organize",
		});
		return c.json({
			ok: true,
			workflowTriggered: result.triggered,
			noteIds: result.noteIds,
		});
	}

	const organizationAgent = await getAgentByName<Env, OrganizationAgent>(
		c.env.ORGANIZATION_AGENT,
		user.id,
	);
	const response = await organizationAgent.fetch("https://organization-agent/internal", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify(input),
	});

	if (!response.ok) {
		return c.json({ error: "OrganizationAgent collection lifecycle update failed" }, 502);
	}

	return c.json(await response.json());
});

app.post("/api/workflows/fanout/run", runFanOutValidator, async (c) => {
	const user = await getSessionUser(c.req.raw);
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const input = c.req.valid("json");
	let fanOutInput = input.input?.trim() ?? "";
	if (input.sourceNoteId) {
		const sourceNote = await c.env.DB.prepare(
			"SELECT content FROM notes WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL",
		)
			.bind(input.sourceNoteId, user.id)
			.first<{ content: string }>();
		if (!sourceNote) {
			return c.json({ error: "Source note not found" }, 404);
		}

		if (fanOutInput.length === 0) {
			fanOutInput = sourceNote.content.trim();
		}
	}

	if (fanOutInput.length === 0) {
		return c.json({ error: "input is required" }, 400);
	}

	let targetNoteIds = normalizeNoteIds(input.targetNoteIds ?? []);
	if (targetNoteIds.length === 0) {
		const recent = await c.env.DB.prepare(
			"SELECT id FROM notes WHERE user_id = ?1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 6",
		)
			.bind(user.id)
			.all<{ id: string }>();
		targetNoteIds = normalizeNoteIds(
			(recent.results ?? [])
				.map((row) => row.id)
				.filter((noteId) => noteId !== input.sourceNoteId)
				.slice(0, 5),
		);
	}

	if (targetNoteIds.length === 0) {
		return c.json({ ok: true, workflow: null, targetNoteIds: [] });
	}

	const organizationAgent = await getAgentByName<Env, OrganizationAgent>(
		c.env.ORGANIZATION_AGENT,
		user.id,
	);
	const response = await organizationAgent.fetch("https://organization-agent/internal", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({
			action: "run_fanout",
			targetNoteIds,
			input: fanOutInput,
		}),
	});

	if (!response.ok) {
		return c.json({ error: "Fan-out workflow trigger failed" }, 502);
	}

	const payload = (await response.json()) as { workflow?: string | null };
	return c.json({ ok: true, workflow: payload.workflow ?? null, targetNoteIds });
});

app.get("/api/contradictions", async (c) => {
	const user = await getSessionUser(c.req.raw);
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const rows = await c.env.DB.prepare(
		`SELECT fc.id,
				fc.status,
				fc.updated_at,
				fc.resolution_reason,
				fa.id AS fact_a_id,
				fa.fact AS fact_a_text,
				fb.id AS fact_b_id,
				fb.fact AS fact_b_text
		 FROM fact_contradictions fc
		 INNER JOIN facts fa ON fa.id = fc.fact_a_id
		 INNER JOIN facts fb ON fb.id = fc.fact_b_id
		 WHERE fc.user_id = ?1 AND fc.status = 'open'
		 ORDER BY fc.updated_at DESC
		 LIMIT 100`,
	)
		.bind(user.id)
		.all<{
			id: string;
			status: string;
			updated_at: number;
			resolution_reason: string | null;
			fact_a_id: string;
			fact_a_text: string;
			fact_b_id: string;
			fact_b_text: string;
		}>();

	return c.json({
		contradictions: (rows.results ?? []).map((row) => ({
			id: row.id,
			status: row.status,
			updatedAt: row.updated_at,
			resolutionReason: row.resolution_reason,
			factA: {
				id: row.fact_a_id,
				text: row.fact_a_text,
			},
			factB: {
				id: row.fact_b_id,
				text: row.fact_b_text,
			},
		})),
	});
});

app.post("/api/contradictions/analyze", contradictionAnalyzeValidator, async (c) => {
	const user = await getSessionUser(c.req.raw);
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const { contradictionId } = c.req.valid("json");
	const contradiction = await c.env.DB.prepare(
		`SELECT fc.id,
				fa.id AS fact_a_id,
				fa.fact AS fact_a_text,
				fb.id AS fact_b_id,
				fb.fact AS fact_b_text
		 FROM fact_contradictions fc
		 INNER JOIN facts fa ON fa.id = fc.fact_a_id
		 INNER JOIN facts fb ON fb.id = fc.fact_b_id
		 WHERE fc.id = ?1 AND fc.user_id = ?2 AND fc.status = 'open'`,
	)
		.bind(contradictionId, user.id)
		.first<{
			id: string;
			fact_a_id: string;
			fact_a_text: string;
			fact_b_id: string;
			fact_b_text: string;
		}>();

	if (!contradiction) {
		return c.json({ error: "Open contradiction not found" }, 404);
	}

	const organizationAgent = await getAgentByName<Env, OrganizationAgent>(
		c.env.ORGANIZATION_AGENT,
		user.id,
	);
	const response = await organizationAgent.fetch("https://organization-agent/internal", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({
			action: "run_contradiction",
			factA: {
				id: contradiction.fact_a_id,
				text: contradiction.fact_a_text,
			},
			factB: {
				id: contradiction.fact_b_id,
				text: contradiction.fact_b_text,
			},
		}),
	});

	if (!response.ok) {
		return c.json({ error: "Contradiction workflow trigger failed" }, 502);
	}

	const payload = (await response.json()) as { workflow?: string | null };
	return c.json({
		ok: true,
		workflowId: payload.workflow ?? null,
		contradictionId,
	});
});

app.post("/api/contradictions/resolve", contradictionResolveValidator, async (c) => {
	const user = await getSessionUser(c.req.raw);
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const input = c.req.valid("json");
	const organizationAgent = await getAgentByName<Env, OrganizationAgent>(
		c.env.ORGANIZATION_AGENT,
		user.id,
	);
	const response = await organizationAgent.fetch("https://organization-agent/internal", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({
			action: "resolve_contradiction",
			workflowId: input.workflowId,
			keep: input.keep,
			reason: input.reason,
		}),
	});

	if (!response.ok) {
		return c.json({ error: "Contradiction resolution failed" }, 502);
	}

	return c.json({ ok: true });
});

app.get("/api/surfacing/digest", async (c) => {
	const user = await getSessionUser(c.req.raw);
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const surfacingAgent = await getAgentByName<Env, SurfacingAgent>(c.env.SURFACING_AGENT, user.id);
	const response = await surfacingAgent.fetch("https://surfacing-agent/internal", {
		method: "GET",
	});

	if (!response.ok) {
		return c.json({ error: "SurfacingAgent state fetch failed" }, 502);
	}

	const payload = (await response.json()) as {
		latestDigest: unknown;
		updatedAt: number;
	};

	return c.json({
		digest: payload.latestDigest ?? null,
		updatedAt: payload.updatedAt,
	});
});

app.post("/api/surfacing/digest", async (c) => {
	const user = await getSessionUser(c.req.raw);
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const surfacingAgent = await getAgentByName<Env, SurfacingAgent>(c.env.SURFACING_AGENT, user.id);
	const response = await surfacingAgent.fetch("https://surfacing-agent/internal", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({ action: "digest" }),
	});

	if (!response.ok) {
		return c.json({ error: "SurfacingAgent digest generation failed" }, 502);
	}

	return c.json(await response.json());
});

app.post("/api/uploads", uploadFormValidator, async (c) => {
	const user = await getSessionUser(c.req.raw);
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const { file, noteId } = c.req.valid("form");

	if (noteId) {
		const note = await c.env.DB.prepare("SELECT id FROM notes WHERE id = ?1 AND user_id = ?2")
			.bind(noteId, user.id)
			.first<{ id: string }>();

		if (!note) {
			return c.json({ error: "noteId does not belong to the current user" }, 400);
		}
	}

	const extensionSafeName = sanitizeFileName(file.name || "upload.bin");
	const objectKey = `${user.id}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}-${extensionSafeName}`;

	await c.env.FILES.put(objectKey, await file.arrayBuffer(), {
		httpMetadata: {
			contentType: file.type || "application/octet-stream",
		},
	});

	const uploadId = crypto.randomUUID();
	const now = Date.now();

	await c.env.DB.prepare(
		"INSERT INTO note_uploads (id, note_id, user_id, object_key, bucket, filename, content_type, size_bytes, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
	)
		.bind(
			uploadId,
			noteId ?? null,
			user.id,
			objectKey,
			"files",
			extensionSafeName,
			file.type || "application/octet-stream",
			file.size,
			now,
		)
		.run();

	return c.json({
		upload: {
			id: uploadId,
			noteId: noteId ?? null,
			filename: extensionSafeName,
			contentType: file.type || "application/octet-stream",
			sizeBytes: file.size,
			objectKey,
			createdAt: now,
		},
	});
});

export const apiHandler = new OpenAPIHandler(appRouter, {
	plugins: [
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}),
	],
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

export const rpcHandler = new RPCHandler(appRouter, {
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

app.use("/*", async (c, next) => {
	const context = await createContext({ context: c });

	const rpcResult = await rpcHandler.handle(c.req.raw, {
		prefix: "/rpc",
		context: context,
	});

	if (rpcResult.matched) {
		return c.newResponse(rpcResult.response.body, rpcResult.response);
	}

	const apiResult = await apiHandler.handle(c.req.raw, {
		prefix: "/api-reference",
		context: context,
	});

	if (apiResult.matched) {
		return c.newResponse(apiResult.response.body, apiResult.response);
	}

	await next();
});

app.get("/", (c) => {
	return c.text("OK");
});

export {
	ContradictionWorkflow,
	FanOutWorkflow,
	IndexAgent,
	OrganizationAgent,
	OrganizeWorkflow,
	RewriteAgent,
	RouterAgent,
	SurfacingAgent,
} from "./agents";

export default app;
