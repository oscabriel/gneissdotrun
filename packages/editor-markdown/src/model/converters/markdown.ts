import type { CanonicalDocument } from "../document";
import { parseMarkdownToCanonical, parseMarkdownToCanonicalArtifacts } from "../../markdown/parse";
import { serializeCanonicalMarkdown } from "../../markdown/serialize";
import type {
	MarkdownParseArtifacts,
	MarkdownParseOptions,
	MarkdownSerializeOptions,
} from "../../markdown/types";

export function markdownToCanonical(
	markdown: string,
	options?: MarkdownParseOptions,
): CanonicalDocument {
	return parseMarkdownToCanonical(markdown, options);
}

export function markdownToCanonicalArtifacts(
	markdown: string,
	options?: MarkdownParseOptions,
): MarkdownParseArtifacts {
	return parseMarkdownToCanonicalArtifacts(markdown, options);
}

export function canonicalToMarkdown(
	document: CanonicalDocument,
	options?: MarkdownSerializeOptions,
): string {
	return serializeCanonicalMarkdown(document, options);
}
