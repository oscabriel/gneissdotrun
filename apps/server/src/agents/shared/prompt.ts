import type { RoutingDecision } from "./agent-env";

interface RewritePromptInput {
	noteContent: string;
	userInput: string;
	routing: RoutingDecision;
	wikiLinkCandidates?: Array<{ id: string; title: string }>;
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

	return [
		"You are RewriteAgent for Gneiss.",
		"Rewrite and organize the note in markdown while preserving user intent.",
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
