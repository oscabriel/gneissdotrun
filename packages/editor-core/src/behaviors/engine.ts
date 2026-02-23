import type { CanonicalDocument } from "../model/document";
import type {
	BehaviorEngineState,
	BehaviorIntent,
	BehaviorModule,
	BehaviorOperation,
	BehaviorResult,
} from "./types";
import { createDefaultSelection } from "./types";

export function createBehaviorEngineState(document: CanonicalDocument): BehaviorEngineState {
	return {
		document,
		selection: createDefaultSelection(),
		activeLineText: "",
		delimiterBoundary: null,
		fakeSelection: null,
	};
}

function applyOperation(
	state: BehaviorEngineState,
	operation: BehaviorOperation,
): BehaviorEngineState {
	switch (operation.type) {
		case "set-selection":
			return {
				...state,
				selection: operation.selection,
			};
		case "set-delimiter-boundary":
			return {
				...state,
				delimiterBoundary: operation.boundary,
			};
		case "set-fake-selection":
			return {
				...state,
				fakeSelection: operation.range,
			};
		case "replace-document":
			return {
				...state,
				document: operation.document,
			};
		case "replace-range":
		case "set-decoration-intent":
			return state;
	}
}

export function dispatchBehaviorIntent(
	state: BehaviorEngineState,
	intent: BehaviorIntent,
	modules: BehaviorModule[],
): BehaviorResult {
	let nextState = state;
	const operations: BehaviorOperation[] = [];

	for (const module of modules) {
		const result = module.handle(nextState, intent);
		if (!result) {
			continue;
		}

		nextState = result.state;
		operations.push(...result.operations);
	}

	for (const operation of operations) {
		nextState = applyOperation(nextState, operation);
	}

	if (intent.type === "selection-change") {
		nextState = {
			...nextState,
			selection: intent.selection,
		};
	}

	return {
		state: nextState,
		operations,
	};
}
