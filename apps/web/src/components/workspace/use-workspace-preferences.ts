import { toggleEditorMode, type EditorMode } from "@/lib/editor/editor-mode";
import { toggleEditorWidth, type EditorWidth } from "@/lib/editor/editor-width";
import {
	toggleWorkspaceMainPaneMode,
	type WorkspaceMainPaneMode,
} from "@/lib/workspace/main-pane-mode";
import { useCallback, useEffect, useState } from "react";

type ThemeMode = "light" | "dark";
type FontMode = "mono" | "serif";

const THEME_STORAGE_KEY = "theme";
const LEFT_SIDEBAR_COLLAPSED_STORAGE_KEY = "workspace-left-sidebar-collapsed";
const RIGHT_SIDEBAR_COLLAPSED_STORAGE_KEY = "workspace-right-sidebar-collapsed";
const FONT_MODE_STORAGE_KEY = "workspace-font-mode";
const EDITOR_MODE_STORAGE_KEY = "workspace-editor-mode";
const EDITOR_WIDTH_STORAGE_KEY = "workspace-editor-width";
const MAIN_PANE_MODE_STORAGE_KEY = "workspace-main-pane-mode";
const LAYOUT_SEEN_STORAGE_KEY = "workspace-layout-seen";

function readThemeMode(): ThemeMode {
	if (typeof document === "undefined") {
		return "light";
	}

	return document.documentElement.getAttribute("data-mode") === "dark" ? "dark" : "light";
}

function isMobileViewport(): boolean {
	if (typeof window === "undefined") {
		return false;
	}

	if (typeof window.matchMedia !== "function") {
		return false;
	}

	return window.matchMedia("(max-width: 1023px)").matches;
}

export function useWorkspacePreferences() {
	const [themeMode, setThemeMode] = useState<ThemeMode>("light");
	const [fontMode, setFontMode] = useState<FontMode>("mono");
	const [editorWidth, setEditorWidth] = useState<EditorWidth>("full");
	const [editorMode, setEditorMode] = useState<EditorMode>("source");
	const [mainPaneMode, setMainPaneMode] = useState<WorkspaceMainPaneMode>("editor");
	const [previewOpen, setPreviewOpen] = useState(false);
	const [leftCollapsed, setLeftCollapsed] = useState(false);
	const [rightCollapsed, setRightCollapsed] = useState(false);
	const [mobilePanel, setMobilePanel] = useState<"left" | "right" | null>(null);
	const [layoutInteracted, setLayoutInteracted] = useState(false);
	const [preferencesReady, setPreferencesReady] = useState(false);

	useEffect(() => {
		setThemeMode(readThemeMode());
		if (typeof window === "undefined") {
			setPreferencesReady(true);
			return;
		}

		const hasSeenLayout = window.localStorage.getItem(LAYOUT_SEEN_STORAGE_KEY) === "1";
		setLayoutInteracted(hasSeenLayout);

		setLeftCollapsed(
			hasSeenLayout && window.localStorage.getItem(LEFT_SIDEBAR_COLLAPSED_STORAGE_KEY) === "1",
		);
		setRightCollapsed(
			hasSeenLayout && window.localStorage.getItem(RIGHT_SIDEBAR_COLLAPSED_STORAGE_KEY) === "1",
		);

		const storedFont = window.localStorage.getItem(FONT_MODE_STORAGE_KEY);
		if (storedFont === "mono" || storedFont === "serif") {
			setFontMode(storedFont);
		}

		const storedWidth = window.localStorage.getItem(EDITOR_WIDTH_STORAGE_KEY);
		if (storedWidth === "narrow" || storedWidth === "full") {
			setEditorWidth(storedWidth);
		}

		const storedMode = window.localStorage.getItem(EDITOR_MODE_STORAGE_KEY);
		if (storedMode === "source" || storedMode === "rich") {
			setEditorMode(storedMode);
		}

		const storedMainPaneMode = window.localStorage.getItem(MAIN_PANE_MODE_STORAGE_KEY);
		if (storedMainPaneMode === "editor" || storedMainPaneMode === "browse") {
			setMainPaneMode(storedMainPaneMode);
		}

		setPreferencesReady(true);
	}, []);

	useEffect(() => {
		if (!preferencesReady || typeof document === "undefined") {
			return;
		}

		document.body.setAttribute("data-font-mode", fontMode);
	}, [fontMode, preferencesReady]);

	useEffect(() => {
		if (!preferencesReady || typeof window === "undefined") {
			return;
		}

		window.localStorage.setItem(FONT_MODE_STORAGE_KEY, fontMode);
	}, [fontMode, preferencesReady]);

	useEffect(() => {
		if (!preferencesReady || typeof window === "undefined") {
			return;
		}

		window.localStorage.setItem(EDITOR_WIDTH_STORAGE_KEY, editorWidth);
	}, [editorWidth, preferencesReady]);

	useEffect(() => {
		if (!preferencesReady || typeof window === "undefined") {
			return;
		}

		window.localStorage.setItem(EDITOR_MODE_STORAGE_KEY, editorMode);
	}, [editorMode, preferencesReady]);

	useEffect(() => {
		if (!preferencesReady || typeof window === "undefined") {
			return;
		}

		window.localStorage.setItem(MAIN_PANE_MODE_STORAGE_KEY, mainPaneMode);
	}, [mainPaneMode, preferencesReady]);

	useEffect(() => {
		if (!preferencesReady || !layoutInteracted || typeof window === "undefined") {
			return;
		}

		window.localStorage.setItem(LEFT_SIDEBAR_COLLAPSED_STORAGE_KEY, leftCollapsed ? "1" : "0");
		window.localStorage.setItem(RIGHT_SIDEBAR_COLLAPSED_STORAGE_KEY, rightCollapsed ? "1" : "0");
	}, [layoutInteracted, leftCollapsed, preferencesReady, rightCollapsed]);

	const markLayoutInteraction = useCallback(() => {
		if (typeof window !== "undefined") {
			window.localStorage.setItem(LAYOUT_SEEN_STORAGE_KEY, "1");
		}

		setLayoutInteracted(true);
	}, []);

	const closeMobilePanel = useCallback(() => {
		setMobilePanel(null);
	}, []);

	const toggleLeftPanel = useCallback(() => {
		if (isMobileViewport()) {
			setMobilePanel((current) => (current === "left" ? null : "left"));
			return;
		}

		markLayoutInteraction();
		setLeftCollapsed((current) => !current);
	}, [markLayoutInteraction]);

	const toggleRightPanel = useCallback(() => {
		if (isMobileViewport()) {
			setMobilePanel((current) => (current === "right" ? null : "right"));
			return;
		}

		markLayoutInteraction();
		setRightCollapsed((current) => !current);
	}, [markLayoutInteraction]);

	const revealLeftPanel = useCallback(() => {
		if (leftCollapsed) {
			setLeftCollapsed(false);
			markLayoutInteraction();
		}

		if (isMobileViewport()) {
			setMobilePanel("left");
		}
	}, [leftCollapsed, markLayoutInteraction]);

	const revealRightPanel = useCallback(() => {
		if (rightCollapsed) {
			setRightCollapsed(false);
			markLayoutInteraction();
		}

		if (isMobileViewport()) {
			setMobilePanel("right");
		}
	}, [markLayoutInteraction, rightCollapsed]);

	const toggleThemeMode = useCallback(() => {
		const current = readThemeMode();
		const nextMode: ThemeMode = current === "dark" ? "light" : "dark";
		setThemeMode(nextMode);

		if (typeof document !== "undefined") {
			document.documentElement.setAttribute("data-mode", nextMode);
		}

		if (typeof window !== "undefined") {
			window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
		}
	}, []);

	const toggleFontMode = useCallback(() => {
		setFontMode((current) => (current === "mono" ? "serif" : "mono"));
	}, []);

	const handleToggleEditorWidth = useCallback(() => {
		setEditorWidth((current) => toggleEditorWidth(current));
	}, []);

	const handleToggleEditorMode = useCallback(() => {
		setEditorMode((current) => toggleEditorMode(current));
		setPreviewOpen(false);
	}, []);

	const handleTogglePreview = useCallback(() => {
		setPreviewOpen((current) => !current);
	}, []);

	const handleToggleMainPaneMode = useCallback(() => {
		setMainPaneMode((current) => toggleWorkspaceMainPaneMode(current));
		setPreviewOpen(false);
	}, []);

	const openEditorPane = useCallback(() => {
		setMainPaneMode("editor");
	}, []);

	const openBrowserPane = useCallback(() => {
		setMainPaneMode("browse");
		setPreviewOpen(false);
	}, []);

	return {
		closeMobilePanel,
		editorMode,
		editorWidth,
		fontMode,
		handleToggleMainPaneMode,
		handleToggleEditorMode,
		handleToggleEditorWidth,
		handleTogglePreview,
		leftCollapsed,
		mainPaneMode,
		mobilePanel,
		openBrowserPane,
		openEditorPane,
		previewOpen,
		revealLeftPanel,
		revealRightPanel,
		rightCollapsed,
		themeMode,
		toggleFontMode,
		toggleLeftPanel,
		toggleRightPanel,
		toggleThemeMode,
	};
}
