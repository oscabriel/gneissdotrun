import { Agent } from "agents";
import { AgentWorkflow, type AgentWorkflowEvent, type AgentWorkflowStep } from "agents/workflows";

interface FanOutParams {
	userId: string;
	targetNoteIds: string[];
	input: string;
}

interface FanOutEnv {
	DB: D1Database;
}

function compactSummary(content: string): string {
	return content.replace(/\s+/g, " ").trim().slice(0, 240);
}

export class FanOutWorkflow extends AgentWorkflow<Agent, FanOutParams, unknown, FanOutEnv> {
	async run(event: AgentWorkflowEvent<FanOutParams>, step: AgentWorkflowStep) {
		const { userId, targetNoteIds, input } = event.payload;

		if (!userId) {
			throw new Error("userId is required");
		}

		if (!targetNoteIds.length) {
			await step.reportComplete({ updated: 0 });
			return;
		}

		const now = Date.now();
		let updated = 0;

		for (const noteId of targetNoteIds) {
			await step.do(`update-${noteId}`, async () => {
				const existing = await this.env.DB.prepare(
					"SELECT content FROM notes WHERE id = ?1 AND user_id = ?2 AND deleted_at IS NULL",
				)
					.bind(noteId, userId)
					.first<{ content: string }>();

				if (!existing) {
					return;
				}

				const merged = [existing.content.trim(), input.trim()].filter(Boolean).join("\n\n").trim();
				await this.env.DB.prepare(
					"UPDATE notes SET content = ?1, summary = ?2, updated_at = ?3 WHERE id = ?4 AND user_id = ?5 AND deleted_at IS NULL",
				)
					.bind(merged, compactSummary(merged), now, noteId, userId)
					.run();

				updated += 1;
			});
		}

		await step.reportComplete({ updated });
	}
}
