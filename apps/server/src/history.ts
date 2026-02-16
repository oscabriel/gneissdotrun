interface NoteVersionSnapshot {
	noteId: string;
	userId: string;
	title: string;
	content: string;
	summary: string;
	tags: string[];
	createdAt?: number;
}

interface NoteHistoryEventInput {
	noteId: string;
	userId: string;
	routeKind: string;
	prompt: string;
	actionSummary: string;
	versionId?: string;
	createdAt?: number;
}

interface NoteHistoryEntryRow {
	id: string;
	route_kind: string;
	prompt: string;
	action_summary: string;
	version_id: string | null;
	created_at: number;
	version_created_at: number | null;
}

interface NoteVersionRow {
	id: string;
	note_id: string;
	title: string;
	content: string;
	summary: string;
	tags: string;
	created_at: number;
}

const historySchemaReadyDatabases = new WeakSet<D1Database>();

export async function ensureHistorySchema(db: D1Database): Promise<void> {
	if (historySchemaReadyDatabases.has(db)) {
		return;
	}

	await db
		.prepare(
			"CREATE TABLE IF NOT EXISTS note_versions (id text PRIMARY KEY NOT NULL, note_id text NOT NULL, user_id text NOT NULL, title text NOT NULL, content text NOT NULL, summary text NOT NULL DEFAULT '', tags text NOT NULL DEFAULT (json_array()), created_at integer NOT NULL, FOREIGN KEY (note_id) REFERENCES notes(id) ON UPDATE no action ON DELETE cascade, FOREIGN KEY (user_id) REFERENCES user(id) ON UPDATE no action ON DELETE cascade)",
		)
		.run();

	await db
		.prepare(
			"CREATE TABLE IF NOT EXISTS note_history_events (id text PRIMARY KEY NOT NULL, note_id text NOT NULL, user_id text NOT NULL, route_kind text NOT NULL, prompt text NOT NULL DEFAULT '', action_summary text NOT NULL, version_id text, created_at integer NOT NULL, FOREIGN KEY (note_id) REFERENCES notes(id) ON UPDATE no action ON DELETE cascade, FOREIGN KEY (user_id) REFERENCES user(id) ON UPDATE no action ON DELETE cascade, FOREIGN KEY (version_id) REFERENCES note_versions(id) ON UPDATE no action ON DELETE set null)",
		)
		.run();

	await db
		.prepare("CREATE INDEX IF NOT EXISTS note_versions_noteId_idx ON note_versions (note_id)")
		.run();
	await db
		.prepare("CREATE INDEX IF NOT EXISTS note_versions_userId_idx ON note_versions (user_id)")
		.run();
	await db
		.prepare("CREATE INDEX IF NOT EXISTS note_versions_createdAt_idx ON note_versions (created_at)")
		.run();
	await db
		.prepare(
			"CREATE INDEX IF NOT EXISTS note_history_events_noteId_idx ON note_history_events (note_id)",
		)
		.run();
	await db
		.prepare(
			"CREATE INDEX IF NOT EXISTS note_history_events_createdAt_idx ON note_history_events (created_at)",
		)
		.run();
	await db
		.prepare(
			"CREATE INDEX IF NOT EXISTS note_history_events_noteId_createdAt_idx ON note_history_events (note_id, created_at)",
		)
		.run();

	historySchemaReadyDatabases.add(db);
}

export async function createNoteVersion(
	db: D1Database,
	snapshot: NoteVersionSnapshot,
): Promise<string> {
	const versionId = `version_${crypto.randomUUID()}`;
	const createdAt = snapshot.createdAt ?? Date.now();

	await db
		.prepare(
			"INSERT INTO note_versions (id, note_id, user_id, title, content, summary, tags, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
		)
		.bind(
			versionId,
			snapshot.noteId,
			snapshot.userId,
			snapshot.title,
			snapshot.content,
			snapshot.summary,
			JSON.stringify(snapshot.tags),
			createdAt,
		)
		.run();

	return versionId;
}

export async function createNoteHistoryEvent(
	db: D1Database,
	input: NoteHistoryEventInput,
): Promise<string> {
	const eventId = `history_${crypto.randomUUID()}`;
	const createdAt = input.createdAt ?? Date.now();

	await db
		.prepare(
			"INSERT INTO note_history_events (id, note_id, user_id, route_kind, prompt, action_summary, version_id, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
		)
		.bind(
			eventId,
			input.noteId,
			input.userId,
			input.routeKind,
			input.prompt,
			input.actionSummary,
			input.versionId ?? null,
			createdAt,
		)
		.run();

	return eventId;
}

export async function listNoteHistory(
	db: D1Database,
	userId: string,
	noteId: string,
	limit = 100,
): Promise<
	Array<{
		id: string;
		routeKind: string;
		prompt: string;
		actionSummary: string;
		versionId: string | null;
		timestamp: number;
		versionCreatedAt: number | null;
	}>
> {
	const rows = await db
		.prepare(
			"SELECT e.id, e.route_kind, e.prompt, e.action_summary, e.version_id, e.created_at, v.created_at AS version_created_at FROM note_history_events e LEFT JOIN note_versions v ON v.id = e.version_id WHERE e.user_id = ?1 AND e.note_id = ?2 ORDER BY e.created_at DESC LIMIT ?3",
		)
		.bind(userId, noteId, limit)
		.all<NoteHistoryEntryRow>();

	return (rows.results ?? []).map((row) => ({
		id: row.id,
		routeKind: row.route_kind,
		prompt: row.prompt,
		actionSummary: row.action_summary,
		versionId: row.version_id,
		timestamp: row.created_at,
		versionCreatedAt: row.version_created_at,
	}));
}

export async function getNoteVersion(
	db: D1Database,
	userId: string,
	noteId: string,
	versionId: string,
): Promise<{
	id: string;
	noteId: string;
	title: string;
	content: string;
	summary: string;
	tags: string[];
	createdAt: number;
} | null> {
	const row = await db
		.prepare(
			"SELECT id, note_id, title, content, summary, tags, created_at FROM note_versions WHERE id = ?1 AND note_id = ?2 AND user_id = ?3",
		)
		.bind(versionId, noteId, userId)
		.first<NoteVersionRow>();

	if (!row) {
		return null;
	}

	let tags: string[] = [];
	try {
		tags = JSON.parse(row.tags) as string[];
	} catch {
		tags = [];
	}

	return {
		id: row.id,
		noteId: row.note_id,
		title: row.title,
		content: row.content,
		summary: row.summary,
		tags,
		createdAt: row.created_at,
	};
}
