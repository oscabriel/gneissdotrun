import { describe, expect, it } from "bun:test";

import {
	clearOrderedListTaskMarkers,
	createBehaviorEngineState,
	delimiterRolloverBehavior,
	dispatchBehaviorIntent,
	fakeSelectionBehavior,
	getDelimiterBoundaryState,
	listNormalizationBehavior,
	normalizeListSemantics,
	toggleHeadingBlock,
	toggleListBlock,
	toggleQuoteBlock,
	type CanonicalDocument,
} from "./index";

function createDocument(): CanonicalDocument {
	return {
		blocks: [
			{
				type: "paragraph",
				inlines: [{ type: "text", value: "hello **world**" }],
			},
		],
	};
}

describe("behavior modules", () => {
	it("detects delimiter boundaries", () => {
		const state = createBehaviorEngineState(createDocument());
		state.activeLineText = "Hello **world**";
		state.selection = {
			anchor: { kind: "line", line: 0, offset: 8 },
			head: { kind: "line", line: 0, offset: 8 },
		};

		const boundary = getDelimiterBoundaryState(state);
		expect(boundary).toEqual({ mark: "strong", offset: 8, side: "outside" });
	});

	it("stores fake selection on blur and clears on focus", () => {
		const state = createBehaviorEngineState(createDocument());
		state.selection = {
			anchor: { kind: "line", line: 0, offset: 1 },
			head: { kind: "line", line: 0, offset: 4 },
		};

		const blurred = dispatchBehaviorIntent(state, { type: "blur" }, [fakeSelectionBehavior]);
		expect(blurred.state.fakeSelection).not.toBeNull();

		const focused = dispatchBehaviorIntent(blurred.state, { type: "focus" }, [
			fakeSelectionBehavior,
		]);
		expect(focused.state.fakeSelection).toBeNull();
	});

	it("normalizes ordered list task markers", () => {
		const normalized = normalizeListSemantics({
			blocks: [
				{
					type: "list",
					ordered: true,
					start: 1,
					tight: true,
					items: [
						{
							type: "listItem",
							checked: true,
							blocks: [{ type: "paragraph", inlines: [{ type: "text", value: "a" }] }],
						},
					],
				},
			],
		});

		const list = normalized.blocks[0];
		expect(list?.type).toBe("list");
		if (list?.type !== "list") {
			throw new Error("expected list");
		}
		expect(list.items[0]?.checked).toBeNull();
	});

	it("applies command helpers", () => {
		const doc: CanonicalDocument = {
			blocks: [{ type: "paragraph", inlines: [{ type: "text", value: "hello" }] }],
		};

		const heading = toggleHeadingBlock(doc, 0, 2);
		expect(heading.blocks[0]).toEqual({
			type: "heading",
			level: 2,
			inlines: [{ type: "text", value: "hello" }],
		});

		const quoted = toggleQuoteBlock(doc, 0);
		expect(quoted.blocks[0]?.type).toBe("quote");

		const list = toggleListBlock(doc, 0, { ordered: false, task: true });
		expect(list.blocks[0]?.type).toBe("list");

		const cleared = clearOrderedListTaskMarkers({
			blocks: [
				{
					type: "list",
					ordered: true,
					start: 1,
					tight: true,
					items: [
						{
							type: "listItem",
							checked: true,
							blocks: [{ type: "paragraph", inlines: [{ type: "text", value: "x" }] }],
						},
					],
				},
			],
		});
		const ordered = cleared.blocks[0];
		if (ordered?.type !== "list") {
			throw new Error("expected list");
		}
		expect(ordered.items[0]?.checked).toBeNull();
	});

	it("supports normalization via behavior engine", () => {
		const state = createBehaviorEngineState({
			blocks: [
				{
					type: "list",
					ordered: false,
					start: 1,
					tight: true,
					items: [
						{
							type: "listItem",
							checked: false,
							blocks: [{ type: "paragraph", inlines: [{ type: "text", value: "a" }] }],
						},
					],
				},
			],
		});
		const result = dispatchBehaviorIntent(state, { type: "normalize-lists" }, [
			listNormalizationBehavior,
		]);
		expect(result.operations[0]).toEqual(
			expect.objectContaining({
				type: "replace-document",
			}),
		);
	});

	it("handles delimiter keyboard transitions", () => {
		const state = createBehaviorEngineState(createDocument());
		state.delimiterBoundary = {
			mark: "strong",
			side: "inside",
			offset: 8,
		};
		const result = dispatchBehaviorIntent(state, { type: "keydown", key: "ArrowRight" }, [
			delimiterRolloverBehavior,
		]);
		expect(result.state.delimiterBoundary?.side).toBe("outside");
	});
});
