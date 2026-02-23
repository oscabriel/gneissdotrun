export interface CanonicalDocument {
	blocks: CanonicalBlock[];
}

export type CanonicalBlock =
	| CanonicalParagraphBlock
	| CanonicalHeadingBlock
	| CanonicalQuoteBlock
	| CanonicalCodeBlock
	| CanonicalListBlock
	| CanonicalListItemBlock
	| CanonicalThematicBreakBlock
	| CanonicalImageBlock;

export interface CanonicalParagraphBlock {
	type: "paragraph";
	inlines: CanonicalInline[];
}

export interface CanonicalHeadingBlock {
	type: "heading";
	level: 1 | 2 | 3 | 4 | 5 | 6;
	inlines: CanonicalInline[];
}

export interface CanonicalQuoteBlock {
	type: "quote";
	blocks: CanonicalBlock[];
}

export interface CanonicalCodeBlock {
	type: "codeBlock";
	language: string | null;
	meta: string | null;
	value: string;
}

export interface CanonicalListBlock {
	type: "list";
	ordered: boolean;
	start: number;
	tight: boolean;
	items: CanonicalListItemBlock[];
}

export interface CanonicalListItemBlock {
	type: "listItem";
	checked: boolean | null;
	blocks: CanonicalBlock[];
}

export interface CanonicalThematicBreakBlock {
	type: "thematicBreak";
}

export interface CanonicalImageBlock {
	type: "image";
	url: string;
	alt: string;
	title: string | null;
}

export type CanonicalInline =
	| CanonicalTextInline
	| CanonicalStrongInline
	| CanonicalEmphasisInline
	| CanonicalStrikeInline
	| CanonicalInlineCodeInline
	| CanonicalLinkInline
	| CanonicalWikiLinkInline
	| CanonicalHardBreakInline;

export interface CanonicalTextInline {
	type: "text";
	value: string;
}

export interface CanonicalStrongInline {
	type: "strong";
	inlines: CanonicalInline[];
}

export interface CanonicalEmphasisInline {
	type: "emphasis";
	inlines: CanonicalInline[];
}

export interface CanonicalStrikeInline {
	type: "strike";
	inlines: CanonicalInline[];
}

export interface CanonicalInlineCodeInline {
	type: "inlineCode";
	value: string;
}

export interface CanonicalLinkInline {
	type: "link";
	url: string;
	title: string | null;
	inlines: CanonicalInline[];
}

export interface CanonicalWikiLinkInline {
	type: "wikiLink";
	target: string;
	label: string;
}

export interface CanonicalHardBreakInline {
	type: "hardBreak";
}

export function createEmptyCanonicalDocument(): CanonicalDocument {
	return {
		blocks: [],
	};
}
