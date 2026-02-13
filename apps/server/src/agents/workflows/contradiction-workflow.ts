import { Agent } from "agents";
import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import { AgentWorkflow, type AgentWorkflowEvent, type AgentWorkflowStep } from "agents/workflows";
import z from "zod";

interface ContradictionParams {
	factA: {
		id: string;
		text: string;
	};
	factB: {
		id: string;
		text: string;
	};
}

interface ContradictionEnv {
	DB: D1Database;
}

const CONTRADICTION_MODEL = "gemini-2.5-flash";

const contradictionAnalysisSchema = z.object({
	summary: z.string().trim().min(1).max(600),
	conflictType: z
		.enum(["temporal", "numeric", "policy", "semantic", "status_change", "other"])
		.default("other"),
	recommendedKeep: z.enum(["factA", "factB", "either"]).default("either"),
	confidence: z.number().min(0).max(1).default(0.5),
	reasoning: z.string().trim().max(480).default("Potential contradiction requires human review."),
});

type ContradictionAnalysis = z.infer<typeof contradictionAnalysisSchema>;

async function analyzeContradictionWithLlm(
	factA: ContradictionParams["factA"],
	factB: ContradictionParams["factB"],
): Promise<ContradictionAnalysis> {
	const prompt = [
		"You are evaluating two extracted facts for contradiction resolution.",
		"Summarize the conflict, classify it, and recommend which fact seems more reliable.",
		"Do not finalize the decision; a human will approve.",
		`Fact A (${factA.id}): ${factA.text}`,
		`Fact B (${factB.id}): ${factB.text}`,
	].join("\n\n");

	const { output } = await generateText({
		model: google(CONTRADICTION_MODEL),
		output: Output.object({ schema: contradictionAnalysisSchema }),
		prompt,
		temperature: 0,
	});

	return output;
}

function fallbackAnalysis(
	factA: ContradictionParams["factA"],
	factB: ContradictionParams["factB"],
): ContradictionAnalysis {
	return {
		summary: `Potential contradiction between "${factA.text}" and "${factB.text}".`,
		conflictType: "other",
		recommendedKeep: "either",
		confidence: 0.5,
		reasoning: "Needs human confirmation before resolving.",
	};
}

export class ContradictionWorkflow extends AgentWorkflow<
	Agent,
	ContradictionParams,
	unknown,
	ContradictionEnv
> {
	async run(event: AgentWorkflowEvent<ContradictionParams>, step: AgentWorkflowStep) {
		const { factA, factB } = event.payload;

		const analysis = await step.do("analyze", async () => {
			try {
				return await analyzeContradictionWithLlm(factA, factB);
			} catch (error) {
				console.error("ContradictionWorkflow LLM analysis failed", error);
				return fallbackAnalysis(factA, factB);
			}
		});

		await this.reportProgress({
			stage: "analysis",
			summary: analysis.summary,
			conflictType: analysis.conflictType,
			recommendedKeep: analysis.recommendedKeep,
			confidence: analysis.confidence,
			reasoning: analysis.reasoning,
		});

		const resolution = await this.waitForApproval<{
			keep: "factA" | "factB";
			reason?: string;
		}>(step, { timeout: "30 days" });

		await step.do("apply-resolution", async () => {
			const resolvedFactId = resolution.keep === "factA" ? factA.id : factB.id;
			const supersededFactId = resolution.keep === "factA" ? factB.id : factA.id;
			const now = Date.now();

			await this.env.DB.prepare(
				"UPDATE facts SET status = 'superseded', updated_at = ?1 WHERE id = ?2",
			)
				.bind(now, supersededFactId)
				.run();

			await this.env.DB.prepare(
				"UPDATE fact_contradictions SET status = 'resolved', resolution_reason = ?1, updated_at = ?2 WHERE fact_a_id = ?3 AND fact_b_id = ?4",
			)
				.bind(resolution.reason ?? null, now, factA.id, factB.id)
				.run();

			await this.env.DB.prepare("UPDATE facts SET updated_at = ?1 WHERE id = ?2")
				.bind(now, resolvedFactId)
				.run();
		});

		await step.reportComplete({ resolved: true, kept: resolution.keep });
	}
}
