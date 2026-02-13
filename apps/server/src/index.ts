import { createContext } from "@gneissdotrun/api/context";
import { appRouter } from "@gneissdotrun/api/routers/index";
import { auth } from "@gneissdotrun/auth";
import { env } from "@gneissdotrun/env/server";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { getAgentByName, routeAgentRequest } from "agents";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { validator } from "hono/validator";
import { agentsMiddleware } from "hono-agents";
import z from "zod";

import type { IndexAgent, OrganizationAgent, RouterAgent, SurfacingAgent } from "./agents";

const app = new Hono<{ Bindings: Env }>();

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

	return parsed.data;
});

const routeNotePayloadSchema = z.object({
	noteId: z.uuid(),
	userInput: z.string().trim().min(1).max(50_000),
});

const routeNoteValidator = validator("json", (value, c) => {
	const parsed = routeNotePayloadSchema.safeParse(value);
	if (!parsed.success) {
		return c.json(
			{
				error: "Invalid routing payload",
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
]);

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

app.use(logger());
app.use(
	"/*",
	cors({
		origin: env.CORS_ORIGIN,
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	}),
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.use(
	"/agents/*",
	agentsMiddleware({
		options: {
			prefix: "agents",
		},
	}),
);

app.all("/agents/*", async (c) => {
	const response = await routeAgentRequest(c.req.raw, c.env, {
		prefix: "agents",
	});

	if (response) {
		return response;
	}

	return c.json({ error: "Agent route not found" }, 404);
});

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

app.post("/api/notes", createNoteValidator, async (c) => {
	const user = await getSessionUser(c.req.raw);
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const input = c.req.valid("json");
	const noteId = crypto.randomUUID();
	const title = input.title && input.title.length > 0 ? input.title : "Untitled note";
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

		const organizationAgent = await getAgentByName<Env, OrganizationAgent>(
			c.env.ORGANIZATION_AGENT,
			user.id,
		);

		if (input.content.trim().length > 0) {
			await organizationAgent.fetch("https://organization-agent/internal", {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify({
					action: "run_organize",
					noteIds: [noteId],
				}),
			});
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

app.post("/api/notes/route", routeNoteValidator, async (c) => {
	const user = await getSessionUser(c.req.raw);
	if (!user) {
		return c.json({ error: "Unauthorized" }, 401);
	}

	const input = c.req.valid("json");
	const note = await c.env.DB.prepare(
		"SELECT id, content, title, summary, updated_at FROM notes WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL",
	)
		.bind(input.noteId, user.id)
		.first<{
			id: string;
			content: string;
			title: string;
			summary: string;
			updated_at: number;
		}>();

	if (!note) {
		return c.json({ error: "Note not found" }, 404);
	}

	const routerAgent = await getAgentByName<Env, RouterAgent>(c.env.ROUTER_AGENT, user.id);
	const response = await routerAgent.fetch("https://router-agent/internal", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({
			noteId: input.noteId,
			noteContent: note.content,
			userInput: input.userInput,
		}),
	});

	if (!response.ok) {
		return c.json({ error: "RouterAgent failed" }, 502);
	}

	const payload = (await response.json()) as {
		decision: {
			kind: string;
			confidence: number;
			reason: string;
			tags: string[];
			target: "rewrite-agent" | "organization-agent" | "none";
		};
	};

	return c.json({
		decision: payload.decision,
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
