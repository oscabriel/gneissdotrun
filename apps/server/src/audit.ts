interface AuditLogInput {
	id?: string;
	userId: string;
	noteId?: string;
	eventType: string;
	routeKind?: string;
	mutationKind?: string;
	success?: boolean;
	errorCode?: string;
	payload?: Record<string, unknown>;
	createdAt?: number;
}

const auditSchemaReadyDatabases = new WeakSet<D1Database>();

export async function ensureAuditSchema(db: D1Database): Promise<void> {
	if (auditSchemaReadyDatabases.has(db)) {
		return;
	}

	await db
		.prepare(
			"CREATE TABLE IF NOT EXISTS audit_logs (id text PRIMARY KEY NOT NULL, user_id text NOT NULL, note_id text, event_type text NOT NULL, route_kind text, mutation_kind text, success integer NOT NULL DEFAULT 1, error_code text, payload text NOT NULL DEFAULT (json_object()), created_at integer NOT NULL, FOREIGN KEY (user_id) REFERENCES user(id) ON UPDATE no action ON DELETE cascade, FOREIGN KEY (note_id) REFERENCES notes(id) ON UPDATE no action ON DELETE set null)",
		)
		.run();

	await db
		.prepare("CREATE INDEX IF NOT EXISTS audit_logs_userId_idx ON audit_logs (user_id)")
		.run();
	await db
		.prepare("CREATE INDEX IF NOT EXISTS audit_logs_noteId_idx ON audit_logs (note_id)")
		.run();
	await db
		.prepare("CREATE INDEX IF NOT EXISTS audit_logs_eventType_idx ON audit_logs (event_type)")
		.run();
	await db
		.prepare("CREATE INDEX IF NOT EXISTS audit_logs_createdAt_idx ON audit_logs (created_at)")
		.run();

	auditSchemaReadyDatabases.add(db);
}

export async function createAuditLog(db: D1Database, input: AuditLogInput): Promise<string> {
	await ensureAuditSchema(db);

	const auditLogId = input.id ?? `audit_${crypto.randomUUID()}`;
	const createdAt = input.createdAt ?? Date.now();

	await db
		.prepare(
			"INSERT INTO audit_logs (id, user_id, note_id, event_type, route_kind, mutation_kind, success, error_code, payload, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
		)
		.bind(
			auditLogId,
			input.userId,
			input.noteId ?? null,
			input.eventType,
			input.routeKind ?? null,
			input.mutationKind ?? null,
			input.success === false ? 0 : 1,
			input.errorCode ?? null,
			JSON.stringify(input.payload ?? {}),
			createdAt,
		)
		.run();

	return auditLogId;
}
