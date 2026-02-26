import { AIChatAgent, type OnChatMessageOptions } from "@cloudflare/ai-chat";
import {
	createUIMessageStream,
	createUIMessageStreamResponse,
	type StreamTextOnFinishCallback,
	type ToolSet,
} from "ai";

import {
	executeRewrite,
	getLatestUserInput,
	notifyIndexAgent,
	persistNoteAndNotify,
	splitIntoChunks,
} from "./shared";
import {
	createRewriteRequestId,
	createRewriteRoutingEventId,
	createRewriteStatusPayload,
} from "./rewrite-stream";
import type { AgentEnv, RewriteAgentState, RoutingDecision } from "./shared";

const DEFAULT_ROUTING: RoutingDecision = {
	kind: "new_note",
	confidence: 0,
	reason: "No route has been selected yet.",
	tags: [],
	target: "rewrite-agent",
};

interface RewriteRoutingData {
	eventId: string;
	requestId: string;
	prompt: string;
	runtime: "shared_pipeline_v1";
	routing: RoutingDecision;
	emittedAt: number;
}

interface RewriteStatusData {
	eventId: string;
	requestId: string;
	status: "started" | "persisted" | "skipped";
	noteId: string;
	routeKind: RoutingDecision["kind"];
	hint: string;
	emittedAt: number;
}

export class RewriteAgent extends AIChatAgent<AgentEnv, RewriteAgentState> {
	initialState: RewriteAgentState = {
		noteId: "",
		userId: "",
		title: "",
		noteContent: "",
		routingContext: DEFAULT_ROUTING,
		updatedAt: Date.now(),
	};

	async onChatMessage(
		_onFinish: StreamTextOnFinishCallback<ToolSet>,
		options?: OnChatMessageOptions,
	) {
		const latestUserInput = getLatestUserInput(this.messages);
		const routing = this.state.routingContext ?? DEFAULT_ROUTING;
		const routingPayload = {
			kind: routing.kind,
			reason: routing.reason,
		};
		const requestId = createRewriteRequestId({
			noteId: this.state.noteId,
			userInput: latestUserInput,
			messageCount: this.messages.length,
		});
		const noteContent = this.state.noteContent.trim().length
			? this.state.noteContent
			: "(empty note)";

		const stream = createUIMessageStream({
			execute: async ({ writer }) => {
				const id = `${requestId}-text`;
				const noteId = this.state.noteId || "";

				const startedPayload: RewriteStatusData = createRewriteStatusPayload({
					requestId,
					status: "started",
					noteId,
					routeKind: routing.kind,
				});

				writer.write({
					type: "data-rewrite-status",
					data: startedPayload,
					transient: true,
				});

				writer.write({
					type: "text-start",
					id,
				});

				const { prompt, runtime, text } = await executeRewrite({
					noteContent,
					userInput: latestUserInput,
					routing,
					abortSignal: options?.abortSignal,
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
				const persisted = trimmed.length > 0;
				if (trimmed.length > 0) {
					await this.persistRewrite(trimmed, routing, routingPayload);
				}

				writer.write({
					type: "text-end",
					id,
				});

				const routingData: RewriteRoutingData = {
					eventId: createRewriteRoutingEventId(requestId),
					requestId,
					prompt,
					runtime,
					routing,
					emittedAt: Date.now(),
				};

				writer.write({
					type: "data-routing",
					data: routingData,
					transient: true,
				});

				const completionPayload: RewriteStatusData = createRewriteStatusPayload({
					requestId,
					status: persisted ? "persisted" : "skipped",
					noteId,
					routeKind: routing.kind,
				});

				writer.write({
					type: "data-rewrite-status",
					data: completionPayload,
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
