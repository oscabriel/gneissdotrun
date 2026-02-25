import { Agent } from "agents";
import { AgentWorkflow, type AgentWorkflowEvent, type AgentWorkflowStep } from "agents/workflows";

interface FanOutParams {
	userId: string;
	targetNoteIds: string[];
	input: string;
}

interface FanOutExecutionInput {
	userId: string;
	targetNoteIds: string[];
	input: string;
	now?: number;
}

interface FanOutEnv {
	DB: D1Database;
}

function compactSummary(content: string): string {
	return content.replace(/\s+/g, " ").trim().slice(0, 240);
}

export async function runFanOutPass(
	env: FanOutEnv,
	params: FanOutExecutionInput,
): Promise<{ updated: number }> {
	const { userId, targetNoteIds, input } = params;

	if (!userId) {
		throw new Error("userId is required");
	}

	if (!targetNoteIds.length) {
		return { updated: 0 };
	}

	const now = params.now ?? Date.now();
	let updated = 0;

	for (const noteId of targetNoteIds) {
		const existing = await env.DB.prepare(
			"SELECT content FROM notes WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL",
		)
			.bind(noteId, userId)
			.first<{ content: string }>();

		if (!existing) {
			continue;
		}

		const merged = [existing.content.trim(), input.trim()].filter(Boolean).join("\n\n").trim();
		await env.DB.prepare(
			"UPDATE notes SET content = ?1, summary = ?2, updated_at = ?3, processed_at = NULL WHERE id = ?4 AND user_id = ?5 AND deleted_at IS NULL",
		)
			.bind(merged, compactSummary(merged), now, noteId, userId)
			.run();

		updated += 1;
	}

	return { updated };
}

export function queueFanOutInBackground(env: FanOutEnv, params: FanOutExecutionInput): void {
	void runFanOutPass(env, params).catch((error) => {
		console.error("Fan-out background pass failed", error);
	});
}

export class FanOutWorkflow extends AgentWorkflow<Agent, FanOutParams, unknown, FanOutEnv> {
	async run(event: AgentWorkflowEvent<FanOutParams>, step: AgentWorkflowStep) {
		const { userId, targetNoteIds, input } = event.payload;
		if (!targetNoteIds.length) {
			await step.reportComplete({ updated: 0 });
			return;
		}

		const result = await step.do("fanout-pass", async () =>
			runFanOutPass(this.env, {
				userId,
				targetNoteIds,
				input,
			}),
		);

		await step.reportComplete(result);
	}
}
