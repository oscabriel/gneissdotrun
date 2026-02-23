import type {
	BlockContent,
	Code,
	Delete,
	Emphasis,
	Heading,
	Image,
	InlineCode,
	Link,
	List,
	ListItem,
	Paragraph,
	PhrasingContent,
	Root,
	Strong,
	Text,
} from "mdast";
import { MARKDOWN_WIKI_PROTOCOL } from "./parse";
import { gfmToMarkdown } from "mdast-util-gfm";
import { toMarkdown } from "mdast-util-to-markdown";

import type {
	CanonicalBlock,
	CanonicalDocument,
	CanonicalInline,
	CanonicalListItemBlock,
} from "../model/document";
import type { MarkdownSerializeOptions } from "./types";

function inlineToMdast(inline: CanonicalInline): PhrasingContent[] {
	switch (inline.type) {
		case "text": {
			const textNode: Text = {
				type: "text",
				value: inline.value,
			};
			return [textNode];
		}
		case "strong": {
			const strongNode: Strong = {
				type: "strong",
				children: inline.inlines.flatMap((child) => inlineToMdast(child)),
			};
			return [strongNode];
		}
		case "emphasis": {
			const emphasisNode: Emphasis = {
				type: "emphasis",
				children: inline.inlines.flatMap((child) => inlineToMdast(child)),
			};
			return [emphasisNode];
		}
		case "strike": {
			const strikeNode: Delete = {
				type: "delete",
				children: inline.inlines.flatMap((child) => inlineToMdast(child)),
			};
			return [strikeNode];
		}
		case "inlineCode": {
			const codeNode: InlineCode = {
				type: "inlineCode",
				value: inline.value,
			};
			return [codeNode];
		}
		case "link": {
			const linkNode: Link = {
				type: "link",
				url: inline.url,
				title: inline.title,
				children: inline.inlines.flatMap((child) => inlineToMdast(child)),
			};
			return [linkNode];
		}
		case "wikiLink": {
			const linkNode: Link = {
				type: "link",
				url: `${MARKDOWN_WIKI_PROTOCOL}${encodeURIComponent(inline.target)}`,
				title: null,
				children: [
					{
						type: "text",
						value: inline.label || inline.target,
					},
				],
			};
			return [linkNode];
		}
		case "hardBreak": {
			return [
				{
					type: "break",
				},
			];
		}
	}
}

function listItemToMdast(item: CanonicalListItemBlock): ListItem {
	const children = item.blocks.flatMap((block) => blockToMdast(block));
	return {
		type: "listItem",
		checked: item.checked,
		spread: children.length > 1,
		children,
	};
}

function blockToMdast(block: CanonicalBlock): BlockContent[] {
	switch (block.type) {
		case "paragraph": {
			const paragraphNode: Paragraph = {
				type: "paragraph",
				children: block.inlines.flatMap((inline) => inlineToMdast(inline)),
			};
			return [paragraphNode];
		}
		case "heading": {
			const headingNode: Heading = {
				type: "heading",
				depth: block.level,
				children: block.inlines.flatMap((inline) => inlineToMdast(inline)),
			};
			return [headingNode];
		}
		case "quote": {
			return [
				{
					type: "blockquote",
					children: block.blocks.flatMap((child) => blockToMdast(child)),
				},
			];
		}
		case "codeBlock": {
			const codeNode: Code = {
				type: "code",
				lang: block.language ?? undefined,
				meta: block.meta ?? undefined,
				value: block.value,
			};
			return [codeNode];
		}
		case "list": {
			const listNode: List = {
				type: "list",
				ordered: block.ordered,
				start: block.start,
				spread: !block.tight,
				children: block.items.map((item) => {
					if (block.ordered && item.checked !== null) {
						return listItemToMdast({
							...item,
							checked: null,
						});
					}

					return listItemToMdast(item);
				}),
			};
			return [listNode];
		}
		case "listItem": {
			const paragraphNode: Paragraph = {
				type: "paragraph",
				children: [
					{
						type: "text",
						value: "[unsupported:listItem]",
					},
				],
			};
			return [paragraphNode];
		}
		case "thematicBreak": {
			return [
				{
					type: "thematicBreak",
				},
			];
		}
		case "image": {
			const imageNode: Image = {
				type: "image",
				url: block.url,
				alt: block.alt,
				title: block.title ?? undefined,
			};
			const paragraphNode: Paragraph = {
				type: "paragraph",
				children: [imageNode],
			};
			return [paragraphNode];
		}
	}
}

export function canonicalToMdast(document: CanonicalDocument): Root {
	return {
		type: "root",
		children: document.blocks.flatMap((block) => blockToMdast(block)),
	};
}

function restoreWikiLinkSyntax(markdown: string): string {
	return markdown.replace(/\[([^\]]+)\]\(wiki:([^)]+)\)/g, (_match, label: string) => {
		return `[[${label}]]`;
	});
}

export function serializeCanonicalMarkdown(
	document: CanonicalDocument,
	options?: MarkdownSerializeOptions,
): string {
	const tree = canonicalToMdast(document);
	const serialized = toMarkdown(tree, {
		extensions: [gfmToMarkdown()],
		bullet: options?.bullet ?? "-",
		listItemIndent: "one",
		resourceLink: true,
		fence: "`",
	});
	return restoreWikiLinkSyntax(serialized);
}
