import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { user } from "./auth";

export const notes = sqliteTable(
	"notes",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		title: text("title").notNull().default("Untitled note"),
		content: text("content").notNull().default(""),
		summary: text("summary").notNull().default(""),
		tags: text("tags", { mode: "json" })
			.$type<string[]>()
			.notNull()
			.default(sql`(json_array())`),
		sourceMessageId: text("source_message_id"),
		dedupeKey: text("dedupe_key"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
		deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
	},
	(table) => [
		index("notes_userId_idx").on(table.userId),
		index("notes_updatedAt_idx").on(table.updatedAt),
		uniqueIndex("notes_dedupeKey_idx").on(table.dedupeKey),
	],
);

export const noteUploads = sqliteTable(
	"note_uploads",
	{
		id: text("id").primaryKey(),
		noteId: text("note_id").references(() => notes.id, { onDelete: "set null" }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		objectKey: text("object_key").notNull().unique(),
		bucket: text("bucket").notNull().default("files"),
		filename: text("filename").notNull(),
		contentType: text("content_type").notNull(),
		sizeBytes: integer("size_bytes").notNull(),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		index("note_uploads_userId_idx").on(table.userId),
		index("note_uploads_noteId_idx").on(table.noteId),
		index("note_uploads_createdAt_idx").on(table.createdAt),
	],
);

export const notesRelations = relations(notes, ({ many }) => ({
	uploads: many(noteUploads),
}));

export const noteUploadsRelations = relations(noteUploads, ({ one }) => ({
	note: one(notes, {
		fields: [noteUploads.noteId],
		references: [notes.id],
	}),
	user: one(user, {
		fields: [noteUploads.userId],
		references: [user.id],
	}),
}));
