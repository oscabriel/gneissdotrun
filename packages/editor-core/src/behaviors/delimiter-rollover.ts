import type { BehaviorEngineState, BehaviorModule, DelimiterBoundaryState } from "./types";

const DELIMITER_PRECEDENCE: Array<{
	mark: DelimiterBoundaryState["mark"];
	delimiter: string;
}> = [
	{ mark: "inlineCode", delimiter: "`" },
	{ mark: "strong", delimiter: "**" },
	{ mark: "strike", delimiter: "~~" },
	{ mark: "emphasis", delimiter: "*" },
];

function currentLineOffset(state: BehaviorEngineState): number | null {
	const head = state.selection.head;
	if (head.kind !== "line") {
		return null;
	}
	return head.offset;
}

export function getDelimiterBoundaryState(
	state: BehaviorEngineState,
): DelimiterBoundaryState | null {
	const offset = currentLineOffset(state);
	if (offset === null) {
		return null;
	}

	for (const entry of DELIMITER_PRECEDENCE) {
		const { delimiter, mark } = entry;
		const before = state.activeLineText.slice(Math.max(0, offset - delimiter.length), offset);
		if (before === delimiter) {
			return {
				mark,
				side: "outside",
				offset,
			};
		}

		const after = state.activeLineText.slice(offset, offset + delimiter.length);
		if (after === delimiter) {
			return {
				mark,
				side: "inside",
				offset,
			};
		}
	}

	return null;
}

function toggleBoundarySide(side: DelimiterBoundaryState["side"]): DelimiterBoundaryState["side"] {
	return side === "inside" ? "outside" : "inside";
}

export const delimiterRolloverBehavior: BehaviorModule = {
	name: "delimiter-rollover",
	handle: (state, intent) => {
		if (intent.type === "selection-change") {
			const boundary = getDelimiterBoundaryState({
				...state,
				selection: intent.selection,
			});
			return {
				state: {
					...state,
					selection: intent.selection,
					delimiterBoundary: boundary,
				},
				operations: [
					{
						type: "set-delimiter-boundary",
						boundary,
					},
				],
			};
		}

		if (intent.type === "keydown") {
			if (!state.delimiterBoundary) {
				return null;
			}

			if (intent.key === "ArrowLeft" || intent.key === "ArrowRight") {
				const nextBoundary = {
					...state.delimiterBoundary,
					side: toggleBoundarySide(state.delimiterBoundary.side),
				};
				return {
					state: {
						...state,
						delimiterBoundary: nextBoundary,
					},
					operations: [
						{
							type: "set-delimiter-boundary",
							boundary: nextBoundary,
						},
						{
							type: "set-decoration-intent",
							name: "delimiter-rollover",
							payload: {
								offset: nextBoundary.offset,
								inside: nextBoundary.side === "inside",
							},
						},
					],
				};
			}

			if (intent.key === "Backspace" || intent.key === "Delete") {
				return {
					state,
					operations: [
						{
							type: "replace-range",
							range: {
								start: state.selection.anchor,
								end: state.selection.head,
							},
							text: "",
						},
					],
				};
			}
		}

		if (intent.type === "input") {
			return {
				state: {
					...state,
					delimiterBoundary: null,
				},
				operations: [
					{
						type: "set-delimiter-boundary",
						boundary: null,
					},
				],
			};
		}

		return null;
	},
};
