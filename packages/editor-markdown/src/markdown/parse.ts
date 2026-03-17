import type {
	BlockContent,
	Content,
	Heading,
	Image,
	InlineCode,
	Link,
	List,
	ListItem,
	PhrasingContent,
	Root,
	RootContent,
	Table,
	TableCell,
	TableRow,
} from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";

import type {
	CanonicalBlock,
	CanonicalDocument,
	CanonicalInline,
	CanonicalListItemBlock,
	CanonicalTableCellBlock,
	CanonicalTableRowBlock,
} from "../model/document";
import type {
	MarkdownParseArtifacts,
	MarkdownParseOptions,
	MarkdownUnsupportedNode,
} from "./types";

const DEFAULT_WIKI_PROTOCOL = "wiki:";
const HTML_IMAGE_PATTERN = /<img\s+[^>]*>/i;
const HTML_ATTRIBUTE_PATTERN =
	/([a-zA-Z_:][a-zA-Z0-9_:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

function preprocessWikiLinks(markdown: string, protocol: string): string {
	return markdown.replace(/\[\[([^\]]+)\]\]/g, (_match, label: string) => {
		const trimmed = label.trim();
		if (!trimmed) {
			return "";
		}

		const encoded = encodeURIComponent(trimmed);
		return `[${trimmed}](${protocol}${encoded})`;
	});
}

function parseHtmlAttributes(htmlTag: string): Record<string, string> {
	const attributes: Record<string, string> = {};
	for (const match of htmlTag.matchAll(HTML_ATTRIBUTE_PATTERN)) {
		const name = match[1];
		const value = match[2] ?? match[3] ?? match[4] ?? "";
		if (name) {
			attributes[name.toLowerCase()] = value;
		}
	}
	return attributes;
}

function fallbackParagraph(
	nodeType: string,
	unsupportedNodes: MarkdownUnsupportedNode[],
): CanonicalBlock {
	const fallback = `[unsupported:${nodeType}]`;
	unsupportedNodes.push({
		type: nodeType,
		fallback,
	});
	return {
		type: "paragraph",
		inlines: [
			{
				type: "text",
				value: fallback,
			},
		],
	};
}

function phrasingToCanonical(
	node: PhrasingContent,
	unsupportedNodes: MarkdownUnsupportedNode[],
	wikiProtocol: string,
): CanonicalInline[] {
	switch (node.type) {
		case "text": {
			return [
				{
					type: "text",
					value: node.value,
				},
			];
		}
		case "strong": {
			return [
				{
					type: "strong",
					inlines: node.children.flatMap((child) =>
						phrasingToCanonical(child, unsupportedNodes, wikiProtocol),
					),
				},
			];
		}
		case "emphasis": {
			return [
				{
					type: "emphasis",
					inlines: node.children.flatMap((child) =>
						phrasingToCanonical(child, unsupportedNodes, wikiProtocol),
					),
				},
			];
		}
		case "delete": {
			return [
				{
					type: "strike",
					inlines: node.children.flatMap((child) =>
						phrasingToCanonical(child, unsupportedNodes, wikiProtocol),
					),
				},
			];
		}
		case "inlineCode": {
			const inlineCodeNode = node as InlineCode;
			return [
				{
					type: "inlineCode",
					value: inlineCodeNode.value,
				},
			];
		}
		case "link": {
			const linkNode = node as Link;
			if (linkNode.url.startsWith(wikiProtocol)) {
				const target = decodeURIComponent(linkNode.url.slice(wikiProtocol.length));
				const label = linkNode.children
					.flatMap((child) => phrasingToCanonical(child, unsupportedNodes, wikiProtocol))
					.map((child) => (child.type === "text" ? child.value : ""))
					.join("")
					.trim();
				return [
					{
						type: "wikiLink",
						target,
						label: label || target,
					},
				];
			}
			return [
				{
					type: "link",
					url: linkNode.url,
					title: linkNode.title ?? null,
					inlines: linkNode.children.flatMap((child) =>
						phrasingToCanonical(child, unsupportedNodes, wikiProtocol),
					),
				},
			];
		}
		case "break": {
			return [
				{
					type: "hardBreak",
				},
			];
		}
		case "image": {
			const imageNode = node as Image;
			return [
				{
					type: "text",
					value: `![${imageNode.alt ?? ""}](${imageNode.url})`,
				},
			];
		}
		default: {
			const fallback = `[unsupported:${node.type}]`;
			unsupportedNodes.push({
				type: node.type,
				fallback,
			});
			return [
				{
					type: "text",
					value: fallback,
				},
			];
		}
	}
}

function listItemToCanonical(
	node: ListItem,
	unsupportedNodes: MarkdownUnsupportedNode[],
	wikiProtocol: string,
): CanonicalListItemBlock {
	const blocks = node.children.flatMap((child) =>
		blockToCanonical(child, unsupportedNodes, wikiProtocol),
	);
	if (blocks.length === 0) {
		blocks.push({
			type: "paragraph",
			inlines: [],
		});
	}
	return {
		type: "listItem",
		checked: typeof node.checked === "boolean" ? node.checked : null,
		blocks,
	};
}

function tableCellToCanonical(
	node: TableCell,
	rowIndex: number,
	unsupportedNodes: MarkdownUnsupportedNode[],
	wikiProtocol: string,
): CanonicalTableCellBlock {
	const inlines = node.children.flatMap((child) =>
		phrasingToCanonical(child, unsupportedNodes, wikiProtocol),
	);
	return {
		type: "tableCell",
		header: rowIndex === 0,
		blocks: [
			{
				type: "paragraph",
				inlines,
			},
		],
	};
}

function tableRowToCanonical(
	node: TableRow,
	rowIndex: number,
	unsupportedNodes: MarkdownUnsupportedNode[],
	wikiProtocol: string,
): CanonicalTableRowBlock {
	return {
		type: "tableRow",
		cells: node.children.map((cell) =>
			tableCellToCanonical(cell, rowIndex, unsupportedNodes, wikiProtocol),
		),
	};
}

function htmlToCanonical(
	html: string,
	unsupportedNodes: MarkdownUnsupportedNode[],
): CanonicalBlock[] {
	if (!HTML_IMAGE_PATTERN.test(html)) {
		return [
			{
				type: "paragraph",
				inlines: [
					{
						type: "text",
						value: html,
					},
				],
			},
		];
	}

	const attributes = parseHtmlAttributes(html);
	const url = attributes.src ?? "";
	if (!url) {
		return [fallbackParagraph("html-image-missing-src", unsupportedNodes)];
	}

	return [
		{
			type: "image",
			url,
			alt: attributes.alt ?? "",
			title: attributes.title ?? null,
		},
	];
}

function blockToCanonical(
	node: Content,
	unsupportedNodes: MarkdownUnsupportedNode[],
	wikiProtocol: string,
): CanonicalBlock[] {
	switch (node.type) {
		case "paragraph": {
			if (node.children.length === 1 && node.children[0]?.type === "image") {
				const onlyImage = node.children[0] as Image;
				return [
					{
						type: "image",
						url: onlyImage.url,
						alt: onlyImage.alt ?? "",
						title: onlyImage.title ?? null,
					},
				];
			}
			return [
				{
					type: "paragraph",
					inlines: node.children.flatMap((child) =>
						phrasingToCanonical(child, unsupportedNodes, wikiProtocol),
					),
				},
			];
		}
		case "heading": {
			const headingNode = node as Heading;
			const level = Math.max(1, Math.min(headingNode.depth, 6)) as 1 | 2 | 3 | 4 | 5 | 6;
			return [
				{
					type: "heading",
					level,
					inlines: headingNode.children.flatMap((child) =>
						phrasingToCanonical(child, unsupportedNodes, wikiProtocol),
					),
				},
			];
		}
		case "blockquote": {
			return [
				{
					type: "quote",
					blocks: node.children.flatMap((child) =>
						blockToCanonical(child, unsupportedNodes, wikiProtocol),
					),
				},
			];
		}
		case "code": {
			return [
				{
					type: "codeBlock",
					language: node.lang ?? null,
					meta: node.meta ?? null,
					value: node.value,
				},
			];
		}
		case "list": {
			const listNode = node as List;
			return [
				{
					type: "list",
					ordered: Boolean(listNode.ordered),
					start: listNode.start ?? 1,
					tight: listNode.spread === false,
					items: listNode.children.map((item) =>
						listItemToCanonical(item, unsupportedNodes, wikiProtocol),
					),
				},
			];
		}
		case "table": {
			const tableNode = node as Table;
			return [
				{
					type: "table",
					rows: tableNode.children.map((row, rowIndex) =>
						tableRowToCanonical(row, rowIndex, unsupportedNodes, wikiProtocol),
					),
				},
			];
		}
		case "thematicBreak": {
			return [
				{
					type: "thematicBreak",
				},
			];
		}
		case "image": {
			const imageNode = node as Image;
			return [
				{
					type: "image",
					url: imageNode.url,
					alt: imageNode.alt ?? "",
					title: imageNode.title ?? null,
				},
			];
		}
		case "html": {
			return htmlToCanonical(node.value, unsupportedNodes);
		}
		default: {
			return [fallbackParagraph(node.type, unsupportedNodes)];
		}
	}
}

export function parseMarkdownAst(markdown: string, options?: MarkdownParseOptions): Root {
	const wikiProtocol = options?.wikiProtocol ?? DEFAULT_WIKI_PROTOCOL;
	const preprocessed = preprocessWikiLinks(markdown, wikiProtocol);
	const tree = unified().use(remarkParse).use(remarkGfm).parse(preprocessed);
	return tree as Root;
}

export function mdastToCanonical(
	root: Root,
	options?: MarkdownParseOptions,
): MarkdownParseArtifacts {
	const wikiProtocol = options?.wikiProtocol ?? DEFAULT_WIKI_PROTOCOL;
	const unsupportedNodes: MarkdownUnsupportedNode[] = [];
	const blocks = root.children.flatMap((child: RootContent) =>
		blockToCanonical(child as BlockContent, unsupportedNodes, wikiProtocol),
	);
	return {
		mdast: root,
		canonical: {
			blocks,
		},
		unsupportedNodes,
	};
}

export function parseMarkdownToCanonicalArtifacts(
	markdown: string,
	options?: MarkdownParseOptions,
): MarkdownParseArtifacts {
	const root = parseMarkdownAst(markdown, options);
	return mdastToCanonical(root, options);
}

export function parseMarkdownToCanonical(
	markdown: string,
	options?: MarkdownParseOptions,
): CanonicalDocument {
	return parseMarkdownToCanonicalArtifacts(markdown, options).canonical;
}

export const MARKDOWN_WIKI_PROTOCOL = DEFAULT_WIKI_PROTOCOL;
