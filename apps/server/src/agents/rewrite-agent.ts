import { AIChatAgent } from "@cloudflare/ai-chat";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

import {
	createId,
	generateRewriteText,
	getLatestUserInput,
	notifyIndexAgent,
	persistNoteAndNotify,
	splitIntoChunks,
} from "./shared";
import type { AgentEnv, RewriteAgentState, RoutingDecision } from "./shared";

const DEFAULT_ROUTING: RoutingDecision = {
	kind: "new_note",
	confidence: 0,
	reason: "No route has been selected yet.",
	tags: [],
	target: "rewrite-agent",
};

export class RewriteAgent extends AIChatAgent<AgentEnv, RewriteAgentState> {
	initialState: RewriteAgentState = {
		noteId: "",
		userId: "",
		title: "",
		noteContent: "",
		routingContext: DEFAULT_ROUTING,
		updatedAt: Date.now(),
	};

	async onChatMessage() {
		const latestUserInput = getLatestUserInput(this.messages);
		const routing = this.state.routingContext ?? DEFAULT_ROUTING;
		const routingPayload = {
			kind: routing.kind,
			reason: routing.reason,
		};
		const noteContent = this.state.noteContent.trim().length
			? this.state.noteContent
			: "(empty note)";

		const stream = createUIMessageStream({
			execute: async ({ writer }) => {
				const id = createId("rewrite");
				writer.write({
					type: "text-start",
					id,
				});

				const { prompt, text } = await generateRewriteText({
					noteContent,
					userInput: latestUserInput,
					routing,
					onDelta: async (delta) => {
						for (const chunk of splitIntoChunks(delta)) {
							writer.write({
								type: "text-delta",
								id,
								delta: chunk,
							});
						}
					},
				});

				const trimmed = text.trim();
				if (trimmed.length > 0) {
					await this.persistRewrite(trimmed, routing, routingPayload);
				}

				writer.write({
					type: "text-end",
					id,
				});

				writer.write({
					type: "data-routing",
					data: {
						prompt,
						routing,
					},
					transient: true,
				});
			},
		});

		return createUIMessageStreamResponse({ stream });
	}

	private async persistRewrite(
		noteContent: string,
		routing: RoutingDecision,
		routingPayload: { kind: string; reason: string },
	): Promise<void> {
		const now = Date.now();
		this.setState({
			...this.state,
			noteContent,
			routingContext: routing,
			updatedAt: now,
		});

		if (!this.state.noteId || !this.state.userId) {
			return;
		}

		const summary = noteContent.slice(0, 240);

		const indexStub = await persistNoteAndNotify(this.env, {
			noteId: this.state.noteId,
			userId: this.state.userId,
			title: this.state.title,
			content: noteContent,
			summary,
			tags: routing.tags ?? [],
			routingContext: routingPayload,
			processedAt: now,
			updatedAt: now,
		});

		await notifyIndexAgent(this.env, this.state.userId, indexStub);

		try {
			const namespace = this.env.ORGANIZATION_AGENT as DurableObjectNamespace;
			const organizationAgentId = namespace.idFromName(this.state.userId);
			const organizationAgent = namespace.get(organizationAgentId);
			await organizationAgent.fetch("https://organization-agent/internal", {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				body: JSON.stringify({
					action: "run_organize",
					noteIds: [this.state.noteId],
				}),
			});
		} catch (error) {
			console.error("RewriteAgent failed to trigger organization workflow", error);
		}
	}
}
