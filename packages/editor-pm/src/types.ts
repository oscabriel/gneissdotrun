import type { JSONContent } from "@tiptap/core";

export type ProseMirrorJsonDoc = JSONContent & {
	type: "doc";
};

export interface EditorPmAdapterOptions {
	wikiHrefPrefix?: string;
}
