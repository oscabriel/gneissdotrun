import type {
	CanonicalBlock,
	CanonicalDocument,
	CanonicalListBlock,
	CanonicalListItemBlock,
} from "../model/document";
import type { BehaviorModule } from "./types";

function normalizeListItem(
	list: CanonicalListBlock,
	item: CanonicalListItemBlock,
): CanonicalListItemBlock {
	const checked = list.ordered ? null : item.checked;
	return {
		...item,
		checked,
		blocks: item.blocks.map((block) => normalizeBlock(block)),
	};
}

function canJoinLists(a: CanonicalListBlock, b: CanonicalListBlock): boolean {
	return a.ordered === b.ordered && a.ordered ? a.start + a.items.length === b.start : true;
}

function normalizeList(list: CanonicalListBlock): CanonicalListBlock {
	return {
		...list,
		items: list.items.map((item) => normalizeListItem(list, item)),
	};
}

function normalizeBlock(block: CanonicalBlock): CanonicalBlock {
	switch (block.type) {
		case "quote": {
			return {
				...block,
				blocks: normalizeBlocks(block.blocks),
			};
		}
		case "list": {
			return normalizeList(block);
		}
		default:
			return block;
	}
}

function normalizeBlocks(blocks: CanonicalBlock[]): CanonicalBlock[] {
	const normalized: CanonicalBlock[] = [];

	for (const block of blocks) {
		const next = normalizeBlock(block);
		const previous = normalized[normalized.length - 1];
		if (previous?.type === "list" && next.type === "list" && canJoinLists(previous, next)) {
			normalized[normalized.length - 1] = {
				...previous,
				items: [...previous.items, ...next.items],
			};
			continue;
		}
		normalized.push(next);
	}

	return normalized;
}

export function normalizeListSemantics(document: CanonicalDocument): CanonicalDocument {
	return {
		blocks: normalizeBlocks(document.blocks),
	};
}

export const listNormalizationBehavior: BehaviorModule = {
	name: "list-normalization",
	handle: (state, intent) => {
		if (intent.type !== "normalize-lists") {
			return null;
		}

		const document = normalizeListSemantics(state.document);
		return {
			state: {
				...state,
				document,
			},
			operations: [
				{
					type: "replace-document",
					document,
				},
			],
		};
	},
};
