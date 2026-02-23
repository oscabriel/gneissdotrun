import type { CanonicalDocument } from "../model/document";

export type BehaviorCursorAddress =
	| {
			kind: "line";
			line: number;
			offset: number;
	  }
	| {
			kind: "tree";
			path: number[];
			offset: number;
	  };

export interface BehaviorSelection {
	anchor: BehaviorCursorAddress;
	head: BehaviorCursorAddress;
}

export interface BehaviorRange {
	start: BehaviorCursorAddress;
	end: BehaviorCursorAddress;
}

export type BehaviorIntent =
	| {
			type: "keydown";
			key: "ArrowLeft" | "ArrowRight" | "Backspace" | "Delete" | "Enter" | "Tab";
	  }
	| {
			type: "input";
			text: string;
	  }
	| {
			type: "selection-change";
			selection: BehaviorSelection;
	  }
	| {
			type: "focus";
	  }
	| {
			type: "blur";
	  }
	| {
			type: "normalize-lists";
	  };

export type BehaviorOperation =
	| {
			type: "set-selection";
			selection: BehaviorSelection;
	  }
	| {
			type: "replace-range";
			range: BehaviorRange;
			text: string;
	  }
	| {
			type: "set-delimiter-boundary";
			boundary: DelimiterBoundaryState | null;
	  }
	| {
			type: "set-fake-selection";
			range: BehaviorRange | null;
	  }
	| {
			type: "set-decoration-intent";
			name: "delimiter-rollover" | "fake-selection";
			payload: Record<string, string | number | boolean | null>;
	  }
	| {
			type: "replace-document";
			document: CanonicalDocument;
	  };

export interface DelimiterBoundaryState {
	mark: "strong" | "emphasis" | "strike" | "inlineCode";
	side: "inside" | "outside";
	offset: number;
}

export interface BehaviorEngineState {
	document: CanonicalDocument;
	selection: BehaviorSelection;
	activeLineText: string;
	delimiterBoundary: DelimiterBoundaryState | null;
	fakeSelection: BehaviorRange | null;
}

export interface BehaviorResult {
	state: BehaviorEngineState;
	operations: BehaviorOperation[];
}

export interface BehaviorModule {
	name: string;
	handle: (state: BehaviorEngineState, intent: BehaviorIntent) => BehaviorResult | null;
}

export function createDefaultSelection(): BehaviorSelection {
	return {
		anchor: {
			kind: "line",
			line: 0,
			offset: 0,
		},
		head: {
			kind: "line",
			line: 0,
			offset: 0,
		},
	};
}
