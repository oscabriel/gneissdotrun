import type { BehaviorModule } from "./types";

export const fakeSelectionBehavior: BehaviorModule = {
	name: "fake-selection",
	handle: (state, intent) => {
		if (intent.type === "selection-change") {
			return {
				state: {
					...state,
					selection: intent.selection,
				},
				operations: [
					{
						type: "set-fake-selection",
						range: null,
					},
				],
			};
		}

		if (intent.type === "blur") {
			const range = {
				start: state.selection.anchor,
				end: state.selection.head,
			};
			return {
				state: {
					...state,
					fakeSelection: range,
				},
				operations: [
					{
						type: "set-fake-selection",
						range,
					},
					{
						type: "set-decoration-intent",
						name: "fake-selection",
						payload: {
							active: true,
						},
					},
				],
			};
		}

		if (intent.type === "focus") {
			return {
				state: {
					...state,
					fakeSelection: null,
				},
				operations: [
					{
						type: "set-fake-selection",
						range: null,
					},
					{
						type: "set-decoration-intent",
						name: "fake-selection",
						payload: {
							active: false,
						},
					},
				],
			};
		}

		return null;
	},
};
