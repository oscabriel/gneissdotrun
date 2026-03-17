import type { Root } from "mdast";

import type { CanonicalDocument } from "../model/document";

export interface MarkdownUnsupportedNode {
	type: string;
	fallback: string;
}

export interface MarkdownParseArtifacts {
	mdast: Root;
	canonical: CanonicalDocument;
	unsupportedNodes: MarkdownUnsupportedNode[];
}

export interface MarkdownParseOptions {
	wikiProtocol?: string;
}

export interface MarkdownSerializeOptions {
	bullet?: "-" | "*" | "+";
}
