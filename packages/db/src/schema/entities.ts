import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { notes } from "./notes";
import { user } from "./auth";

export const entities = sqliteTable(
	"entities",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		type: text("type").notNull(),
		summary: text("summary").notNull().default(""),
		mentionCount: integer("mention_count").notNull().default(0),
		firstMentionedAt: integer("first_mentioned_at", { mode: "timestamp_ms" }),
		lastMentionedAt: integer("last_mentioned_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("entities_userId_idx").on(table.userId),
		index("entities_name_idx").on(table.name),
	],
);

export const entityMentions = sqliteTable(
	"entity_mentions",
	{
		id: text("id").primaryKey(),
		entityId: text("entity_id")
			.notNull()
			.references(() => entities.id, { onDelete: "cascade" }),
		noteId: text("note_id")
			.notNull()
			.references(() => notes.id, { onDelete: "cascade" }),
		context: text("context").notNull().default(""),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		index("entity_mentions_entityId_idx").on(table.entityId),
		index("entity_mentions_noteId_idx").on(table.noteId),
	],
);

export const entitiesRelations = relations(entities, ({ many }) => ({
	mentions: many(entityMentions),
}));

export const entityMentionsRelations = relations(entityMentions, ({ one }) => ({
	entity: one(entities, {
		fields: [entityMentions.entityId],
		references: [entities.id],
	}),
	note: one(notes, {
		fields: [entityMentions.noteId],
		references: [notes.id],
	}),
}));
