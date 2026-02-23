import { describe, expect, it } from "bun:test";

import {
	createBehaviorEngineState,
	delimiterRolloverBehavior,
	dispatchBehaviorIntent,
	fakeSelectionBehavior,
} from "./index";

describe("behavior engine integration", () => {
	it("tracks left/right boundary movement for delimiter rollover", () => {
		const state = createBehaviorEngineState({
			blocks: [{ type: "paragraph", inlines: [{ type: "text", value: "Hello" }] }],
		});
		state.activeLineText = "**Hello**";

		const selectionChanged = dispatchBehaviorIntent(
			state,
			{
				type: "selection-change",
				selection: {
					anchor: { kind: "line", line: 0, offset: 2 },
					head: { kind: "line", line: 0, offset: 2 },
				},
			},
			[delimiterRolloverBehavior],
		);
		expect(selectionChanged.state.delimiterBoundary?.mark).toBe("strong");

		const moved = dispatchBehaviorIntent(
			selectionChanged.state,
			{
				type: "keydown",
				key: "ArrowLeft",
			},
			[delimiterRolloverBehavior],
		);
		expect(moved.state.delimiterBoundary?.side).toBe("inside");
	});

	it("preserves fake selection through blur/focus flow", () => {
		const state = createBehaviorEngineState({
			blocks: [{ type: "paragraph", inlines: [{ type: "text", value: "Hello" }] }],
		});

		const selected = dispatchBehaviorIntent(
			state,
			{
				type: "selection-change",
				selection: {
					anchor: { kind: "line", line: 0, offset: 1 },
					head: { kind: "line", line: 0, offset: 5 },
				},
			},
			[fakeSelectionBehavior],
		);

		const blurred = dispatchBehaviorIntent(selected.state, { type: "blur" }, [
			fakeSelectionBehavior,
		]);
		expect(blurred.state.fakeSelection).not.toBeNull();

		const focused = dispatchBehaviorIntent(blurred.state, { type: "focus" }, [
			fakeSelectionBehavior,
		]);
		expect(focused.state.fakeSelection).toBeNull();
	});
});
