import { useEffect } from "react";

function isTypingTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) {
		return false;
	}

	if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") {
		return true;
	}

	if (target.isContentEditable) {
		return true;
	}

	return Boolean(target.closest('[contenteditable="true"], [role="textbox"]'));
}

export function useWorkspaceShortcuts({
	createNewNote,
	focusEditor,
	toggleLeftPanel,
	toggleRightPanel,
}: {
	createNewNote: () => Promise<string | null>;
	focusEditor: () => void;
	toggleLeftPanel: () => void;
	toggleRightPanel: () => void;
}) {
	useEffect(() => {
		const listener = (event: KeyboardEvent) => {
			if (event.defaultPrevented) {
				return;
			}

			if (
				(event.metaKey || event.ctrlKey) &&
				!event.shiftKey &&
				!event.altKey &&
				event.key === "\\"
			) {
				event.preventDefault();
				toggleLeftPanel();
				return;
			}

			if (
				(event.metaKey || event.ctrlKey) &&
				!event.shiftKey &&
				!event.altKey &&
				event.key === "."
			) {
				event.preventDefault();
				toggleRightPanel();
				return;
			}

			if (
				(event.metaKey || event.ctrlKey) &&
				event.shiftKey &&
				!event.altKey &&
				event.key === "2"
			) {
				event.preventDefault();
				focusEditor();
				return;
			}

			if (event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) {
				return;
			}

			if (event.key.toLowerCase() !== "n" || isTypingTarget(event.target)) {
				return;
			}

			event.preventDefault();
			void createNewNote();
		};

		window.addEventListener("keydown", listener);
		return () => {
			window.removeEventListener("keydown", listener);
		};
	}, [createNewNote, focusEditor, toggleLeftPanel, toggleRightPanel]);
}
