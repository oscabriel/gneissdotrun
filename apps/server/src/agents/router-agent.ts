import { Agent } from "agents";
import { google } from "@ai-sdk/google";
import { generateText, Output } from "ai";
import z from "zod";

import { RouterIndexCache } from "./router-index";
import type { AgentEnv, RouteKind, RouterAgentState, RoutingDecision } from "./shared";

interface RouteRequest {
	noteId: string;
	noteContent: string;
	userInput: string;
}

const MAX_DECISIONS = 50;
const ROUTER_MODEL = "gemini-2.5-flash";

const llmRoutingDecisionSchema = z.object({
	kind: z.enum([
		"new_note",
		"update_existing",
		"correction",
		"split",
		"fan_out",
		"workspace_action",
		"ephemeral_answer",
		"store_preference",
		"duplicate",
	]),
	confidence: z.number().min(0).max(1),
	reason: z.string().min(1).max(320),
	tags: z.array(z.string().trim().min(1).max(40)).max(8).default([]),
	target: z.enum(["rewrite-agent", "organization-agent", "none"]),
});

interface LightweightNoteIndex {
	id: string;
	title: string;
	summary: string;
	tags: string[];
	updatedAt: number;
}

function targetForKind(kind: RouteKind): RoutingDecision["target"] {
	if (kind === "fan_out") {
		return "organization-agent";
	}

	if (kind === "workspace_action" || kind === "ephemeral_answer" || kind === "store_preference") {
		return "none";
	}

	return "rewrite-agent";
}

function normalizeDecision(decision: z.infer<typeof llmRoutingDecisionSchema>): RoutingDecision {
	const kind = decision.kind as RouteKind;
	const target = targetForKind(kind);
	const confidence = Number.isFinite(decision.confidence)
		? Math.min(1, Math.max(0, decision.confidence))
		: 0.5;
	const tags = Array.from(
		new Set((decision.tags ?? []).map((tag) => tag.trim().toLowerCase())),
	).filter((tag) => tag.length > 0);

	return {
		kind,
		confidence,
		reason: decision.reason,
		tags,
		target,
	};
}

export class RouterAgent extends Agent<AgentEnv, RouterAgentState> {
	initialState: RouterAgentState = {
		recentDecisions: [],
		updatedAt: Date.now(),
	};

	private parseTags(raw: string): string[] {
		try {
			const parsed = JSON.parse(raw) as unknown;
			if (!Array.isArray(parsed)) {
				return [];
			}

			return parsed
				.filter((value): value is string => typeof value === "string")
				.map((value) => value.trim())
				.filter((value) => value.length > 0)
				.slice(0, 12);
		} catch {
			return [];
		}
	}

	private cache(): RouterIndexCache {
		return new RouterIndexCache(this.env.KV);
	}

	private async loadLightweightIndex(currentNoteId: string): Promise<LightweightNoteIndex[]> {
		const rows = await this.env.DB.prepare(
			"SELECT id, title, summary, tags, updated_at FROM notes WHERE user_id = ?1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 40",
		)
			.bind(this.name)
			.all<{
				id: string;
				title: string;
				summary: string;
				tags: string;
				updated_at: number;
			}>();

		const mapped = (rows.results ?? []).map((row) => ({
			id: row.id,
			title: row.title,
			summary: row.summary,
			tags: this.parseTags(row.tags),
			updatedAt: row.updated_at,
		}));

		const current = mapped.find((row) => row.id === currentNoteId);
		const others = mapped.filter((row) => row.id !== currentNoteId);

		return current ? [current, ...others] : others;
	}

	private buildRoutingPrompt(request: RouteRequest, noteIndex: LightweightNoteIndex[]): string {
		const currentNote = noteIndex.find((note) => note.id === request.noteId) ?? null;
		const compactIndex = noteIndex.map((note) => ({
			id: note.id,
			title: note.title,
			summary: note.summary,
			tags: note.tags,
			updatedAt: note.updatedAt,
		}));

		const noteExcerpt = request.noteContent.slice(0, 4000);

		return [
			"You are RouterAgent for Gneiss.",
			"Classify the latest user input into one routing kind.",
			"Return confidence 0..1, short reason, and compact tags.",
			"Choose kind based on intent:",
			"- new_note: capture should become a distinct note.",
			"- update_existing: mutate current note as normal rewrite.",
			"- correction: explicit fix/correct request.",
			"- split: user requests splitting into multiple notes.",
			"- fan_out: request implies multiple outputs/background organization.",
			"- workspace_action: non-note command/action.",
			"- ephemeral_answer: direct Q/A without note mutation.",
			"- store_preference: user preference to remember.",
			"- duplicate: input matches existing knowledge and should avoid duplicate storage.",
			"Only use provided data. Be conservative with high confidence.",
			`Current note id: ${request.noteId}`,
			`Current note metadata: ${JSON.stringify(currentNote)}`,
			`Current note excerpt: ${noteExcerpt || "(empty note)"}`,
			`Latest user input: ${request.userInput}`,
			`Recent note index: ${JSON.stringify(compactIndex)}`,
		].join("\n\n");
	}

	private async classifyWithLlm(
		request: RouteRequest,
		noteIndex: LightweightNoteIndex[],
	): Promise<RoutingDecision> {
		const prompt = this.buildRoutingPrompt(request, noteIndex);
		const { output } = await generateText({
			model: google(ROUTER_MODEL),
			output: Output.object({ schema: llmRoutingDecisionSchema }),
			prompt,
			temperature: 0.1,
		});

		return normalizeDecision(output);
	}

	private classifyWithHeuristics(input: string, noteContent: string): RoutingDecision {
		const normalized = input.trim().toLowerCase();
		const hasExistingContent = noteContent.trim().length > 0;

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
				match: (value) =>
					hasExistingContent && (value.startsWith("fix") || value.startsWith("correct")),
				reason: "Input appears to be a correction.",
			},
			{
				kind: "update_existing",
				target: "rewrite-agent",
				confidence: 0.76,
				tags: ["update", "rewrite"],
				match: (value) => hasExistingContent && value.length > 0,
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
		const contentFingerprint = request.noteContent.trim().slice(0, 512).toLowerCase();
		const fingerprint = `${request.noteId}:${request.userInput.trim().toLowerCase()}:${contentFingerprint}`;
		const cached = await this.cache().get(fingerprint);
		if (cached) {
			this.rememberDecision(request.noteId, cached);
			return cached;
		}

		let decision: RoutingDecision;
		try {
			const noteIndex = await this.loadLightweightIndex(request.noteId);
			decision = await this.classifyWithLlm(request, noteIndex);
		} catch (error) {
			console.error("RouterAgent LLM classification failed, using heuristics", error);
			decision = this.classifyWithHeuristics(request.userInput, request.noteContent);
		}

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
