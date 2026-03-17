export type EditorWidth = "narrow" | "full";

export function toggleEditorWidth(current: EditorWidth): EditorWidth {
	return current === "full" ? "narrow" : "full";
}

export function getEditorWidthActionLabel(width: EditorWidth): string {
	return width === "full" ? "Use narrow width" : "Use full width";
}
