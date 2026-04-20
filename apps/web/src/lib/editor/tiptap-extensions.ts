import { Extension, type AnyExtension } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import StarterKit from "@tiptap/starter-kit";
import {
	getSlashCommandClassName,
	getSlashCommandPresentation,
} from "@/lib/editor/slash-command-presentation";

export const WikiAwareLinkExtension = Link.extend({
	name: "link",
	addAttributes() {
		const parentAttributes = this.parent?.() ?? {};
		return {
			...parentAttributes,
			"data-wiki-link": {
				default: null,
				parseHTML: (element: Element) => element.getAttribute("data-wiki-link"),
				renderHTML: (attributes: Record<string, unknown>) => {
					const target = attributes["data-wiki-link"];
					return target ? { "data-wiki-link": target } : {};
				},
			},
		};
	},
}).configure({
	openOnClick: false,
	autolink: true,
	linkOnPaste: true,
});

function buildSlashCommandDecorations(doc: ProseMirrorNode): DecorationSet {
	const decorations: Decoration[] = [];

	doc.descendants((node, pos) => {
		if (node.type.name !== "paragraph") {
			return;
		}

		const presentation = getSlashCommandPresentation(node.textContent);
		if (!presentation) {
			return;
		}

		decorations.push(
			Decoration.node(pos, pos + node.nodeSize, {
				class: getSlashCommandClassName(presentation.kind),
				"data-command-kind": presentation.kind,
				...(presentation.isKnown ? { "data-command-label": presentation.label } : {}),
			}),
		);
	});

	return DecorationSet.create(doc, decorations);
}

export const SlashCommandLineExtension = Extension.create({
	name: "slashCommandLine",
	addProseMirrorPlugins() {
		return [
			new Plugin({
				props: {
					decorations: (state) => buildSlashCommandDecorations(state.doc),
				},
			}),
		];
	},
});

const shikiCodeBlockPluginKey = new PluginKey<DecorationSet>("shikiCodeBlockHighlight");

async function buildCodeBlockDecorations(doc: ProseMirrorNode): Promise<DecorationSet> {
	const decorations: Decoration[] = [];
	const codeBlocks: Array<{ code: string; language: string | null; pos: number }> = [];

	doc.descendants((node, pos) => {
		if (node.type.name !== "codeBlock") {
			return;
		}

		codeBlocks.push({
			code: node.textContent,
			language: typeof node.attrs.language === "string" ? node.attrs.language : null,
			pos,
		});
	});

	if (codeBlocks.length === 0) {
		return DecorationSet.empty;
	}

	const { highlightCodeToTokens } = await import("@/lib/editor/shiki");
	const jobs = codeBlocks.map(async ({ code, language, pos }) => {
		const lines = await highlightCodeToTokens(code, language);
		for (const line of lines) {
			for (const token of line) {
				if (!token.content) {
					continue;
				}

				const from = pos + 1 + token.offset;
				const to = from + token.content.length;
				if (to <= from) {
					continue;
				}

				const fontStyle = token.variants.light.fontStyle ?? token.variants.dark.fontStyle ?? 0;
				const styles = [
					token.variants.light.color ? `--shiki-light:${token.variants.light.color}` : null,
					token.variants.dark.color ? `--shiki-dark:${token.variants.dark.color}` : null,
					fontStyle & 1 ? "font-style:italic" : null,
					fontStyle & 2 ? "font-weight:600" : null,
					fontStyle & 4 ? "text-decoration:underline" : null,
				]
					.filter((value): value is string => Boolean(value))
					.join(";");

				decorations.push(
					Decoration.inline(from, to, {
						class: "shiki-token",
						style: styles,
					}),
				);
			}
		}
	});

	await Promise.all(jobs);
	return DecorationSet.create(doc, decorations);
}

export const ShikiCodeBlockHighlightExtension = Extension.create({
	name: "shikiCodeBlockHighlight",
	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: shikiCodeBlockPluginKey,
				state: {
					init: () => DecorationSet.empty,
					apply(tr, old) {
						const next = tr.getMeta(shikiCodeBlockPluginKey);
						if (next instanceof DecorationSet) {
							return next;
						}

						return tr.docChanged ? old.map(tr.mapping, tr.doc) : old;
					},
				},
				props: {
					decorations(state) {
						return shikiCodeBlockPluginKey.getState(state) ?? DecorationSet.empty;
					},
				},
				view(view) {
					let activeView = view;
					let runId = 0;
					let destroyed = false;

					const refresh = () => {
						const nextRunId = ++runId;
						void buildCodeBlockDecorations(activeView.state.doc)
							.then((nextDecorations) => {
								if (destroyed || nextRunId !== runId) {
									return;
								}

								activeView.dispatch(
									activeView.state.tr.setMeta(shikiCodeBlockPluginKey, nextDecorations),
								);
							})
							.catch(() => {
								if (destroyed || nextRunId !== runId) {
									return;
								}

								activeView.dispatch(
									activeView.state.tr.setMeta(shikiCodeBlockPluginKey, DecorationSet.empty),
								);
							});
					};

					refresh();

					return {
						update(updatedView, previousState) {
							activeView = updatedView;
							if (!previousState.doc.eq(updatedView.state.doc)) {
								refresh();
							}
						},
						destroy() {
							destroyed = true;
						},
					};
				},
			}),
		];
	},
});

export function createTiptapExtensions(): AnyExtension[] {
	return [
		StarterKit.configure({
			heading: {
				levels: [1, 2, 3, 4, 5, 6],
			},
			link: false,
		}),
		ShikiCodeBlockHighlightExtension,
		SlashCommandLineExtension,
		WikiAwareLinkExtension,
		Image,
		Table.configure({
			resizable: false,
		}),
		TableRow,
		TableHeader,
		TableCell,
		TaskList.configure({
			HTMLAttributes: {
				"data-task-list": "true",
			},
		}),
		TaskItem.configure({
			nested: true,
			HTMLAttributes: {
				"data-task-list-item": "true",
			},
		}),
	];
}
