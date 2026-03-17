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
import { createNoteHistoryEvent, createNoteVersion, ensureHistorySchema } from "../history";
import { deriveNoteTitleFromContent, shouldAutoRetitle } from "../note-title";
import { createSlashCommandExecutionPlan, type SlashCommandExecutionPlan } from "../slash-commands";

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

interface RewriteRequestBody {
	invocationSource?: "note_run" | "blank_capture" | "palette_run";
	interactionType?: "slash_command";
	noteId?: string;
	userId?: string;
	title?: string;
	noteContent?: string;
	pendingCommand?: {
		kind: "editor" | "agent" | "freeform";
		commandName: string | null;
		argument: string;
		raw: string;
		label: string;
		isKnown: boolean;
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function parseRewriteRequestBody(body: unknown): RewriteRequestBody | null {
	if (!isRecord(body)) {
		return null;
	}

	return body as RewriteRequestBody;
}

function summarizeText(content: string): string {
	return content.replace(/\s+/g, " ").trim().slice(0, 240);
}

function buildHistorySummary(
	plan: SlashCommandExecutionPlan | null,
	routing: RoutingDecision,
): string {
	if (plan?.command.commandName) {
		return `Applied /${plan.command.commandName} to refine the note.`;
	}

	return `Persisted ${routing.kind.replaceAll("_", " ")} rewrite.`;
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
		const requestBody = parseRewriteRequestBody(options?.body);
		const noteId = requestBody?.noteId ?? this.state.noteId;
		const userId = requestBody?.userId ?? this.state.userId;
		const title = requestBody?.title ?? this.state.title;
		const noteContent = requestBody?.noteContent ?? this.state.noteContent;
		const slashPlan = requestBody?.pendingCommand
			? await createSlashCommandExecutionPlan(this.env, {
					userId,
					targetNote: noteId
						? {
								id: noteId,
								title,
								content: noteContent,
								summary: summarizeText(noteContent),
								tags: [],
								updatedAt: Date.now(),
								createdAt: Date.now(),
							}
						: null,
					userInput: latestUserInput,
					pendingCommands: [requestBody.pendingCommand],
					invocationSource: requestBody.invocationSource,
				})
			: null;
		const routing = slashPlan?.routing ?? this.state.routingContext ?? DEFAULT_ROUTING;
		const preparedState = {
			...this.state,
			noteId,
			userId,
			title,
			noteContent,
			routingContext: routing,
			updatedAt: Date.now(),
		};
		this.setState(preparedState);
		const routingPayload = {
			kind: routing.kind,
			reason: routing.reason,
		};
		const requestId = createRewriteRequestId({
			noteId,
			userInput: latestUserInput,
			messageCount: this.messages.length,
		});
		const renderableNoteContent = noteContent.trim().length ? noteContent : "(empty note)";

		const stream = createUIMessageStream({
			execute: async ({ writer }) => {
				const id = `${requestId}-text`;
				const noteIdValue = noteId || "";

				const startedPayload: RewriteStatusData = createRewriteStatusPayload({
					requestId,
					status: "started",
					noteId: noteIdValue,
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
					noteContent: renderableNoteContent,
					userInput: latestUserInput,
					routing,
					commandContext: slashPlan?.rewriteContext,
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
					await this.persistRewrite(trimmed, routing, routingPayload, slashPlan);
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
					noteId: noteIdValue,
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
		slashPlan: SlashCommandExecutionPlan | null,
	): Promise<void> {
		const now = Date.now();
		const nextTitle = shouldAutoRetitle(this.state.title)
			? deriveNoteTitleFromContent(noteContent)
			: this.state.title;
		const summary = summarizeText(noteContent);
		this.setState({
			...this.state,
			title: nextTitle,
			noteContent,
			routingContext: routing,
			updatedAt: now,
		});

		if (!this.state.noteId || !this.state.userId) {
			return;
		}

		const indexStub = await persistNoteAndNotify(this.env, {
			noteId: this.state.noteId,
			userId: this.state.userId,
			title: nextTitle,
			content: noteContent,
			summary,
			tags: routing.tags ?? [],
			routingContext: routingPayload,
			processedAt: now,
			updatedAt: now,
		});

		await notifyIndexAgent(this.env, this.state.userId, indexStub);

		try {
			await ensureHistorySchema(this.env.DB);
			const versionId = await createNoteVersion(this.env.DB, {
				noteId: this.state.noteId,
				userId: this.state.userId,
				title: nextTitle,
				content: noteContent,
				summary,
				tags: routing.tags ?? [],
				createdAt: now,
			});
			await createNoteHistoryEvent(this.env.DB, {
				noteId: this.state.noteId,
				userId: this.state.userId,
				routeKind: routing.kind,
				prompt: slashPlan?.command.raw ?? "RewriteAgent interaction.",
				actionSummary: buildHistorySummary(slashPlan, routing),
				interactionType: slashPlan ? "slash_command" : "capture",
				commandName: slashPlan?.command.commandName ?? null,
				commandArgument: slashPlan?.command.argument ?? "",
				sourceNoteIds: slashPlan?.rewriteContext.sourceNoteIds ?? [],
				versionId,
				createdAt: now,
			});
		} catch (error) {
			console.error("RewriteAgent failed to persist history", error);
		}

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
