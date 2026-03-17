export type EditorMode = "source" | "rich";

export function toggleEditorMode(current: EditorMode): EditorMode {
	return current === "source" ? "rich" : "source";
}

export function getEditorModeActionLabel(mode: EditorMode): string {
	return mode === "source" ? "Switch to rich text" : "Switch to markdown";
}
