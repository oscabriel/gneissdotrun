import { Agent, callable } from "agents";

import type { OrganizationAgentState, RoutingDecision } from "./shared";

interface OrganizeParams {
	noteIds?: string[];
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
	action: "set_collection_status" | "rename_collection" | "refresh_collections" | "run_organize";
	collectionId?: string;
	status?: CollectionStatus;
	title?: string;
	noteIds?: string[];
}

export class OrganizationAgent extends Agent<Env, OrganizationAgentState> {
	initialState: OrganizationAgentState = {
		collections: [],
		actionItems: [],
		contradictions: [],
		lastRunAt: null,
		updatedAt: Date.now(),
	};

	async onStart() {
		this.schedule("0 */6 * * *", "heartbeat");
		try {
			await this.refreshCollectionsState(false);
		} catch (error) {
			console.error("Failed to hydrate collections on start", error);
		}
	}

	private normalizeStatus(status: string): CollectionStatus {
		if (status === "resolved" || status === "archived") {
			return status;
		}

		return "active";
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
		await indexAgent.fetch("https://index-agent/internal", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({
				action: "collections",
				collections,
			}),
		});
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

		await this.runWorkflow("ORGANIZE_WORKFLOW", {
			userId: this.name,
			noteIds: pending.results.map((row) => row.id),
		});
	}

	@callable()
	async runOrganizeWorkflow(params: OrganizeParams = {}) {
		return this.runWorkflow("ORGANIZE_WORKFLOW", {
			userId: this.name,
			noteIds: params.noteIds ?? [],
		});
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
			const noteIds = Array.from(new Set(payload.noteIds ?? [])).filter(
				(noteId) => noteId.length > 0,
			);
			if (noteIds.length === 0) {
				return Response.json({ error: "noteIds are required" }, { status: 400 });
			}

			const workflow = await this.runOrganizeWorkflow({ noteIds });
			return Response.json({ ok: true, workflow });
		}

		return Response.json({ error: "Invalid action" }, { status: 400 });
	}
}
