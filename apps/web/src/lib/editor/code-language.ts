export function detectCodeLanguage(input?: string | null): string | null {
	if (!input) {
		return null;
	}

	const match = input.match(/language-([^\s]+)/i);
	if (match?.[1]) {
		return match[1];
	}

	return input.trim().length > 0 ? input.trim() : null;
}
