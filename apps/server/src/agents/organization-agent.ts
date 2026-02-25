import { Agent, callable } from "agents";

import {
	isRetryableHttpStatus,
	RetryableAgentError,
	type OrganizationAgentState,
	type RoutingDecision,
	shouldRetryTransientError,
} from "./shared";

interface OrganizeParams {
	noteIds?: string[];
}

interface FanOutParams {
	targetNoteIds: string[];
	input: string;
}

interface RunContradictionParams {
	factA: {
		id: string;
		text: string;
	};
	factB: {
		id: string;
		text: string;
	};
}

interface ContradictionResolution {
	workflowId: string;
	keep: "factA" | "factB";
	reason?: string;
}

interface RoutingContextPayload {
	noteId: string;
	routing: RoutingDecision;
}

const COLLECTION_STATUSES = ["active", "resolved", "archived"] as const;

type CollectionStatus = (typeof COLLECTION_STATUSES)[number];

const ORGANIZATION_AGENT_NAME = "OrganizationAgent";
const HEARTBEAT_CRON = "0 */6 * * *";
const HEARTBEAT_RETRY = {
	maxAttempts: 4,
	baseDelayMs: 250,
	maxDelayMs: 4000,
} as const;
const INDEX_SYNC_RETRY = {
	maxAttempts: 3,
	baseDelayMs: 250,
	maxDelayMs: 3000,
} as const;
const WORKFLOW_START_RETRY = {
	maxAttempts: 3,
	baseDelayMs: 200,
	maxDelayMs: 2500,
} as const;

interface CollectionRow {
	id: string;
	title: string;
	summary: string;
	status: string;
	updated_at: number;
	last_capture_at: number | null;
	note_count: number;
}

interface CollectionListItem {
	id: string;
	title: string;
	summary: string;
	status: CollectionStatus;
	noteCount: number;
	lastCaptureAt: number | null;
	updatedAt: number;
}

interface CollectionLifecyclePayload {
	action:
		| "set_collection_status"
		| "rename_collection"
		| "refresh_collections"
		| "run_organize"
		| "run_fanout"
		| "run_contradiction"
		| "resolve_contradiction";
	collectionId?: string;
	status?: CollectionStatus;
	title?: string;
	noteIds?: string[];
	targetNoteIds?: string[];
	input?: string;
	factA?: {
		id: string;
		text: string;
	};
	factB?: {
		id: string;
		text: string;
	};
	workflowId?: string;
	keep?: "factA" | "factB";
	reason?: string;
}

export class OrganizationAgent extends Agent<Env, OrganizationAgentState> {
	static options = {
		retry: {
			maxAttempts: 4,
			baseDelayMs: 200,
			maxDelayMs: 3500,
		},
	};

	initialState: OrganizationAgentState = {
		collections: [],
		actionItems: [],
		contradictions: [],
		lastRunAt: null,
		updatedAt: Date.now(),
	};

	async onStart() {
		const hasHeartbeatSchedule = this.getSchedules({ type: "cron" }).some(
			(schedule) => "cron" in schedule && schedule.cron === HEARTBEAT_CRON,
		);

		if (!hasHeartbeatSchedule) {
			await this.schedule(HEARTBEAT_CRON, "heartbeat", undefined, {
				retry: HEARTBEAT_RETRY,
			});
		}

		try {
			await this.refreshCollectionsState(false);
		} catch (error) {
			console.error("Failed to hydrate collections on start", error);
		}
	}

	private shouldRetryTransient(
		error: unknown,
		nextAttempt: number,
		context: {
			routeKind: string;
			maxAttempts: number;
			workflowId?: string;
			noteId?: string;
		},
	): boolean {
		const retryable = shouldRetryTransientError(error);
		if (!retryable) {
			return false;
		}

		console.warn("agent.retry", {
			agentName: ORGANIZATION_AGENT_NAME,
			workflowId: context.workflowId,
			routeKind: context.routeKind,
			noteId: context.noteId,
			attempt: Math.max(1, nextAttempt - 1),
			nextAttempt,
			maxAttempts: context.maxAttempts,
			error,
		});

		return true;
	}

	private logRetryExhausted(context: {
		routeKind: string;
		maxAttempts: number;
		workflowId?: string | null;
		noteId?: string | null;
		error: unknown;
	}): void {
		console.error("agent.retry.exhausted", {
			agentName: ORGANIZATION_AGENT_NAME,
			workflowId: context.workflowId ?? null,
			routeKind: context.routeKind,
			noteId: context.noteId ?? null,
			maxAttempts: context.maxAttempts,
			error: context.error,
		});
	}

	private normalizeStatus(status: string): CollectionStatus {
		if (status === "resolved" || status === "archived") {
			return status;
		}

		return "active";
	}

	private normalizeNoteIds(noteIds: string[] = []): string[] {
		return Array.from(new Set(noteIds.map((noteId) => noteId.trim()).filter(Boolean)));
	}

	private async fetchCollectionsFromDb(): Promise<CollectionListItem[]> {
		const rows = await this.env.DB.prepare(
			`SELECT c.id,
					c.title,
					c.summary,
					c.status,
					c.updated_at,
					c.last_capture_at,
					COUNT(cn.note_id) AS note_count
			 FROM collections c
			 LEFT JOIN collection_notes cn ON cn.collection_id = c.id
			 WHERE c.user_id = ?1 AND c.deleted_at IS NULL
			 GROUP BY c.id
			 ORDER BY c.updated_at DESC
			 LIMIT 200`,
		)
			.bind(this.name)
			.all<CollectionRow>();

		return (rows.results ?? []).map((row) => ({
			id: row.id,
			title: row.title,
			summary: row.summary,
			status: this.normalizeStatus(row.status),
			noteCount: Number(row.note_count ?? 0),
			lastCaptureAt: row.last_capture_at ?? null,
			updatedAt: row.updated_at,
		}));
	}

	private async syncCollectionsToIndex(
		collections: Array<{
			id: string;
			title: string;
			summary: string;
			status: CollectionStatus;
			updatedAt: number;
		}>,
	): Promise<void> {
		const namespace = this.env.INDEX_AGENT as DurableObjectNamespace;
		const indexAgentId = namespace.idFromName(this.name);
		const indexAgent = namespace.get(indexAgentId);
		const maxAttempts = INDEX_SYNC_RETRY.maxAttempts;
		try {
			await this.retry(
				async () => {
					const response = await indexAgent.fetch("https://index-agent/internal", {
						method: "POST",
						headers: {
							"content-type": "application/json",
						},
						body: JSON.stringify({
							action: "collections",
							collections,
						}),
					});

					if (!response.ok) {
						const message = `Index collections sync failed (${response.status})`;
						if (isRetryableHttpStatus(response.status)) {
							throw new RetryableAgentError(message, { status: response.status });
						}

						throw new Error(message);
					}
				},
				{
					maxAttempts,
					baseDelayMs: INDEX_SYNC_RETRY.baseDelayMs,
					maxDelayMs: INDEX_SYNC_RETRY.maxDelayMs,
					shouldRetry: (error, nextAttempt) =>
						this.shouldRetryTransient(error, nextAttempt, {
							routeKind: "collections_sync",
							maxAttempts,
						}),
				},
			);
		} catch (error) {
			this.logRetryExhausted({
				routeKind: "collections_sync",
				maxAttempts,
				noteId: null,
				error,
			});
			throw error;
		}
	}

	private async refreshCollectionsState(notifyIndex: boolean): Promise<CollectionListItem[]> {
		const collections = await this.fetchCollectionsFromDb();

		this.setState({
			...this.state,
			collections: collections.map((collection) => ({
				id: collection.id,
				title: collection.title,
				summary: collection.summary,
				status: collection.status,
				updatedAt: collection.updatedAt,
			})),
			updatedAt: Date.now(),
		});

		if (notifyIndex) {
			await this.syncCollectionsToIndex(
				collections.map((collection) => ({
					id: collection.id,
					title: collection.title,
					summary: collection.summary,
					status: collection.status,
					updatedAt: collection.updatedAt,
				})),
			);
		}

		return collections;
	}

	async heartbeat() {
		const pending = await this.env.DB.prepare(
			"SELECT id FROM notes WHERE user_id = ?1 AND deleted_at IS NULL AND processed_at IS NULL ORDER BY updated_at DESC LIMIT 50",
		)
			.bind(this.name)
			.all<{ id: string }>();

		if (!pending.results?.length) {
			return;
		}

		const workflowId = await this.runWorkflow("ORGANIZE_WORKFLOW", {
			userId: this.name,
			noteIds: pending.results.map((row) => row.id),
		});

		console.info("agent.schedule.execution", {
			agentName: ORGANIZATION_AGENT_NAME,
			workflowId,
			routeKind: "heartbeat",
			noteId: null,
			queuedCount: pending.results.length,
		});
	}

	@callable()
	async runOrganizeWorkflow(params: OrganizeParams = {}) {
		const maxAttempts = WORKFLOW_START_RETRY.maxAttempts;
		let noteIds = this.normalizeNoteIds(params.noteIds ?? []);

		if (noteIds.length === 0) {
			const pending = await this.env.DB.prepare(
				"SELECT id FROM notes WHERE user_id = ?1 AND deleted_at IS NULL AND processed_at IS NULL ORDER BY updated_at DESC LIMIT 50",
			)
				.bind(this.name)
				.all<{ id: string }>();
			noteIds = this.normalizeNoteIds((pending.results ?? []).map((row) => row.id));
		}

		if (noteIds.length === 0) {
			return null;
		}

		try {
			return await this.retry(
				async () =>
					this.runWorkflow("ORGANIZE_WORKFLOW", {
						userId: this.name,
						noteIds,
					}),
				{
					maxAttempts,
					baseDelayMs: WORKFLOW_START_RETRY.baseDelayMs,
					maxDelayMs: WORKFLOW_START_RETRY.maxDelayMs,
					shouldRetry: (error, nextAttempt) =>
						this.shouldRetryTransient(error, nextAttempt, {
							routeKind: "run_organize",
							maxAttempts,
							noteId: noteIds[0],
						}),
				},
			);
		} catch (error) {
			this.logRetryExhausted({
				routeKind: "run_organize",
				maxAttempts,
				workflowId: null,
				noteId: noteIds[0] ?? null,
				error,
			});
			throw error;
		}
	}

	@callable()
	async runFanOutWorkflow(params: FanOutParams) {
		const maxAttempts = WORKFLOW_START_RETRY.maxAttempts;
		const targetNoteIds = this.normalizeNoteIds(params.targetNoteIds ?? []);
		const input = params.input.trim();
		if (!targetNoteIds.length || !input) {
			return null;
		}

		try {
			return await this.retry(
				async () =>
					this.runWorkflow("FANOUT_WORKFLOW", {
						userId: this.name,
						targetNoteIds,
						input,
					}),
				{
					maxAttempts,
					baseDelayMs: WORKFLOW_START_RETRY.baseDelayMs,
					maxDelayMs: WORKFLOW_START_RETRY.maxDelayMs,
					shouldRetry: (error, nextAttempt) =>
						this.shouldRetryTransient(error, nextAttempt, {
							routeKind: "run_fanout",
							maxAttempts,
							noteId: targetNoteIds[0],
						}),
				},
			);
		} catch (error) {
			this.logRetryExhausted({
				routeKind: "run_fanout",
				maxAttempts,
				workflowId: null,
				noteId: targetNoteIds[0] ?? null,
				error,
			});
			throw error;
		}
	}

	@callable()
	async runContradictionWorkflow(params: RunContradictionParams) {
		const maxAttempts = WORKFLOW_START_RETRY.maxAttempts;

		try {
			return await this.retry(
				async () =>
					this.runWorkflow("CONTRADICTION_WORKFLOW", {
						factA: params.factA,
						factB: params.factB,
					}),
				{
					maxAttempts,
					baseDelayMs: WORKFLOW_START_RETRY.baseDelayMs,
					maxDelayMs: WORKFLOW_START_RETRY.maxDelayMs,
					shouldRetry: (error, nextAttempt) =>
						this.shouldRetryTransient(error, nextAttempt, {
							routeKind: "run_contradiction",
							maxAttempts,
							noteId: params.factA.id,
						}),
				},
			);
		} catch (error) {
			this.logRetryExhausted({
				routeKind: "run_contradiction",
				maxAttempts,
				workflowId: null,
				noteId: params.factA.id,
				error,
			});
			throw error;
		}
	}

	@callable()
	async listCollections(): Promise<CollectionListItem[]> {
		return this.refreshCollectionsState(false);
	}

	@callable()
	async setCollectionStatus(collectionId: string, status: CollectionStatus) {
		if (!collectionId) {
			throw new Error("collectionId is required");
		}

		if (!COLLECTION_STATUSES.includes(status)) {
			throw new Error("Invalid collection status");
		}

		const now = Date.now();
		await this.env.DB.prepare(
			"UPDATE collections SET status = ?1, updated_at = ?2 WHERE id = ?3 AND user_id = ?4 AND deleted_at IS NULL",
		)
			.bind(status, now, collectionId, this.name)
			.run();

		const collections = await this.refreshCollectionsState(true);
		return { ok: true, collections };
	}

	@callable()
	async renameCollection(collectionId: string, title: string) {
		const trimmedTitle = title.trim();
		if (!collectionId) {
			throw new Error("collectionId is required");
		}

		if (!trimmedTitle) {
			throw new Error("title is required");
		}

		const now = Date.now();
		await this.env.DB.prepare(
			"UPDATE collections SET title = ?1, updated_at = ?2 WHERE id = ?3 AND user_id = ?4 AND deleted_at IS NULL",
		)
			.bind(trimmedTitle.slice(0, 120), now, collectionId, this.name)
			.run();

		const collections = await this.refreshCollectionsState(true);
		return { ok: true, collections };
	}

	@callable()
	async resolveContradiction(resolution: ContradictionResolution) {
		await this.approveWorkflow(resolution.workflowId, {
			reason: resolution.reason,
			metadata: {
				keep: resolution.keep,
			},
		});
	}

	async onWorkflowProgress(workflowName: string, workflowId: string, progress: unknown) {
		console.info("agent.workflow.progress", {
			agentName: ORGANIZATION_AGENT_NAME,
			workflowId,
			routeKind: workflowName,
			noteId: null,
		});

		this.setState({
			...this.state,
			updatedAt: Date.now(),
		});

		// State updates already broadcast; send lightweight event for UI listeners.
		this.broadcast(
			JSON.stringify({
				type: "organization-progress",
				workflowName,
				workflowId,
				progress,
			}),
		);
	}

	async onWorkflowComplete(workflowName: string, workflowId: string, result?: unknown) {
		console.info("agent.workflow.complete", {
			agentName: ORGANIZATION_AGENT_NAME,
			workflowId,
			routeKind: workflowName,
			noteId: null,
		});

		this.setState({
			...this.state,
			lastRunAt: Date.now(),
			updatedAt: Date.now(),
		});

		this.broadcast(
			JSON.stringify({
				type: "organization-complete",
				workflowName,
				workflowId,
				result,
			}),
		);
	}

	async onWorkflowError(workflowName: string, workflowId: string, error: unknown) {
		console.error("agent.workflow.error", {
			agentName: ORGANIZATION_AGENT_NAME,
			workflowId,
			routeKind: workflowName,
			noteId: null,
			error,
		});
	}

	@callable()
	async collectRoutingContext(payload: RoutingContextPayload) {
		this.broadcast(
			JSON.stringify({
				type: "routing-context",
				noteId: payload.noteId,
				routing: payload.routing,
			}),
		);
	}

	async onRequest(request: Request): Promise<Response> {
		if (request.method === "GET") {
			const collections = await this.listCollections();
			return Response.json({ collections });
		}

		if (request.method !== "POST") {
			return Response.json({ error: "Method not allowed" }, { status: 405 });
		}

		const payload = (await request.json()) as CollectionLifecyclePayload;
		if (payload.action === "set_collection_status") {
			if (!payload.collectionId || !payload.status) {
				return Response.json({ error: "collectionId and status are required" }, { status: 400 });
			}

			const result = await this.setCollectionStatus(payload.collectionId, payload.status);
			return Response.json(result);
		}

		if (payload.action === "rename_collection") {
			if (!payload.collectionId || !payload.title) {
				return Response.json({ error: "collectionId and title are required" }, { status: 400 });
			}

			const result = await this.renameCollection(payload.collectionId, payload.title);
			return Response.json(result);
		}

		if (payload.action === "refresh_collections") {
			const collections = await this.refreshCollectionsState(true);
			return Response.json({ ok: true, collections });
		}

		if (payload.action === "run_organize") {
			const workflow = await this.runOrganizeWorkflow({
				noteIds: payload.noteIds ?? [],
			});
			return Response.json({ ok: true, workflow });
		}

		if (payload.action === "run_fanout") {
			if (!payload.input) {
				return Response.json({ error: "input is required" }, { status: 400 });
			}

			const workflow = await this.runFanOutWorkflow({
				targetNoteIds: payload.targetNoteIds ?? [],
				input: payload.input,
			});
			return Response.json({ ok: true, workflow });
		}

		if (payload.action === "run_contradiction") {
			if (!payload.factA || !payload.factB) {
				return Response.json({ error: "factA and factB are required" }, { status: 400 });
			}

			const workflow = await this.runContradictionWorkflow({
				factA: payload.factA,
				factB: payload.factB,
			});
			return Response.json({ ok: true, workflow });
		}

		if (payload.action === "resolve_contradiction") {
			if (!payload.workflowId || !payload.keep) {
				return Response.json({ error: "workflowId and keep are required" }, { status: 400 });
			}

			await this.resolveContradiction({
				workflowId: payload.workflowId,
				keep: payload.keep,
				reason: payload.reason,
			});
			return Response.json({ ok: true });
		}

		return Response.json({ error: "Invalid action" }, { status: 400 });
	}
}
