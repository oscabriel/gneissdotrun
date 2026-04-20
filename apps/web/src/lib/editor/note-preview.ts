import { markdownToPreviewText } from "@gneissdotrun/editor-markdown";

const MAX_CACHE_ENTRIES = 500;

const previewTextCache = new Map<string, string>();

function trimPreviewCache(): void {
	while (previewTextCache.size > MAX_CACHE_ENTRIES) {
		const firstKey = previewTextCache.keys().next().value;
		if (typeof firstKey !== "string") {
			return;
		}
		previewTextCache.delete(firstKey);
	}
}

export function getNotePreviewText(markdown: string): string {
	const cached = previewTextCache.get(markdown);
	if (cached !== undefined) {
		return cached;
	}

	const previewText = markdownToPreviewText(markdown);
	previewTextCache.set(markdown, previewText);
	trimPreviewCache();
	return previewText;
}
