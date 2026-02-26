import { PluginKey } from "@tiptap/pm/state";

export type RolloverMarkName = "bold" | "italic" | "strike";

export type RolloverBoundary = {
	markName: RolloverMarkName;
	pos: number;
	side: "inside" | "outside";
} | null;

export type SourceBlockMode = {
	kind: "top-level" | "list-line" | "quote-line";
	from: number;
	to: number;
	typeName: string;
	listPos?: number;
	itemPos?: number;
	quotePos?: number;
};

export type RolloverPluginState = {
	boundary: RolloverBoundary;
	active: boolean;
	sourceBlock: SourceBlockMode | null;
};

export type RolloverPluginMeta =
	| {
			kind: "set-boundary";
			boundary: RolloverBoundary;
	  }
	| {
			kind: "set-active";
			active: boolean;
	  }
	| {
			kind: "set-source-block";
			sourceBlock: SourceBlockMode | null;
			recheckSelection?: boolean;
	  };

export const markdownDelimiterRolloverPluginKey = new PluginKey<RolloverPluginState>(
	"markdown-delimiter-rollover",
);
