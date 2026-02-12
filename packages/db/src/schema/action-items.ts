import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { notes } from "./notes";
import { user } from "./auth";

export const actionItems = sqliteTable(
	"action_items",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		noteId: text("note_id").references(() => notes.id, { onDelete: "set null" }),
		description: text("description").notNull(),
		status: text("status").notNull().default("pending"),
		deadline: integer("deadline", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("action_items_userId_idx").on(table.userId),
		index("action_items_noteId_idx").on(table.noteId),
	],
);

export const actionItemsRelations = relations(actionItems, ({ one }) => ({
	note: one(notes, {
		fields: [actionItems.noteId],
		references: [notes.id],
	}),
	user: one(user, {
		fields: [actionItems.userId],
		references: [user.id],
	}),
}));
