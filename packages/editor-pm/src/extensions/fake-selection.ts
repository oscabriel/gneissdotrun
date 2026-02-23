import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface FrozenSelection {
	from: number;
	to: number;
}

export const fakeSelectionPluginKey = new PluginKey<FrozenSelection | null>("fake-selection");

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		fakeSelection: {
			freezeSelection: () => ReturnType;
			restoreSelection: (options?: { focus?: boolean }) => ReturnType;
		};
	}

	interface Storage {
		fakeSelection: {
			frozenSelection: FrozenSelection | null;
		};
	}
}

export const FakeSelectionExtension = Extension.create({
	name: "fakeSelection",
	addStorage() {
		return {
			frozenSelection: null as FrozenSelection | null,
		};
	},
	addCommands() {
		return {
			freezeSelection:
				() =>
				({ editor, tr, dispatch }) => {
					if (!editor.state.selection.empty) {
						this.storage.frozenSelection = {
							from: editor.state.selection.from,
							to: editor.state.selection.to,
						};
						if (dispatch) {
							dispatch(tr.setMeta(fakeSelectionPluginKey, this.storage.frozenSelection));
						}
					}
					return true;
				},
			restoreSelection:
				(options) =>
				({ editor, tr, dispatch }) => {
					const frozen = this.storage.frozenSelection;
					if (!frozen) {
						return false;
					}

					if (options?.focus !== false) {
						editor.commands.focus();
					}

					if (dispatch) {
						const selection = TextSelection.create(editor.state.doc, frozen.from, frozen.to);
						dispatch(
							tr.setSelection(selection).setMeta(fakeSelectionPluginKey, null).scrollIntoView(),
						);
					}

					this.storage.frozenSelection = null;
					return true;
				},
		};
	},
	addProseMirrorPlugins() {
		return [
			new Plugin<FrozenSelection | null>({
				key: fakeSelectionPluginKey,
				state: {
					init: () => this.storage.frozenSelection,
					apply: (tr, value) => {
						const meta = tr.getMeta(fakeSelectionPluginKey) as FrozenSelection | null | undefined;
						if (meta !== undefined) {
							this.storage.frozenSelection = meta;
							return meta;
						}
						return value;
					},
				},
				props: {
					decorations: (state) => {
						const frozen = fakeSelectionPluginKey.getState(state);
						if (!frozen || frozen.from === frozen.to) {
							return DecorationSet.empty;
						}
						return DecorationSet.create(state.doc, [
							Decoration.inline(frozen.from, frozen.to, {
								class: "pm-fake-selection",
							}),
						]);
					},
				},
			}),
		];
	},
});
