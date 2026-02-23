import type { JSONContent } from "@tiptap/core";
import {
	canonicalToMarkdown,
	markdownToCanonical,
	type CanonicalBlock,
	type CanonicalDocument,
	type CanonicalInline,
} from "@gneissdotrun/editor-core";

import type { EditorPmAdapterOptions, ProseMirrorJsonDoc } from "./types";

const DEFAULT_WIKI_HREF_PREFIX = "/collections?query=";

function textNode(text: string, marks?: JSONContent["marks"]): JSONContent {
	return {
		type: "text",
		text,
		marks,
	};
}

function canonicalInlineToPm(
	inline: CanonicalInline,
	options?: EditorPmAdapterOptions,
): JSONContent[] {
	const wikiHrefPrefix = options?.wikiHrefPrefix ?? DEFAULT_WIKI_HREF_PREFIX;
	switch (inline.type) {
		case "text":
			return [textNode(inline.value)];
		case "inlineCode":
			return [
				textNode(inline.value, [
					{
						type: "code",
					},
				]),
			];
		case "hardBreak":
			return [
				{
					type: "hardBreak",
				},
			];
		case "strong":
			return inline.inlines.flatMap((child) => {
				return canonicalInlineToPm(child, options).map((node) => {
					if (node.type !== "text") {
						return node;
					}
					return {
						...node,
						marks: [...(node.marks ?? []), { type: "bold" }],
					};
				});
			});
		case "emphasis":
			return inline.inlines.flatMap((child) => {
				return canonicalInlineToPm(child, options).map((node) => {
					if (node.type !== "text") {
						return node;
					}
					return {
						...node,
						marks: [...(node.marks ?? []), { type: "italic" }],
					};
				});
			});
		case "strike":
			return inline.inlines.flatMap((child) => {
				return canonicalInlineToPm(child, options).map((node) => {
					if (node.type !== "text") {
						return node;
					}
					return {
						...node,
						marks: [...(node.marks ?? []), { type: "strike" }],
					};
				});
			});
		case "link":
			return inline.inlines.flatMap((child) => {
				return canonicalInlineToPm(child, options).map((node) => {
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
				});
			});
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
	}
}

function canonicalListToPm(
	block: Extract<CanonicalBlock, { type: "list" }>,
	options?: EditorPmAdapterOptions,
): JSONContent {
	const hasTaskItems = !block.ordered && block.items.some((item) => item.checked !== null);
	const listType = hasTaskItems ? "taskList" : block.ordered ? "orderedList" : "bulletList";
	return {
		type: listType,
		attrs: block.ordered ? { start: block.start } : undefined,
		content: block.items.map((item) => {
			const itemType = hasTaskItems ? "taskItem" : "listItem";
			return {
				type: itemType,
				attrs: hasTaskItems ? { checked: item.checked ?? false } : undefined,
				content: item.blocks.flatMap((child) => canonicalBlockToPm(child, options)),
			};
		}),
	};
}

function canonicalBlockToPm(
	block: CanonicalBlock,
	options?: EditorPmAdapterOptions,
): JSONContent[] {
	switch (block.type) {
		case "paragraph":
			return [
				{
					type: "paragraph",
					content: block.inlines.flatMap((inline) => canonicalInlineToPm(inline, options)),
				},
			];
		case "heading":
			return [
				{
					type: "heading",
					attrs: { level: block.level },
					content: block.inlines.flatMap((inline) => canonicalInlineToPm(inline, options)),
				},
			];
		case "quote":
			return [
				{
					type: "blockquote",
					content: block.blocks.flatMap((child) => canonicalBlockToPm(child, options)),
				},
			];
		case "codeBlock":
			return [
				{
					type: "codeBlock",
					attrs: {
						language: block.language,
					},
					content: [textNode(block.value)],
				},
			];
		case "list":
			return [canonicalListToPm(block, options)];
		case "listItem":
			return [
				{
					type: "listItem",
					content: block.blocks.flatMap((child) => canonicalBlockToPm(child, options)),
				},
			];
		case "thematicBreak":
			return [
				{
					type: "horizontalRule",
				},
			];
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
	}
}

function textNodeToCanonical(node: JSONContent): CanonicalInline[] {
	const baseValue = node.text ?? "";
	const marks = node.marks ?? [];
	let current: CanonicalInline = {
		type: "text",
		value: baseValue,
	};

	for (const mark of marks) {
		switch (mark.type) {
			case "bold": {
				current = {
					type: "strong",
					inlines: [current],
				};
				break;
			}
			case "italic": {
				current = {
					type: "emphasis",
					inlines: [current],
				};
				break;
			}
			case "strike": {
				current = {
					type: "strike",
					inlines: [current],
				};
				break;
			}
			case "code": {
				current = {
					type: "inlineCode",
					value: baseValue,
				};
				break;
			}
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

function pmNodeToCanonical(node: JSONContent): CanonicalBlock[] {
	switch (node.type) {
		case "paragraph":
			return [
				{
					type: "paragraph",
					inlines: (node.content ?? []).flatMap((child) => pmInlineToCanonical(child)),
				},
			];
		case "heading": {
			const level = Number(node.attrs?.level ?? 1);
			const clamped = Math.max(1, Math.min(level, 6)) as 1 | 2 | 3 | 4 | 5 | 6;
			return [
				{
					type: "heading",
					level: clamped,
					inlines: (node.content ?? []).flatMap((child) => pmInlineToCanonical(child)),
				},
			];
		}
		case "blockquote":
			return [
				{
					type: "quote",
					blocks: (node.content ?? []).flatMap((child) => pmNodeToCanonical(child)),
				},
			];
		case "codeBlock":
			return [
				{
					type: "codeBlock",
					language: (node.attrs?.language as string | undefined) ?? null,
					meta: null,
					value: (node.content ?? []).map((child) => child.text ?? "").join(""),
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
					items: (node.content ?? []).map((child) => {
						const checked =
							node.type === "taskList"
								? Boolean((child.attrs as Record<string, unknown> | undefined)?.checked)
								: null;
						return {
							type: "listItem",
							checked,
							blocks: (child.content ?? []).flatMap((grandchild) => pmNodeToCanonical(grandchild)),
						};
					}),
				},
			];
		}
		case "horizontalRule":
			return [
				{
					type: "thematicBreak",
				},
			];
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
					inlines: [
						{
							type: "text",
							value: `[unsupported:${node.type ?? "unknown"}]`,
						},
					],
				},
			];
	}
}

function pmInlineToCanonical(node: JSONContent): CanonicalInline[] {
	if (node.type === "text") {
		return textNodeToCanonical(node);
	}

	if (node.type === "hardBreak") {
		return [
			{
				type: "hardBreak",
			},
		];
	}

	return [
		{
			type: "text",
			value: `[unsupported-inline:${node.type ?? "unknown"}]`,
		},
	];
}

export function canonicalToPmDoc(
	document: CanonicalDocument,
	options?: EditorPmAdapterOptions,
): ProseMirrorJsonDoc {
	return {
		type: "doc",
		content: document.blocks.flatMap((block) => canonicalBlockToPm(block, options)),
	};
}

export function pmDocToCanonical(document: JSONContent): CanonicalDocument {
	const content = document.content ?? [];
	return {
		blocks: content.flatMap((node) => pmNodeToCanonical(node)),
	};
}

export function markdownToPmDoc(
	markdown: string,
	options?: EditorPmAdapterOptions,
): ProseMirrorJsonDoc {
	return canonicalToPmDoc(markdownToCanonical(markdown), options);
}

export function pmDocToMarkdown(document: JSONContent): string {
	return canonicalToMarkdown(pmDocToCanonical(document));
}
