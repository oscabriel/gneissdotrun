import type {
	CanonicalBlock,
	CanonicalDocument,
	CanonicalHeadingBlock,
	CanonicalListBlock,
	CanonicalListItemBlock,
	CanonicalParagraphBlock,
} from "../model/document";

function paragraphFromBlock(block: CanonicalBlock): CanonicalParagraphBlock {
	if (block.type === "paragraph") {
		return block;
	}

	if (block.type === "heading") {
		return {
			type: "paragraph",
			inlines: block.inlines,
		};
	}

	return {
		type: "paragraph",
		inlines: [
			{
				type: "text",
				value: "",
			},
		],
	};
}

function headingFromBlock(
	block: CanonicalBlock,
	level: CanonicalHeadingBlock["level"],
): CanonicalHeadingBlock {
	if (block.type === "heading" && block.level === level) {
		return {
			type: "heading",
			level,
			inlines: block.inlines,
		};
	}

	if (block.type === "paragraph") {
		return {
			type: "heading",
			level,
			inlines: block.inlines,
		};
	}

	return {
		type: "heading",
		level,
		inlines: [
			{
				type: "text",
				value: "",
			},
		],
	};
}

function mapBlockAtIndex(
	document: CanonicalDocument,
	index: number,
	mapper: (block: CanonicalBlock) => CanonicalBlock,
): CanonicalDocument {
	return {
		blocks: document.blocks.map((block, blockIndex) =>
			blockIndex === index ? mapper(block) : block,
		),
	};
}

export function toggleHeadingBlock(
	document: CanonicalDocument,
	index: number,
	level: CanonicalHeadingBlock["level"],
): CanonicalDocument {
	return mapBlockAtIndex(document, index, (block) => {
		if (block.type === "heading" && block.level === level) {
			return paragraphFromBlock(block);
		}

		return headingFromBlock(block, level);
	});
}

export function toggleQuoteBlock(document: CanonicalDocument, index: number): CanonicalDocument {
	return mapBlockAtIndex(document, index, (block) => {
		if (block.type === "quote") {
			return (
				block.blocks[0] ?? {
					type: "paragraph",
					inlines: [],
				}
			);
		}

		return {
			type: "quote",
			blocks: [paragraphFromBlock(block)],
		};
	});
}

function listFromBlock(
	block: CanonicalBlock,
	options: { ordered: boolean; task: boolean },
): CanonicalListBlock {
	const item: CanonicalListItemBlock = {
		type: "listItem",
		checked: options.task ? false : null,
		blocks: [paragraphFromBlock(block)],
	};
	return {
		type: "list",
		ordered: options.ordered,
		start: 1,
		tight: true,
		items: [item],
	};
}

export function toggleListBlock(
	document: CanonicalDocument,
	index: number,
	options: { ordered: boolean; task: boolean },
): CanonicalDocument {
	return mapBlockAtIndex(document, index, (block) => {
		if (block.type === "list" && block.ordered === options.ordered) {
			const firstItem = block.items[0];
			return (
				firstItem?.blocks[0] ?? {
					type: "paragraph",
					inlines: [],
				}
			);
		}

		return listFromBlock(block, options);
	});
}

export function clearOrderedListTaskMarkers(document: CanonicalDocument): CanonicalDocument {
	return {
		blocks: document.blocks.map((block) => {
			if (block.type !== "list" || !block.ordered) {
				return block;
			}

			return {
				...block,
				items: block.items.map((item) => ({
					...item,
					checked: null,
				})),
			};
		}),
	};
}
