import type { RoutingDecision } from "./agent-env";
import type { RewriteCommandContext } from "../../slash-commands";

interface RewritePromptInput {
	noteContent: string;
	userInput: string;
	routing: RoutingDecision;
	wikiLinkCandidates?: Array<{ id: string; title: string }>;
	commandContext?: RewriteCommandContext;
}

function formatCommandContext(context: RewriteCommandContext): string {
	const historySummary =
		context.recentHistory.length > 0
			? context.recentHistory
					.map(
						(entry) =>
							`- ${entry.routeKind}: ${entry.actionSummary} | prompt: ${entry.prompt.slice(0, 180)}`,
					)
					.join("\n")
			: "- No recent history available.";
	const relatedNotes =
		context.relatedNotes.length > 0
			? context.relatedNotes
					.map((note) => `- ${note.title}: ${note.summary.slice(0, 180)}`)
					.join("\n")
			: "- No related notes available.";
	const collections =
		context.collections.length > 0
			? context.collections
					.map((collection) => `- ${collection.title}: ${collection.summary.slice(0, 180)}`)
					.join("\n")
			: "- No collections available.";
	const facts =
		context.facts.length > 0
			? context.facts.map((fact) => `- [${fact.category}] ${fact.text.slice(0, 180)}`).join("\n")
			: "- No facts available.";

	return [
		`Interaction type: ${context.interactionType}`,
		`Slash command: /${context.commandName ?? "custom"}`,
		`Slash argument: ${context.commandArgument || "(none)"}`,
		`Scope: ${context.scope}`,
		"Recent note history:",
		historySummary,
		"Related notes:",
		relatedNotes,
		"Collections:",
		collections,
		"Facts:",
		facts,
	].join("\n\n");
}

function buildCommandInstruction(context: RewriteCommandContext): string {
	switch (context.commandName) {
		case "ask":
			return [
				"Answer the slash question by folding the answer into the note itself.",
				"Do not append a chat transcript or Q/A block unless it is structurally necessary.",
				"Prefer reorganizing headings and sections so the note becomes more useful after the answer.",
			].join(" ");
		case "research":
			return [
				"Expand the note with synthesized research using the supplied related notes, collections, and facts.",
				"Integrate findings into the note as polished markdown, not as a separate assistant response.",
				"If evidence is limited, be explicit and grounded instead of inventing detail.",
			].join(" ");
		case "link":
			return [
				"Prioritize inserting grounded wiki links and tightening structure around linked concepts.",
				"Only emit wiki links for allowed targets and prefer a minimal diff beyond better linking/organization.",
			].join(" ");
		case "summarize":
			return [
				"Condense and restructure the note to its clearest high-signal form.",
				"Keep essential decisions, facts, contradictions, and action items while removing repetition.",
			].join(" ");
		default:
			return [
				"Treat the slash command as an explicit note-refinement instruction.",
				"Apply it by rewriting the note into a stronger final artifact, not a conversation log.",
			].join(" ");
	}
}

export function buildRewritePrompt(input: RewritePromptInput): string {
	const noteContent =
		input.noteContent.trim().length > 0 ? input.noteContent.trim() : "(empty note)";
	const wikiLinkCandidates = (input.wikiLinkCandidates ?? [])
		.filter((candidate) => candidate.title.trim().length > 0)
		.slice(0, 20);
	const wikiLinkGuidance =
		wikiLinkCandidates.length > 0
			? wikiLinkCandidates
					.map((candidate) => `- [[${candidate.title.trim()}]] (id: ${candidate.id})`)
					.join("\n")
			: "- No existing notes available for wiki links.";
	const commandContextBlock = input.commandContext
		? formatCommandContext(input.commandContext)
		: null;
	const commandInstruction = input.commandContext
		? buildCommandInstruction(input.commandContext)
		: "Rewrite and organize the note in markdown while preserving user intent.";

	return [
		"You are RewriteAgent for Gneiss.",
		commandInstruction,
		"The note must be the final artifact. Do not produce a chat transcript.",
		"Use short sections and keep output practical.",
		"When referencing entities, projects, or recurring topics, format internal links as [[Wiki Link]].",
		"Only emit wiki links that exactly match one of the existing notes listed below.",
		"If a link target is not listed, use plain text instead of [[wiki syntax]].",
		`Routing kind: ${input.routing.kind}`,
		`Routing confidence: ${input.routing.confidence}`,
		`Routing reason: ${input.routing.reason}`,
		`Routing tags: ${input.routing.tags.join(", ") || "none"}`,
		"Allowed wiki-link targets:",
		wikiLinkGuidance,
		...(commandContextBlock ? ["Slash command context:", commandContextBlock] : []),
		"Current note:",
		noteContent,
		"Latest user input:",
		input.userInput,
	].join("\n\n");
}

export function applyLocalRewrite(input: RewritePromptInput): string {
	const now = new Date().toISOString();
	const prior = input.noteContent.trim();

	const base = prior.length > 0 ? prior : "# Untitled Note\n\n";

	return [
		base,
		"",
		"## Latest instruction",
		input.userInput,
		"",
		"## Agent rewrite",
		`- Route: ${input.routing.kind}`,
		`- Reason: ${input.routing.reason}`,
		`- Confidence: ${input.routing.confidence}`,
		`- Updated: ${now}`,
	]
		.join("\n")
		.trim();
}
