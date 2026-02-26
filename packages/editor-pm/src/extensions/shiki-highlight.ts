import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { createHighlighter, type BundledLanguage } from "shiki";

const LANGUAGES_TO_LOAD = [
	"bash",
	"css",
	"go",
	"html",
	"javascript",
	"json",
	"jsx",
	"markdown",
	"python",
	"rust",
	"sql",
	"tsx",
	"typescript",
	"yaml",
] as const;

const SUPPORTED_LANG_IDS = new Set<string>([
	...LANGUAGES_TO_LOAD,
	"js",
	"ts",
	"sh",
	"py",
	"md",
	"yml",
]);

export const shikiHighlightPluginKey = new PluginKey<DecorationSet>("shiki-highlight");

let sharedHighlighterPromise: ReturnType<typeof createHighlighter> | null = null;

function getOrCreateHighlighter(): ReturnType<typeof createHighlighter> {
	if (!sharedHighlighterPromise) {
		sharedHighlighterPromise = createHighlighter({
			themes: ["github-light", "github-dark"],
			langs: [...LANGUAGES_TO_LOAD],
		});
	}
	return sharedHighlighterPromise;
}

function buildShikiDecorations(
	state: EditorState,
	highlighter: Awaited<ReturnType<typeof createHighlighter>>,
): DecorationSet {
	const decorations: Decoration[] = [];

	state.doc.descendants((node, pos) => {
		if (node.type.name !== "codeBlock") {
			return;
		}

		const lang = node.attrs.language as string | null;
		if (!lang || !SUPPORTED_LANG_IDS.has(lang)) {
			return;
		}

		const code = node.textContent;
		if (!code) {
			return;
		}

		try {
			const tokens = highlighter.codeToTokensWithThemes(code, {
				lang: lang as BundledLanguage,
				themes: {
					light: "github-light",
					dark: "github-dark",
				},
			});

			const contentStart = pos + 1;
			for (const line of tokens) {
				for (const token of line) {
					if (token.content.length === 0) {
						continue;
					}
					const lightColor = token.variants["light"]?.color;
					const darkColor = token.variants["dark"]?.color;
					if (lightColor || darkColor) {
						decorations.push(
							Decoration.inline(
								contentStart + token.offset,
								contentStart + token.offset + token.content.length,
								{
									style: `--shiki-light:${lightColor ?? "inherit"};--shiki-dark:${darkColor ?? "inherit"}`,
									class: "shiki-token",
								},
							),
						);
					}
				}
			}
		} catch {
			// Skip blocks that fail to tokenize
		}
	});

	if (decorations.length === 0) {
		return DecorationSet.empty;
	}

	return DecorationSet.create(state.doc, decorations);
}

export const ShikiHighlightExtension = Extension.create({
	name: "shikiHighlight",

	addProseMirrorPlugins() {
		type Highlighter = Awaited<ReturnType<typeof createHighlighter>>;
		let highlighter: Highlighter | null = null;
		const editorRef = this.editor;

		getOrCreateHighlighter()
			.then((h) => {
				highlighter = h;
				if (!editorRef.isDestroyed) {
					editorRef.view.dispatch(
						editorRef.view.state.tr.setMeta(shikiHighlightPluginKey, true),
					);
				}
			})
			.catch(() => {
				// Highlighter failed to load; syntax highlighting unavailable
			});

		return [
			new Plugin<DecorationSet>({
				key: shikiHighlightPluginKey,
				state: {
					init: () => DecorationSet.empty,
					apply: (tr, old, _oldState, newState) => {
						if (!highlighter) {
							return DecorationSet.empty;
						}
						if (!tr.docChanged && !tr.getMeta(shikiHighlightPluginKey)) {
							return old;
						}
						return buildShikiDecorations(newState, highlighter);
					},
				},
				props: {
					decorations: (state) => {
						return shikiHighlightPluginKey.getState(state) ?? DecorationSet.empty;
					},
				},
			}),
		];
	},
});
