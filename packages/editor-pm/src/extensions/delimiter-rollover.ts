import { Extension } from "@tiptap/core";
import { NodeSelection, Plugin } from "@tiptap/pm/state";
import { DecorationSet } from "@tiptap/pm/view";

import {
	buildDecorations,
	detectBoundary,
	getBoundaryMarkRange,
} from "./delimiter-rollover-decorations";
import {
	convertHorizontalRuleToMarkdownText,
	resolveHorizontalRuleEditTarget,
	upgradeMarkdownParagraphToHorizontalRule,
} from "./delimiter-rollover-horizontal-rule";
import { sourceSelectionInside } from "./delimiter-rollover-selection";
import {
	markdownDelimiterRolloverPluginKey,
	type RolloverBoundary,
	type RolloverPluginMeta,
	type RolloverPluginState,
} from "./delimiter-rollover-shared";
import {
	commitSourceBlockMode,
	enterSourceBlockMode,
	findSourceTarget,
} from "./delimiter-rollover-source-mode";

export { markdownDelimiterRolloverPluginKey };

export const DelimiterRolloverExtension = Extension.create({
	name: "delimiterRollover",
	addStorage() {
		return {
			boundary: null as RolloverBoundary,
		};
	},
	addKeyboardShortcuts() {
		return {
			Enter: () => {
				return upgradeMarkdownParagraphToHorizontalRule(this.editor.state, (tr) =>
					this.editor.view.dispatch(tr),
				);
			},
			ArrowLeft: () => {
				const pluginState = markdownDelimiterRolloverPluginKey.getState(this.editor.state);
				const boundary = pluginState?.boundary ?? null;
				if (!boundary) {
					return false;
				}
				const nextBoundary: RolloverBoundary = {
					...boundary,
					side: boundary.side === "inside" ? "outside" : "inside",
				};
				const tr = this.editor.state.tr.setMeta(markdownDelimiterRolloverPluginKey, {
					kind: "set-boundary",
					boundary: nextBoundary,
				} satisfies RolloverPluginMeta);
				this.editor.view.dispatch(tr);
				return true;
			},
			ArrowRight: () => {
				const pluginState = markdownDelimiterRolloverPluginKey.getState(this.editor.state);
				const boundary = pluginState?.boundary ?? null;
				if (!boundary) {
					return false;
				}
				const nextBoundary: RolloverBoundary = {
					...boundary,
					side: boundary.side === "inside" ? "outside" : "inside",
				};
				const tr = this.editor.state.tr.setMeta(markdownDelimiterRolloverPluginKey, {
					kind: "set-boundary",
					boundary: nextBoundary,
				} satisfies RolloverPluginMeta);
				this.editor.view.dispatch(tr);
				return true;
			},
			Backspace: () => {
				const horizontalRuleTarget = resolveHorizontalRuleEditTarget(
					this.editor.state,
					"Backspace",
				);
				if (horizontalRuleTarget) {
					return convertHorizontalRuleToMarkdownText(
						this.editor.state,
						horizontalRuleTarget,
						(tr) => this.editor.view.dispatch(tr),
					);
				}

				const pluginState = markdownDelimiterRolloverPluginKey.getState(this.editor.state);
				const boundary = pluginState?.boundary ?? null;
				if (!boundary) {
					return false;
				}
				const markType = this.editor.state.schema.marks[boundary.markName];
				if (!markType) {
					return false;
				}
				const range = getBoundaryMarkRange(this.editor.state, boundary);
				if (!range) {
					return false;
				}
				const tr = this.editor.state.tr
					.removeMark(range.from, range.to, markType)
					.setMeta(markdownDelimiterRolloverPluginKey, {
						kind: "set-boundary",
						boundary: null,
					} satisfies RolloverPluginMeta);
				this.editor.view.dispatch(tr);
				return true;
			},
			Delete: () => {
				const horizontalRuleTarget = resolveHorizontalRuleEditTarget(this.editor.state, "Delete");
				if (horizontalRuleTarget) {
					return convertHorizontalRuleToMarkdownText(
						this.editor.state,
						horizontalRuleTarget,
						(tr) => this.editor.view.dispatch(tr),
					);
				}

				const pluginState = markdownDelimiterRolloverPluginKey.getState(this.editor.state);
				const boundary = pluginState?.boundary ?? null;
				if (!boundary) {
					return false;
				}
				const markType = this.editor.state.schema.marks[boundary.markName];
				if (!markType) {
					return false;
				}
				const range = getBoundaryMarkRange(this.editor.state, boundary);
				if (!range) {
					return false;
				}
				const tr = this.editor.state.tr
					.removeMark(range.from, range.to, markType)
					.setMeta(markdownDelimiterRolloverPluginKey, {
						kind: "set-boundary",
						boundary: null,
					} satisfies RolloverPluginMeta);
				this.editor.view.dispatch(tr);
				return true;
			},
		};
	},
	addProseMirrorPlugins() {
		return [
			new Plugin<RolloverPluginState>({
				key: markdownDelimiterRolloverPluginKey,
				state: {
					init: (_config, state) => ({
						boundary: detectBoundary(state),
						active: true,
						sourceBlock: null,
					}),
					apply: (tr, value, _oldState, newState) => {
						const fromMeta = tr.getMeta(markdownDelimiterRolloverPluginKey) as
							| RolloverPluginMeta
							| undefined;

						let sourceBlock = value.sourceBlock;
						if (sourceBlock && tr.docChanged) {
							const mappedFrom = tr.mapping.map(sourceBlock.from, -1);
							const mappedTo = tr.mapping.map(sourceBlock.to, -1);
							if (mappedFrom < mappedTo) {
								sourceBlock = {
									...sourceBlock,
									from: mappedFrom,
									to: mappedTo,
									listPos:
										typeof sourceBlock.listPos === "number"
											? tr.mapping.map(sourceBlock.listPos, -1)
											: undefined,
									itemPos:
										typeof sourceBlock.itemPos === "number"
											? tr.mapping.map(sourceBlock.itemPos, -1)
											: undefined,
									quotePos:
										typeof sourceBlock.quotePos === "number"
											? tr.mapping.map(sourceBlock.quotePos, -1)
											: undefined,
								};
							} else {
								sourceBlock = null;
							}
						}

						if (fromMeta?.kind === "set-source-block") {
							sourceBlock = fromMeta.sourceBlock;
						}

						if (fromMeta?.kind === "set-active") {
							return {
								active: fromMeta.active,
								boundary: fromMeta.active && !sourceBlock ? detectBoundary(newState) : null,
								sourceBlock,
							};
						}
						if (fromMeta?.kind === "set-boundary") {
							return {
								...value,
								boundary: fromMeta.boundary,
								sourceBlock,
							};
						}
						if (!value.active) {
							return {
								...value,
								boundary: null,
								sourceBlock,
							};
						}
						return {
							...value,
							boundary: sourceBlock ? null : detectBoundary(newState),
							sourceBlock,
						};
					},
				},
				props: {
					handleDOMEvents: {
						focus: (view) => {
							view.dispatch(
								view.state.tr.setMeta(markdownDelimiterRolloverPluginKey, {
									kind: "set-active",
									active: true,
								} satisfies RolloverPluginMeta),
							);
							return false;
						},
						blur: (view) => {
							view.dispatch(
								view.state.tr.setMeta(markdownDelimiterRolloverPluginKey, {
									kind: "set-active",
									active: false,
								} satisfies RolloverPluginMeta),
							);
							return false;
						},
					},
					decorations: (state) => {
						const pluginState = markdownDelimiterRolloverPluginKey.getState(state);
						if (!pluginState?.active) {
							return DecorationSet.empty;
						}
						return buildDecorations(state, pluginState.boundary, pluginState.sourceBlock);
					},
				},
				appendTransaction: (transactions, _oldState, newState) => {
					if (transactions.length === 0) {
						return null;
					}

					const pluginState = markdownDelimiterRolloverPluginKey.getState(newState);
					if (!pluginState) {
						return null;
					}

					const selectionChanged = transactions.some((tr) => {
						if (tr.selectionSet && !tr.docChanged) {
							return true;
						}
						const meta = tr.getMeta(markdownDelimiterRolloverPluginKey) as
							| RolloverPluginMeta
							| undefined;
						return (
							meta?.kind === "set-source-block" &&
							meta.sourceBlock === null &&
							meta.recheckSelection === true
						);
					});
					const focusActivated = transactions.some((tr) => {
						const meta = tr.getMeta(markdownDelimiterRolloverPluginKey) as
							| RolloverPluginMeta
							| undefined;
						return meta?.kind === "set-active" && meta.active;
					});
					if (!pluginState.sourceBlock && !selectionChanged && !focusActivated) {
						return null;
					}

					if (pluginState.sourceBlock) {
						if (
							pluginState.active &&
							sourceSelectionInside(newState.selection, pluginState.sourceBlock)
						) {
							return null;
						}
						return commitSourceBlockMode(newState, pluginState.sourceBlock);
					}

					if (!pluginState.active) {
						return null;
					}

					if (!newState.selection.empty && !(newState.selection instanceof NodeSelection)) {
						return null;
					}

					const target = findSourceTarget(newState);
					if (!target) {
						return null;
					}

					return enterSourceBlockMode(newState, target);
				},
			}),
		];
	},
});
