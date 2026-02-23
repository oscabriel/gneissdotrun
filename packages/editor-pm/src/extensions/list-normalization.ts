import { Extension } from "@tiptap/core";
import type { AnyExtension } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

export const listNormalizationPluginKey = new PluginKey("list-normalization");

function normalizeOrderedListTasks(doc: ProseMirrorNode, tr: Transaction): boolean {
	let changed = false;

	doc.descendants((node, pos, parent) => {
		if (node.type.name !== "taskItem") {
			return;
		}

		if (parent?.type.name !== "orderedList") {
			return;
		}

		const listItemType = node.type.schema.nodes.listItem;
		if (!listItemType) {
			return;
		}

		tr.setNodeMarkup(pos, listItemType, {}, node.marks);
		changed = true;
	});

	return changed;
}

export const ListNormalizationExtension = Extension.create({
	name: "listNormalization",
	addProseMirrorPlugins() {
		return [
			new Plugin({
				key: listNormalizationPluginKey,
				appendTransaction: (transactions, _oldState, newState) => {
					if (!transactions.some((transaction) => transaction.docChanged)) {
						return null;
					}

					const tr = newState.tr;
					const changed = normalizeOrderedListTasks(newState.doc, tr);
					if (!changed) {
						return null;
					}
					return tr;
				},
			}),
		];
	},
});

export const listExtensions: AnyExtension[] = [
	TaskList,
	TaskItem.configure({
		nested: true,
	}),
	ListNormalizationExtension,
];
