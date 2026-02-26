import { google } from "@ai-sdk/google";
import { streamText } from "ai";

import type { RoutingDecision } from "./agent-env";
import { buildRewritePrompt } from "./prompt";

interface GenerateRewriteTextInput {
	noteContent: string;
	userInput: string;
	routing: RoutingDecision;
	wikiLinkCandidates?: Array<{ id: string; title: string }>;
	temperature?: number;
	onDelta?: (delta: string) => Promise<void> | void;
	abortSignal?: AbortSignal;
}

interface GenerateRewriteTextResult {
	prompt: string;
	text: string;
}

export type RewriteRuntime = "shared_pipeline_v1";

export async function executeRewrite(input: GenerateRewriteTextInput): Promise<
	GenerateRewriteTextResult & {
		runtime: RewriteRuntime;
	}
> {
	const result = await generateRewriteText(input);
	return {
		...result,
		runtime: "shared_pipeline_v1",
	};
}

const DEFAULT_REWRITE_MODEL = "gemini-2.5-flash";

function resolveGoogleApiKey(): string | null {
	const fromProcess =
		typeof process !== "undefined" && typeof process.env.GOOGLE_GENERATIVE_AI_API_KEY === "string"
			? process.env.GOOGLE_GENERATIVE_AI_API_KEY.trim()
			: "";
	if (fromProcess.length > 0) {
		return fromProcess;
	}

	const globalKey = (globalThis as { GOOGLE_GENERATIVE_AI_API_KEY?: string })
		.GOOGLE_GENERATIVE_AI_API_KEY;
	if (typeof globalKey === "string" && globalKey.trim().length > 0) {
		return globalKey.trim();
	}

	return null;
}

export async function generateRewriteText(
	input: GenerateRewriteTextInput,
): Promise<GenerateRewriteTextResult> {
	const prompt = buildRewritePrompt({
		noteContent: input.noteContent,
		userInput: input.userInput,
		routing: input.routing,
		wikiLinkCandidates: input.wikiLinkCandidates,
	});
	const apiKey = resolveGoogleApiKey();
	if (!apiKey) {
		return {
			prompt,
			text: "",
		};
	}

	const result = streamText({
		model: google(DEFAULT_REWRITE_MODEL),
		prompt,
		temperature: input.temperature,
		abortSignal: input.abortSignal,
	});

	let text = "";
	for await (const delta of result.textStream) {
		if (!delta) {
			continue;
		}

		text += delta;
		if (input.onDelta) {
			await input.onDelta(delta);
		}
	}

	return {
		prompt,
		text,
	};
}
