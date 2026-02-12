import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { notes } from "./notes";
import { user } from "./auth";

export const noteExtractions = sqliteTable(
	"note_extractions",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		noteId: text("note_id")
			.notNull()
			.references(() => notes.id, { onDelete: "cascade" }),
		kind: text("kind").notNull(),
		payload: text("payload", { mode: "json" })
			.$type<Record<string, unknown>>()
			.notNull()
			.default(sql`(json_object())`),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		index("note_extractions_userId_idx").on(table.userId),
		index("note_extractions_noteId_idx").on(table.noteId),
		index("note_extractions_kind_idx").on(table.kind),
	],
);

export const noteExtractionsRelations = relations(noteExtractions, ({ one }) => ({
	note: one(notes, {
		fields: [noteExtractions.noteId],
		references: [notes.id],
	}),
	user: one(user, {
		fields: [noteExtractions.userId],
		references: [user.id],
	}),
}));
