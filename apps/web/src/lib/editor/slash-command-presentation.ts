import {
	parseSlashCommandLine,
	type SlashCommandIntent,
	type SlashCommandKind,
} from "@gneissdotrun/api/slash-commands";

export interface SlashCommandPresentation {
	kind: SlashCommandKind;
	label: string;
	raw: string;
	commandName: string | null;
	argument: string;
	isKnown: boolean;
}

export function getSlashCommandPresentation(input: string): SlashCommandPresentation | null {
	const intent = parseSlashCommandLine(input);
	if (!intent) {
		return null;
	}

	return toSlashCommandPresentation(intent);
}

export function getSlashCommandClassName(kind: SlashCommandKind): string {
	return `editor-slash-command-line editor-slash-command-line--${kind}`;
}

function toSlashCommandPresentation(intent: SlashCommandIntent): SlashCommandPresentation {
	return {
		kind: intent.kind,
		label: intent.label,
		raw: intent.raw,
		commandName: intent.commandName,
		argument: intent.argument,
		isKnown: intent.isKnown,
	};
}
