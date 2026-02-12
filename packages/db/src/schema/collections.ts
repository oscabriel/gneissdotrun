import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { notes } from "./notes";
import { user } from "./auth";

export const collections = sqliteTable(
	"collections",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		title: text("title").notNull(),
		summary: text("summary").notNull().default(""),
		status: text("status").notNull().default("active"),
		lastCaptureAt: integer("last_capture_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
	},
	(table) => [index("collections_userId_idx").on(table.userId)],
);

export const collectionNotes = sqliteTable(
	"collection_notes",
	{
		collectionId: text("collection_id")
			.notNull()
			.references(() => collections.id, { onDelete: "cascade" }),
		noteId: text("note_id")
			.notNull()
			.references(() => notes.id, { onDelete: "cascade" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		index("collection_notes_collectionId_idx").on(table.collectionId),
		index("collection_notes_noteId_idx").on(table.noteId),
	],
);

export const collectionsRelations = relations(collections, ({ many }) => ({
	notes: many(collectionNotes),
}));

export const collectionNotesRelations = relations(collectionNotes, ({ one }) => ({
	collection: one(collections, {
		fields: [collectionNotes.collectionId],
		references: [collections.id],
	}),
	note: one(notes, {
		fields: [collectionNotes.noteId],
		references: [notes.id],
	}),
}));
