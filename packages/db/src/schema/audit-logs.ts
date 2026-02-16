import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { user } from "./auth";
import { notes } from "./notes";

export const auditLogs = sqliteTable(
	"audit_logs",
	{
		id: text("id").primaryKey(),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		noteId: text("note_id").references(() => notes.id, { onDelete: "set null" }),
		eventType: text("event_type").notNull(),
		routeKind: text("route_kind"),
		mutationKind: text("mutation_kind"),
		success: integer("success", { mode: "boolean" }).notNull().default(true),
		errorCode: text("error_code"),
		payload: text("payload", { mode: "json" })
			.$type<Record<string, unknown>>()
			.notNull()
			.default(sql`(json_object())`),
		createdAt: integer("created_at", { mode: "timestamp_ms" })
			.default(sql`(cast(unixepoch('subsecond') * 1000 as integer))`)
			.notNull(),
	},
	(table) => [
		index("audit_logs_userId_idx").on(table.userId),
		index("audit_logs_noteId_idx").on(table.noteId),
		index("audit_logs_eventType_idx").on(table.eventType),
		index("audit_logs_createdAt_idx").on(table.createdAt),
	],
);

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
	note: one(notes, {
		fields: [auditLogs.noteId],
		references: [notes.id],
	}),
	user: one(user, {
		fields: [auditLogs.userId],
		references: [user.id],
	}),
}));
