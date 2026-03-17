export const slashCommandLinePattern = /^\s*\/([a-z-]+)(?:\s+(.*))?\s*$/i;

export const editorSlashCommands = ["heading", "code", "quote", "bullets"] as const;
export const agentSlashCommands = ["ask", "research", "link", "summarize"] as const;

export type EditorSlashCommandName = (typeof editorSlashCommands)[number];
export type AgentSlashCommandName = (typeof agentSlashCommands)[number];
export type KnownSlashCommandName = EditorSlashCommandName | AgentSlashCommandName;
export type SlashCommandKind = "editor" | "agent" | "freeform";

export interface SlashCommandIntent {
	kind: SlashCommandKind;
	commandName: string | null;
	argument: string;
	raw: string;
	label: string;
	isKnown: boolean;
}

const editorSlashCommandSet = new Set<string>(editorSlashCommands);
const agentSlashCommandSet = new Set<string>(agentSlashCommands);

function toDisplayLabel(commandName: string | null): string {
	if (!commandName) {
		return "Custom";
	}

	return commandName
		.split("-")
		.map((segment) => segment.slice(0, 1).toUpperCase() + segment.slice(1))
		.join(" ");
}

export function isSlashCommandLine(input: string): boolean {
	return slashCommandLinePattern.test(input);
}

export function extractSlashCommandLines(input: string): string[] {
	return input
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => isSlashCommandLine(line));
}

export function stripSlashCommandLines(input: string): string {
	const lines = input.split("\n");
	const filtered = lines.filter((line) => !isSlashCommandLine(line.trim()));
	return filtered.join("\n").trimEnd();
}

export function parseSlashCommandLine(rawInput: string): SlashCommandIntent | null {
	const raw = rawInput.trim();
	if (!raw.startsWith("/")) {
		return null;
	}

	const match = raw.match(slashCommandLinePattern);
	if (!match) {
		return null;
	}

	const commandName = (match[1] ?? "").toLowerCase();
	const argument = (match[2] ?? "").trim();

	if (editorSlashCommandSet.has(commandName)) {
		return {
			kind: "editor",
			commandName,
			argument,
			raw,
			label: toDisplayLabel(commandName),
			isKnown: true,
		};
	}

	if (agentSlashCommandSet.has(commandName)) {
		return {
			kind: "agent",
			commandName,
			argument,
			raw,
			label: toDisplayLabel(commandName),
			isKnown: true,
		};
	}

	return {
		kind: "freeform",
		commandName,
		argument,
		raw,
		label: commandName ? toDisplayLabel(commandName) : "Custom",
		isKnown: false,
	};
}

export function parseSlashCommands(input: string): SlashCommandIntent[] {
	return extractSlashCommandLines(input)
		.map((line) => parseSlashCommandLine(line))
		.filter((intent): intent is SlashCommandIntent => intent !== null);
}
