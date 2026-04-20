import { getAgentByName } from "agents";
import { ORPCError } from "@orpc/server";
import z from "zod";

import {
	createNoteHistoryEvent,
	createNoteVersion,
	ensureHistorySchema,
	getNoteVersion,
	listNoteHistory,
} from "../history";
import { protectedProcedure } from "../index";

const collectionIdSchema = z
	.string()
	.trim()
	.regex(/^collection_[0-9a-fA-F-]{36}$/);

const contradictionIdSchema = z
	.string()
	.trim()
	.regex(/^contradiction_[0-9a-fA-F-]{36}$/);

const versionIdSchema = z
	.string()
	.trim()
	.regex(/^version_[0-9a-fA-F-]{36}$/);

type WeeklyDigest = {
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
};

function sanitizeTitleForStorage(input: string): string {
	const rewritten = input.replace(/\s+/g, " ").trim().slice(0, 120);
	return rewritten.length > 0 ? rewritten : "Untitled note";
}

function summarizeContent(content: string): string {
	return content.replace(/\s+/g, " ").trim().slice(0, 240);
}

async function getNamedAgent(binding: unknown, name: string): Promise<{ fetch: typeof fetch }> {
	return (await (getAgentByName as any)(binding, name)) as { fetch: typeof fetch };
}

async function triggerOrganizationRefresh(
	context: {
		hono: { env: { ORGANIZATION_AGENT: unknown } };
		session: { user: { id: string } };
	},
	noteIds: string[],
) {
	if (noteIds.length === 0) {
		return;
	}

	try {
		const organizationAgent = await getNamedAgent(
			context.hono.env.ORGANIZATION_AGENT,
			context.session.user.id,
		);
		const response = await organizationAgent.fetch("https://organization-agent/internal", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				action: "run_organize",
				noteIds,
			}),
		});

		if (!response.ok) {
			throw new Error(`Organization refresh failed (${response.status})`);
		}
	} catch (error) {
		console.error("Failed to trigger organization refresh", error);
	}
}

export const reviewRouter = {
	search: protectedProcedure
		.input(
			z.object({
				question: z.string().trim().min(1).max(5_000),
			}),
		)
		.handler(async ({ context, input }) => {
			const surfacingAgent = await getNamedAgent(
				context.hono.env.SURFACING_AGENT,
				context.session.user.id,
			);
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
				throw new ORPCError("BAD_GATEWAY", {
					message: "SurfacingAgent query failed",
				});
			}

			return (await response.json()) as {
				answer: string;
				citations: Array<{ id: string; title: string }>;
				relatedCollections: Array<{ id: string; title: string; summary: string }>;
				followUps: string[];
			};
		}),
	collections: {
		list: protectedProcedure.handler(async ({ context }) => {
			const organizationAgent = await getNamedAgent(
				context.hono.env.ORGANIZATION_AGENT,
				context.session.user.id,
			);
			const response = await organizationAgent.fetch("https://organization-agent/internal", {
				method: "GET",
			});

			if (!response.ok) {
				throw new ORPCError("BAD_GATEWAY", {
					message: "OrganizationAgent collections fetch failed",
				});
			}

			return (await response.json()) as {
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
		}),
		setStatus: protectedProcedure
			.input(
				z.object({
					collectionId: collectionIdSchema,
					status: z.enum(["active", "resolved", "archived"]),
				}),
			)
			.handler(async ({ context, input }) => {
				const organizationAgent = await getNamedAgent(
					context.hono.env.ORGANIZATION_AGENT,
					context.session.user.id,
				);
				const response = await organizationAgent.fetch("https://organization-agent/internal", {
					method: "POST",
					headers: {
						"content-type": "application/json",
					},
					body: JSON.stringify({
						action: "set_collection_status",
						collectionId: input.collectionId,
						status: input.status,
					}),
				});

				if (!response.ok) {
					throw new ORPCError("BAD_GATEWAY", {
						message: "OrganizationAgent collection lifecycle update failed",
					});
				}

				return (await response.json()) as {
					ok?: boolean;
					collections?: Array<{
						id: string;
						title: string;
						summary: string;
						status: "active" | "resolved" | "archived";
						noteCount: number;
						lastCaptureAt: number | null;
						updatedAt: number;
					}>;
				};
			}),
	},
	digest: {
		get: protectedProcedure.handler(async ({ context }) => {
			const surfacingAgent = await getNamedAgent(
				context.hono.env.SURFACING_AGENT,
				context.session.user.id,
			);
			const response = await surfacingAgent.fetch("https://surfacing-agent/internal", {
				method: "GET",
			});

			if (!response.ok) {
				throw new ORPCError("BAD_GATEWAY", {
					message: "SurfacingAgent state fetch failed",
				});
			}

			const payload = (await response.json()) as {
				latestDigest: unknown;
				updatedAt: number;
			};

			return {
				digest: (payload.latestDigest as WeeklyDigest | null) ?? null,
				updatedAt: payload.updatedAt,
			};
		}),
		generate: protectedProcedure.handler(async ({ context }) => {
			const surfacingAgent = await getNamedAgent(
				context.hono.env.SURFACING_AGENT,
				context.session.user.id,
			);
			const response = await surfacingAgent.fetch("https://surfacing-agent/internal", {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify({ action: "digest" }),
			});

			if (!response.ok) {
				throw new ORPCError("BAD_GATEWAY", {
					message: "SurfacingAgent digest generation failed",
				});
			}

			return (await response.json()) as {
				digest: {
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
				};
			};
		}),
	},
	history: {
		get: protectedProcedure
			.input(
				z.object({
					noteId: z.uuid(),
				}),
			)
			.handler(async ({ context, input }) => {
				const db = context.hono.env.DB as D1Database;
				await ensureHistorySchema(db);

				const note = await db.prepare(
					"SELECT id, title FROM notes WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL",
				)
					.bind(input.noteId, context.session.user.id)
					.first<{ id: string; title: string }>();

				if (!note) {
					throw new ORPCError("NOT_FOUND", {
						message: "Note not found",
					});
				}

				const history = await listNoteHistory(
					db,
					context.session.user.id,
					input.noteId,
				);

				return {
					note,
					history,
				};
			}),
		revert: protectedProcedure
			.input(
				z.object({
					noteId: z.uuid(),
					versionId: versionIdSchema,
				}),
			)
			.handler(async ({ context, input }) => {
				const db = context.hono.env.DB as D1Database;
				await ensureHistorySchema(db);

				const existingNote = await db.prepare(
					"SELECT id FROM notes WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL",
				)
					.bind(input.noteId, context.session.user.id)
					.first<{ id: string }>();

				if (!existingNote) {
					throw new ORPCError("NOT_FOUND", {
						message: "Note not found",
					});
				}

				const version = await getNoteVersion(
					db,
					context.session.user.id,
					input.noteId,
					input.versionId,
				);

				if (!version) {
					throw new ORPCError("NOT_FOUND", {
						message: "Version not found",
					});
				}

				const now = Date.now();
				const title = sanitizeTitleForStorage(version.title);
				const summary =
					version.summary.trim().length > 0 ? version.summary : summarizeContent(version.content);

				await db.prepare(
					"UPDATE notes SET title = ?1, content = ?2, summary = ?3, tags = ?4, updated_at = ?5, processed_at = NULL WHERE id = ?6 AND user_id = ?7 AND deleted_at IS NULL",
				)
					.bind(
						title,
						version.content,
						summary,
						JSON.stringify(version.tags),
						now,
						input.noteId,
						context.session.user.id,
					)
					.run();

				const newVersionId = await createNoteVersion(db, {
					noteId: input.noteId,
					userId: context.session.user.id,
					title,
					content: version.content,
					summary,
					tags: version.tags,
					createdAt: now,
				});

				await createNoteHistoryEvent(db, {
					noteId: input.noteId,
					userId: context.session.user.id,
					routeKind: "revert",
					prompt: "Manual revert from history view.",
					actionSummary: `Reverted to snapshot ${version.id}.`,
					versionId: newVersionId,
					createdAt: now,
				});

				try {
					const indexAgent = await getNamedAgent(
						context.hono.env.INDEX_AGENT,
						context.session.user.id,
					);
					await indexAgent.fetch("https://index-agent/internal", {
						method: "POST",
						headers: {
							"content-type": "application/json",
						},
						body: JSON.stringify({
							action: "upsert",
							note: {
								id: input.noteId,
								title,
								summary,
								tags: version.tags,
								updatedAt: now,
							},
						}),
					});
				} catch (error) {
					console.error("Failed to notify index agent for revert", error);
				}

				await triggerOrganizationRefresh(context, [input.noteId]);

				return {
					note: {
						id: input.noteId,
						title,
						content: version.content,
						summary,
						tags: version.tags,
						updatedAt: now,
					},
					revertedFromVersionId: version.id,
					revertedToVersionId: newVersionId,
				};
			}),
	},
	contradictions: {
		list: protectedProcedure.handler(async ({ context }) => {
			const db = context.hono.env.DB as D1Database;
			const rows = await db.prepare(
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
				.bind(context.session.user.id)
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

			return {
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
			};
		}),
		analyze: protectedProcedure
			.input(
				z.object({
					contradictionId: contradictionIdSchema,
				}),
			)
			.handler(async ({ context, input }) => {
				const db = context.hono.env.DB as D1Database;
				const contradiction = await db.prepare(
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
					.bind(input.contradictionId, context.session.user.id)
					.first<{
						id: string;
						fact_a_id: string;
						fact_a_text: string;
						fact_b_id: string;
						fact_b_text: string;
					}>();

				if (!contradiction) {
					throw new ORPCError("NOT_FOUND", {
						message: "Open contradiction not found",
					});
				}

				const organizationAgent = await getNamedAgent(
					context.hono.env.ORGANIZATION_AGENT,
					context.session.user.id,
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
					throw new ORPCError("BAD_GATEWAY", {
						message: "Contradiction workflow trigger failed",
					});
				}

				const payload = (await response.json()) as { workflow?: string | null };
				return {
					ok: true as const,
					workflowId: payload.workflow ?? null,
					contradictionId: input.contradictionId,
				};
			}),
		resolve: protectedProcedure
			.input(
				z.object({
					workflowId: z.string().trim().min(1),
					keep: z.enum(["factA", "factB"]),
					reason: z.string().trim().max(500).optional(),
				}),
			)
			.handler(async ({ context, input }) => {
				const organizationAgent = await getNamedAgent(
					context.hono.env.ORGANIZATION_AGENT,
					context.session.user.id,
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
					throw new ORPCError("BAD_GATEWAY", {
						message: "Contradiction resolution failed",
					});
				}

				return { ok: true as const };
			}),
	},
};
