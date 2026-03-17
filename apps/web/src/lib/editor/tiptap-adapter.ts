import type { JSONContent } from "@tiptap/core";
import {
	canonicalToMarkdown,
	markdownToCanonical,
	type CanonicalBlock,
	type CanonicalDocument,
	type CanonicalInline,
	type CanonicalListItemBlock,
	type CanonicalTableCellBlock,
	type CanonicalTableRowBlock,
} from "@gneissdotrun/editor-markdown";

const DEFAULT_WIKI_HREF_PREFIX = "/collections?query=";

export type TiptapJsonDoc = JSONContent & {
	type: "doc";
};

export interface TiptapAdapterOptions {
	wikiHrefPrefix?: string;
}

function textNode(text: string, marks?: JSONContent["marks"]): JSONContent {
	return {
		type: "text",
		text,
		marks,
	};
}

function canonicalInlineToTiptap(
	inline: CanonicalInline,
	options?: TiptapAdapterOptions,
): JSONContent[] {
	const wikiHrefPrefix = options?.wikiHrefPrefix ?? DEFAULT_WIKI_HREF_PREFIX;
	switch (inline.type) {
		case "text":
			return [textNode(inline.value)];
		case "inlineCode":
			return [textNode(inline.value, [{ type: "code" }])];
		case "hardBreak":
			return [{ type: "hardBreak" }];
		case "strong":
			return inline.inlines.flatMap((child: CanonicalInline) =>
				canonicalInlineToTiptap(child, options).map((node) => {
					if (node.type !== "text") {
						return node;
					}
					return {
						...node,
						marks: [...(node.marks ?? []), { type: "bold" }],
					};
				}),
			);
		case "emphasis":
			return inline.inlines.flatMap((child: CanonicalInline) =>
				canonicalInlineToTiptap(child, options).map((node) => {
					if (node.type !== "text") {
						return node;
					}
					return {
						...node,
						marks: [...(node.marks ?? []), { type: "italic" }],
					};
				}),
			);
		case "strike":
			return inline.inlines.flatMap((child: CanonicalInline) =>
				canonicalInlineToTiptap(child, options).map((node) => {
					if (node.type !== "text") {
						return node;
					}
					return {
						...node,
						marks: [...(node.marks ?? []), { type: "strike" }],
					};
				}),
			);
		case "link":
			return inline.inlines.flatMap((child: CanonicalInline) =>
				canonicalInlineToTiptap(child, options).map((node) => {
					if (node.type !== "text") {
						return node;
					}
					return {
						...node,
						marks: [
							...(node.marks ?? []),
							{
								type: "link",
								attrs: {
									href: inline.url,
									title: inline.title,
								},
							},
						],
					};
				}),
			);
		case "wikiLink": {
			const label = inline.label || inline.target;
			return [
				textNode(label, [
					{
						type: "link",
						attrs: {
							href: `${wikiHrefPrefix}${encodeURIComponent(inline.target)}`,
							title: null,
							"data-wiki-link": inline.target,
						},
					},
				]),
			];
		}
		default:
			return [];
	}
}

function canonicalListToTiptap(
	block: Extract<CanonicalBlock, { type: "list" }>,
	options?: TiptapAdapterOptions,
): JSONContent {
	const hasTaskItems =
		!block.ordered && block.items.some((item: CanonicalListItemBlock) => item.checked !== null);
	const listType = hasTaskItems ? "taskList" : block.ordered ? "orderedList" : "bulletList";
	return {
		type: listType,
		attrs: block.ordered ? { start: block.start } : undefined,
		content: block.items.map((item: CanonicalListItemBlock) => ({
			type: hasTaskItems ? "taskItem" : "listItem",
			attrs: hasTaskItems ? { checked: item.checked ?? false } : undefined,
			content: item.blocks.flatMap((child: CanonicalBlock) =>
				canonicalBlockToTiptap(child, options),
			),
		})),
	};
}

function canonicalTableCellToTiptap(
	cell: CanonicalTableCellBlock,
	options?: TiptapAdapterOptions,
): JSONContent {
	const content = cell.blocks.flatMap((block: CanonicalBlock) =>
		canonicalBlockToTiptap(block, options),
	);
	return {
		type: cell.header ? "tableHeader" : "tableCell",
		content: content.length > 0 ? content : [{ type: "paragraph" }],
	};
}

function canonicalTableRowToTiptap(
	row: CanonicalTableRowBlock,
	options?: TiptapAdapterOptions,
): JSONContent {
	return {
		type: "tableRow",
		content: row.cells.map((cell: CanonicalTableCellBlock) =>
			canonicalTableCellToTiptap(cell, options),
		),
	};
}

function canonicalBlockToTiptap(
	block: CanonicalBlock,
	options?: TiptapAdapterOptions,
): JSONContent[] {
	switch (block.type) {
		case "paragraph":
			return [
				{
					type: "paragraph",
					content: block.inlines.flatMap((inline: CanonicalInline) =>
						canonicalInlineToTiptap(inline, options),
					),
				},
			];
		case "heading":
			return [
				{
					type: "heading",
					attrs: { level: block.level },
					content: block.inlines.flatMap((inline: CanonicalInline) =>
						canonicalInlineToTiptap(inline, options),
					),
				},
			];
		case "quote":
			return [
				{
					type: "blockquote",
					content: block.blocks.flatMap((child: CanonicalBlock) =>
						canonicalBlockToTiptap(child, options),
					),
				},
			];
		case "codeBlock":
			return [
				{
					type: "codeBlock",
					attrs: { language: block.language },
					content: [textNode(block.value)],
				},
			];
		case "list":
			return [canonicalListToTiptap(block, options)];
		case "listItem":
			return [
				{
					type: "listItem",
					content: block.blocks.flatMap((child: CanonicalBlock) =>
						canonicalBlockToTiptap(child, options),
					),
				},
			];
		case "table":
			return [
				{
					type: "table",
					content: block.rows.map((row: CanonicalTableRowBlock) =>
						canonicalTableRowToTiptap(row, options),
					),
				},
			];
		case "tableRow":
			return [{ type: "paragraph", content: [textNode("[unsupported:tableRow]")] }];
		case "tableCell":
			return [{ type: "paragraph", content: [textNode("[unsupported:tableCell]")] }];
		case "thematicBreak":
			return [{ type: "horizontalRule" }];
		case "image":
			return [
				{
					type: "image",
					attrs: {
						src: block.url,
						alt: block.alt,
						title: block.title,
					},
				},
			];
		default:
			return [];
	}
}

function textNodeToCanonical(node: JSONContent): CanonicalInline[] {
	const baseValue = node.text ?? "";
	const marks = node.marks ?? [];
	let current: CanonicalInline = { type: "text", value: baseValue };

	for (const mark of marks) {
		switch (mark.type) {
			case "bold":
				current = { type: "strong", inlines: [current] };
				break;
			case "italic":
				current = { type: "emphasis", inlines: [current] };
				break;
			case "strike":
				current = { type: "strike", inlines: [current] };
				break;
			case "code":
				current = { type: "inlineCode", value: baseValue };
				break;
			case "link": {
				const attrs = mark.attrs as Record<string, string | null | undefined> | undefined;
				const wikiTarget = attrs?.["data-wiki-link"];
				if (wikiTarget) {
					current = {
						type: "wikiLink",
						target: wikiTarget,
						label: baseValue,
					};
					break;
				}
				current = {
					type: "link",
					url: attrs?.href ?? "",
					title: attrs?.title ?? null,
					inlines: [current],
				};
				break;
			}
		}
	}

	return [current];
}

function tiptapTableCellToCanonical(node: JSONContent, header: boolean): CanonicalTableCellBlock {
	return {
		type: "tableCell",
		header,
		blocks: (node.content ?? []).flatMap((child: JSONContent) => tiptapNodeToCanonical(child)),
	};
}

function tiptapTableRowToCanonical(node: JSONContent): CanonicalTableRowBlock {
	return {
		type: "tableRow",
		cells: (node.content ?? []).map((child: JSONContent) =>
			tiptapTableCellToCanonical(child, child.type === "tableHeader"),
		),
	};
}

function tiptapNodeToCanonical(node: JSONContent): CanonicalBlock[] {
	switch (node.type) {
		case "paragraph":
			return [
				{
					type: "paragraph",
					inlines: (node.content ?? []).flatMap((child: JSONContent) =>
						tiptapInlineToCanonical(child),
					),
				},
			];
		case "heading": {
			const level = Number(node.attrs?.level ?? 1);
			const clamped = Math.max(1, Math.min(level, 6)) as 1 | 2 | 3 | 4 | 5 | 6;
			return [
				{
					type: "heading",
					level: clamped,
					inlines: (node.content ?? []).flatMap((child: JSONContent) =>
						tiptapInlineToCanonical(child),
					),
				},
			];
		}
		case "blockquote":
			return [
				{
					type: "quote",
					blocks: (node.content ?? []).flatMap((child: JSONContent) =>
						tiptapNodeToCanonical(child),
					),
				},
			];
		case "codeBlock":
			return [
				{
					type: "codeBlock",
					language: (node.attrs?.language as string | undefined) ?? null,
					meta: null,
					value: (node.content ?? []).map((child: JSONContent) => child.text ?? "").join(""),
				},
			];
		case "bulletList":
		case "orderedList":
		case "taskList": {
			const ordered = node.type === "orderedList";
			return [
				{
					type: "list",
					ordered,
					start: Number(node.attrs?.start ?? 1),
					tight: true,
					items: (node.content ?? []).map((child: JSONContent) => ({
						type: "listItem",
						checked:
							node.type === "taskList"
								? Boolean((child.attrs as Record<string, unknown> | undefined)?.checked)
								: null,
						blocks: (child.content ?? []).flatMap((grandchild: JSONContent) =>
							tiptapNodeToCanonical(grandchild),
						),
					})),
				},
			];
		}
		case "table":
			return [
				{
					type: "table",
					rows: (node.content ?? []).map((row: JSONContent) => tiptapTableRowToCanonical(row)),
				},
			];
		case "horizontalRule":
			return [{ type: "thematicBreak" }];
		case "image":
			return [
				{
					type: "image",
					url: String(node.attrs?.src ?? ""),
					alt: String(node.attrs?.alt ?? ""),
					title: (node.attrs?.title as string | undefined) ?? null,
				},
			];
		default:
			return [
				{
					type: "paragraph",
					inlines: [{ type: "text", value: `[unsupported:${node.type ?? "unknown"}]` }],
				},
			];
	}
}

function tiptapInlineToCanonical(node: JSONContent): CanonicalInline[] {
	if (node.type === "text") {
		return textNodeToCanonical(node);
	}

	if (node.type === "hardBreak") {
		return [{ type: "hardBreak" }];
	}

	return [{ type: "text", value: `[unsupported-inline:${node.type ?? "unknown"}]` }];
}

export function canonicalToTiptapDoc(
	document: CanonicalDocument,
	options?: TiptapAdapterOptions,
): TiptapJsonDoc {
	return {
		type: "doc",
		content: document.blocks.flatMap((block: CanonicalBlock) =>
			canonicalBlockToTiptap(block, options),
		),
	};
}

export function tiptapDocToCanonical(document: JSONContent): CanonicalDocument {
	return {
		blocks: (document.content ?? []).flatMap((node: JSONContent) => tiptapNodeToCanonical(node)),
	};
}

export function markdownToTiptapDoc(
	markdown: string,
	options?: TiptapAdapterOptions,
): TiptapJsonDoc {
	return canonicalToTiptapDoc(markdownToCanonical(markdown), options);
}

export function tiptapDocToMarkdown(document: JSONContent): string {
	return canonicalToMarkdown(tiptapDocToCanonical(document));
}
