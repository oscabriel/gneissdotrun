import { Agent } from "agents";

import { RouterIndexCache } from "./router-index";
import type { AgentEnv, RouteKind, RouterAgentState, RoutingDecision } from "./shared";

interface RouteRequest {
	noteId: string;
	noteContent: string;
	userInput: string;
}

const MAX_DECISIONS = 50;

export class RouterAgent extends Agent<AgentEnv, RouterAgentState> {
	initialState: RouterAgentState = {
		recentDecisions: [],
		updatedAt: Date.now(),
	};

	private cache(): RouterIndexCache {
		return new RouterIndexCache(this.env.KV);
	}

	private classifyWithHeuristics(input: string): RoutingDecision {
		const normalized = input.trim().toLowerCase();

		const matrix: Array<{
			kind: RouteKind;
			target: RoutingDecision["target"];
			confidence: number;
			tags: string[];
			match: (value: string) => boolean;
			reason: string;
		}> = [
			{
				kind: "workspace_action",
				target: "none",
				confidence: 0.93,
				tags: ["workspace", "command"],
				match: (value) => value.startsWith("/open") || value.startsWith("/create"),
				reason: "Detected explicit workspace command.",
			},
			{
				kind: "store_preference",
				target: "none",
				confidence: 0.91,
				tags: ["preference", "memory"],
				match: (value) => value.startsWith("/remember") || value.includes("prefer"),
				reason: "Input indicates a user preference to store.",
			},
			{
				kind: "ephemeral_answer",
				target: "none",
				confidence: 0.84,
				tags: ["question", "ephemeral"],
				match: (value) => value.startsWith("/ask") || value.endsWith("?"),
				reason: "Input appears to be a direct question.",
			},
			{
				kind: "fan_out",
				target: "organization-agent",
				confidence: 0.8,
				tags: ["multi-step", "background"],
				match: (value) => value.includes("and also") || value.includes("plus"),
				reason: "Input requests multiple outcomes and likely background work.",
			},
			{
				kind: "split",
				target: "rewrite-agent",
				confidence: 0.82,
				tags: ["split", "multi-note"],
				match: (value) => value.includes("split") || value.includes("separate notes"),
				reason: "Input explicitly asks to split content.",
			},
			{
				kind: "correction",
				target: "rewrite-agent",
				confidence: 0.86,
				tags: ["edit", "correction"],
				match: (value) => value.startsWith("fix") || value.startsWith("correct"),
				reason: "Input appears to be a correction.",
			},
			{
				kind: "update_existing",
				target: "rewrite-agent",
				confidence: 0.76,
				tags: ["update", "rewrite"],
				match: (value) => value.length > 0,
				reason: "Default route for active note updates.",
			},
		];

		for (const candidate of matrix) {
			if (candidate.match(normalized)) {
				return {
					kind: candidate.kind,
					confidence: candidate.confidence,
					reason: candidate.reason,
					tags: candidate.tags,
					target: candidate.target,
				};
			}
		}

		return {
			kind: "new_note",
			confidence: 0.55,
			reason: "Fallback route for blank input.",
			tags: ["fallback"],
			target: "rewrite-agent",
		};
	}

	private rememberDecision(noteId: string, decision: RoutingDecision): void {
		const next = [{ ...decision, at: Date.now(), noteId }, ...this.state.recentDecisions].slice(
			0,
			MAX_DECISIONS,
		);

		this.setState({
			recentDecisions: next,
			updatedAt: Date.now(),
		});
	}

	private async route(request: RouteRequest): Promise<RoutingDecision> {
		const fingerprint = `${request.noteId}:${request.userInput.trim().toLowerCase()}`;
		const cached = await this.cache().get(fingerprint);
		if (cached) {
			this.rememberDecision(request.noteId, cached);
			return cached;
		}

		const decision = this.classifyWithHeuristics(request.userInput);
		await this.cache().put(fingerprint, decision);
		this.rememberDecision(request.noteId, decision);

		return decision;
	}

	async onRequest(request: Request): Promise<Response> {
		if (request.method === "GET") {
			return Response.json(this.state);
		}

		if (request.method !== "POST") {
			return Response.json({ error: "Method not allowed" }, { status: 405 });
		}

		const payload = (await request.json()) as RouteRequest;
		if (!payload.noteId || !payload.userInput) {
			return Response.json({ error: "noteId and userInput are required" }, { status: 400 });
		}

		const decision = await this.route(payload);

		return Response.json({
			decision,
			dispatch: {
				target: decision.target,
				noteId: payload.noteId,
				noteContentLength: payload.noteContent.length,
			},
		});
	}
}
