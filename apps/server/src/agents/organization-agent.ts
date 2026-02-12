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
}
