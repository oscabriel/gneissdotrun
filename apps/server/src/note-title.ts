export const UNTITLED_NOTE_TITLE = "Untitled note";

const TITLE_LINK_PATTERNS: RegExp[] = [
	/\[\[[^\]\n]+\]\]/,
	/\[[^\]\n]+\]\((?:[^)\n]+)\)/,
	/<(?:https?:\/\/|mailto:)[^>\s]+>/i,
	/\b(?:https?:\/\/|mailto:)\S+/i,
];

const WIKI_LINK_PATTERN = /\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g;
const MARKDOWN_LINK_PATTERN = /\[([^\]\n]+)\]\((?:[^)\n]+)\)/g;
const AUTO_LINK_PATTERN = /<(?:https?:\/\/|mailto:)[^>\s]+>/gi;
const BARE_URL_PATTERN = /\b(?:https?:\/\/|mailto:)\S+/gi;

export function titleContainsLinks(input: string): boolean {
	const trimmed = input.trim();
	if (!trimmed) {
		return false;
	}

	return TITLE_LINK_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function rewriteTitleForStorage(input: string): string {
	const rewritten = input
		.replace(WIKI_LINK_PATTERN, (_full, target: string, alias?: string) =>
			(alias ?? target ?? "").trim(),
		)
		.replace(MARKDOWN_LINK_PATTERN, (_full, label: string) => label.trim())
		.replace(AUTO_LINK_PATTERN, "")
		.replace(BARE_URL_PATTERN, "")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, 120);

	return rewritten;
}

export function sanitizeTitleForStorage(input: string): string {
	const rewritten = rewriteTitleForStorage(input);
	return rewritten.length > 0 ? rewritten : UNTITLED_NOTE_TITLE;
}

export function deriveNoteTitleFromContent(input: string): string {
	const firstLine = input
		.split("\n")
		.map((line) => line.trim())
		.find((line) => line.length > 0);
	const cleaned = (firstLine ?? "").replace(/^#+\s*/, "").trim();
	if (!cleaned) {
		return UNTITLED_NOTE_TITLE;
	}

	return sanitizeTitleForStorage(cleaned);
}

export function shouldAutoRetitle(existingTitle: string | null | undefined): boolean {
	const normalized = existingTitle?.trim() ?? "";
	if (normalized.length === 0) {
		return true;
	}

	return normalized === UNTITLED_NOTE_TITLE;
}
