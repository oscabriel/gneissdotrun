import type { AnyExtension } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

import { DelimiterRolloverExtension } from "./delimiter-rollover";
import { FakeSelectionExtension } from "./fake-selection";
import { listExtensions } from "./list-normalization";
import { ShikiHighlightExtension } from "./shiki-highlight";
import { WikiAwareLinkExtension } from "./wiki-link";

export interface EditorPmExtensionOptions {
	includeFakeSelection?: boolean;
	includeDelimiterRollover?: boolean;
	includeShikiHighlight?: boolean;
}

export function createEditorPmExtensions(options?: EditorPmExtensionOptions): AnyExtension[] {
	const includeFakeSelection = options?.includeFakeSelection ?? true;
	const includeDelimiterRollover = options?.includeDelimiterRollover ?? true;
	const includeShikiHighlight = options?.includeShikiHighlight ?? true;

	const extensions: AnyExtension[] = [
		StarterKit.configure({
			heading: {
				levels: [1, 2, 3, 4, 5, 6],
			},
			link: false,
		}),
		WikiAwareLinkExtension,
		...listExtensions,
	];

	if (includeDelimiterRollover) {
		extensions.push(DelimiterRolloverExtension);
	}

	if (includeShikiHighlight) {
		extensions.push(ShikiHighlightExtension);
	}

	if (includeFakeSelection) {
		extensions.push(FakeSelectionExtension);
	}

	return extensions;
}
