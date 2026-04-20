import { parseMarkdownToCanonical } from "./markdown/parse";
import type { MarkdownParseOptions } from "./markdown/types";
import type {
	CanonicalBlock,
	CanonicalDocument,
	CanonicalInline,
	CanonicalListItemBlock,
	CanonicalTableCellBlock,
	CanonicalTableRowBlock,
} from "./model/document";

function normalizePreviewText(value: string): string {
	return value
		.replace(/\r\n?/g, "\n")
		.replace(/[ \t]+\n/g, "\n")
		.replace(/\n[ \t]+/g, "\n")
		.replace(/[ \t]{2,}/g, " ")
		.trim();
}

function inlineToPreviewText(inline: CanonicalInline): string {
	switch (inline.type) {
		case "text":
		case "inlineCode":
			return inline.value;
		case "strong":
		case "emphasis":
		case "strike":
		case "link":
			return inline.inlines.map((child) => inlineToPreviewText(child)).join("");
		case "wikiLink":
			return inline.label || inline.target;
		case "hardBreak":
			return "\n";
	}
	return "";
}

function inlinesToPreviewText(inlines: CanonicalInline[]): string {
	return normalizePreviewText(inlines.map((inline) => inlineToPreviewText(inline)).join(""));
}

function listItemToPreviewLines(
	item: CanonicalListItemBlock,
	ordered: boolean,
	index: number,
): string[] {
	const marker =
		item.checked === null ? (ordered ? `${index + 1}. ` : "- ") : item.checked ? "[x] " : "[ ] ";
	const itemLines = blocksToPreviewLines(item.blocks);
	if (itemLines.length === 0) {
		return [marker.trim()];
	}

	const [firstLine, ...remainingLines] = itemLines;
	return [`${marker}${firstLine}`, ...remainingLines];
}

function tableCellToPreviewText(cell: CanonicalTableCellBlock): string {
	return normalizePreviewText(blocksToPreviewLines(cell.blocks).join(" "));
}

function tableRowToPreviewText(row: CanonicalTableRowBlock): string {
	return row.cells
		.map((cell) => tableCellToPreviewText(cell))
		.filter((cellText) => cellText.length > 0)
		.join(" | ");
}

function blockToPreviewLines(block: CanonicalBlock): string[] {
	switch (block.type) {
		case "paragraph": {
			const text = inlinesToPreviewText(block.inlines);
			return text ? [text] : [];
		}
		case "heading": {
			const text = inlinesToPreviewText(block.inlines);
			return text ? [text] : [];
		}
		case "quote":
			return blocksToPreviewLines(block.blocks);
		case "codeBlock": {
			const text = normalizePreviewText(block.value);
			return text ? [text] : [];
		}
		case "list":
			return block.items.flatMap((item, index) => listItemToPreviewLines(item, block.ordered, index));
		case "listItem":
			return blocksToPreviewLines(block.blocks);
		case "table":
			return block.rows
				.map((row) => tableRowToPreviewText(row))
				.filter((rowText) => rowText.length > 0);
		case "tableRow": {
			const text = tableRowToPreviewText(block);
			return text ? [text] : [];
		}
		case "tableCell": {
			const text = tableCellToPreviewText(block);
			return text ? [text] : [];
		}
		case "thematicBreak":
			return [];
		case "image": {
			const text = normalizePreviewText(block.alt || block.title || "Image");
			return text ? [text] : [];
		}
	}
	return [];
}

function blocksToPreviewLines(blocks: CanonicalBlock[]): string[] {
	return blocks
		.flatMap((block) => blockToPreviewLines(block))
		.map((line) => normalizePreviewText(line))
		.filter((line) => line.length > 0);
}

export function canonicalToPreviewText(document: CanonicalDocument): string {
	return blocksToPreviewLines(document.blocks).join("\n\n");
}

export function markdownToPreviewText(markdown: string, options?: MarkdownParseOptions): string {
	return canonicalToPreviewText(parseMarkdownToCanonical(markdown, options));
}
