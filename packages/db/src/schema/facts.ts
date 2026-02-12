import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { entities } from "./entities";
import { notes } from "./notes";
import { user } from "./auth";

export const facts = sqliteTable(
	"facts",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		entityId: text("entity_id").references(() => entities.id, { onDelete: "set null" }),
		fact: text("fact").notNull(),
		category: text("category").notNull().default("general"),
		status: text("status").notNull().default("active"),
		confidence: integer("confidence").notNull().default(0),
		sourceNoteId: text("source_note_id").references(() => notes.id, { onDelete: "set null" }),
		observedAt: integer("observed_at", { mode: "timestamp_ms" }),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("facts_userId_idx").on(table.userId),
		index("facts_entityId_idx").on(table.entityId),
		index("facts_sourceNoteId_idx").on(table.sourceNoteId),
	],
);

export const factContradictions = sqliteTable(
	"fact_contradictions",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		factAId: text("fact_a_id")
			.notNull()
			.references(() => facts.id, { onDelete: "cascade" }),
		factBId: text("fact_b_id")
			.notNull()
			.references(() => facts.id, { onDelete: "cascade" }),
		status: text("status").notNull().default("open"),
		resolutionNoteId: text("resolution_note_id").references(() => notes.id, {
			onDelete: "set null",
		}),
		resolutionReason: text("resolution_reason"),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("fact_contradictions_userId_idx").on(table.userId),
		index("fact_contradictions_factAId_idx").on(table.factAId),
		index("fact_contradictions_factBId_idx").on(table.factBId),
	],
);

export const factsRelations = relations(facts, ({ one, many }) => ({
	entity: one(entities, {
		fields: [facts.entityId],
		references: [entities.id],
	}),
	sourceNote: one(notes, {
		fields: [facts.sourceNoteId],
		references: [notes.id],
	}),
	contradictionsA: many(factContradictions, {
		relationName: "factA",
	}),
	contradictionsB: many(factContradictions, {
		relationName: "factB",
	}),
}));

export const factContradictionsRelations = relations(factContradictions, ({ one }) => ({
	factA: one(facts, {
		fields: [factContradictions.factAId],
		references: [facts.id],
		relationName: "factA",
	}),
	factB: one(facts, {
		fields: [factContradictions.factBId],
		references: [facts.id],
		relationName: "factB",
	}),
	resolutionNote: one(notes, {
		fields: [factContradictions.resolutionNoteId],
		references: [notes.id],
	}),
}));
