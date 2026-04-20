export type WorkspaceMainPaneMode = "editor" | "browse";

export function toggleWorkspaceMainPaneMode(
	current: WorkspaceMainPaneMode,
): WorkspaceMainPaneMode {
	return current === "editor" ? "browse" : "editor";
}

export function getWorkspaceMainPaneModeActionLabel(
	mode: WorkspaceMainPaneMode,
): string {
	return mode === "editor" ? "Open browser" : "Return to editor";
}
