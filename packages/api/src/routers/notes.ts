import { protectedProcedure } from "../index";

function parseTags(raw: string): string[] {
	try {
		const parsed = JSON.parse(raw) as unknown;
		return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string") : [];
	} catch {
		return [];
	}
}

export const notesRouter = {
	list: protectedProcedure.handler(async ({ context }) => {
		const db = context.hono.env.DB as D1Database;
		const result = await db.prepare(
			"SELECT id, title, content, summary, tags, updated_at FROM notes WHERE user_id = ?1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 200",
		)
			.bind(context.session.user.id)
			.all<{
				id: string;
				title: string;
				content: string;
				summary: string;
				tags: string;
				updated_at: number;
			}>();

		return {
			notes: (result.results ?? []).map((row) => ({
				id: row.id,
				title: row.title,
				content: row.content,
				summary: row.summary,
				tags: parseTags(row.tags),
				updatedAt: row.updated_at,
			})),
		};
	}),
};
