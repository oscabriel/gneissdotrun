import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

import { notes } from "./notes";

export const noteLinks = sqliteTable(
	"note_links",
	{
		id: text("id").primaryKey(),
		fromNoteId: text("from_note_id")
			.notNull()
			.references(() => notes.id, { onDelete: "cascade" }),
		toNoteId: text("to_note_id")
			.notNull()
			.references(() => notes.id, { onDelete: "cascade" }),
		linkType: text("link_type").notNull().default("related"),
		confidence: integer("confidence").notNull().default(0),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		index("note_links_fromNoteId_idx").on(table.fromNoteId),
		index("note_links_toNoteId_idx").on(table.toNoteId),
	],
);

export const noteLinksRelations = relations(noteLinks, ({ one }) => ({
	fromNote: one(notes, {
		fields: [noteLinks.fromNoteId],
		references: [notes.id],
	}),
	toNote: one(notes, {
		fields: [noteLinks.toNoteId],
		references: [notes.id],
	}),
}));
