import { AIChatAgent } from "@cloudflare/ai-chat";
import { createUIMessageStream, createUIMessageStreamResponse } from "ai";

import {
	applyLocalRewrite,
	buildRewritePrompt,
	createId,
	getLatestUserInput,
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
		noteContent: "",
		routingContext: DEFAULT_ROUTING,
		updatedAt: Date.now(),
	};

	async onChatMessage() {
		const latestUserInput = getLatestUserInput(this.messages);
		const routing = this.state.routingContext ?? DEFAULT_ROUTING;

		const prompt = buildRewritePrompt({
			noteContent: this.state.noteContent,
			userInput: latestUserInput,
			routing,
		});

		const rewrittenNote = applyLocalRewrite({
			noteContent: this.state.noteContent,
			userInput: latestUserInput,
			routing,
		});

		this.setState({
			...this.state,
			noteContent: rewrittenNote,
			updatedAt: Date.now(),
		});

		const stream = createUIMessageStream({
			execute: ({ writer }) => {
				const id = createId("rewrite");
				writer.write({
					type: "text-start",
					id,
				});

				for (const chunk of splitIntoChunks(rewrittenNote)) {
					writer.write({
						type: "text-delta",
						id,
						delta: chunk,
					});
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
}
