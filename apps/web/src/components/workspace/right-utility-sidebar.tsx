import { Button, Tooltip } from "@cloudflare/kumo";
import type { ComponentType } from "react";
import {
	BookOpenText,
	CircleUserRound,
	Columns2,
	Cog,
	Download,
	Eye,
	History,
	Info,
	LayoutGrid,
	Layers,
	Moon,
	PanelRightClose,
	PanelRightOpen,
	Pencil,
	Plus,
	Sun,
	Type,
	WandSparkles,
} from "lucide-react";
import { forwardRef, useImperativeHandle } from "react";

import { getEditorModeActionLabel, type EditorMode } from "@/lib/editor/editor-mode";
import { getEditorWidthActionLabel, type EditorWidth } from "@/lib/editor/editor-width";
import {
	getWorkspaceMainPaneModeActionLabel,
	type WorkspaceMainPaneMode,
} from "@/lib/workspace/main-pane-mode";
import { cn } from "@/lib/utils";

export type UtilitySectionId = "review" | "controls" | "utility";

type ThemeMode = "light" | "dark";
type FontMode = "mono" | "serif";

interface RightUtilitySidebarProps {
	collapsed: boolean;
	onToggle: () => void;
	showToggle?: boolean;
	sectionIdPrefix?: string;
	onCreateNote: () => void;
	onNavigateHistory: () => void;
	onNavigateCollections: () => void;
	onNavigateContradictions: () => void;
	onNavigateDigest: () => void;
	onToggleTheme: () => void;
	themeMode: ThemeMode;
	onToggleFont: () => void;
	fontMode: FontMode;
	onToggleEditorWidth: () => void;
	editorWidth: EditorWidth;
	onToggleMainPaneMode: () => void;
	mainPaneMode: WorkspaceMainPaneMode;
	onToggleEditorMode: () => void;
	editorMode: EditorMode;
	onTogglePreview: () => void;
	previewOpen: boolean;
	onDownloadMarkdown: () => void;
	onOpenProfile: () => void;
	onOpenSettings: () => void;
	onOpenInfo: () => void;
}

export interface RightUtilitySidebarHandle {
	focusSection: (section: UtilitySectionId) => void;
}

function RailButton({
	icon: Icon,
	label,
	collapsed,
	onClick,
	id,
}: {
	icon: ComponentType<{ className?: string }>;
	label: string;
	collapsed: boolean;
	onClick: () => void;
	id?: string;
}) {
	const button = (
		<Button
			id={id}
			size="sm"
			variant="ghost"
			shape={collapsed ? "square" : undefined}
			className={cn(!collapsed && "w-full justify-start")}
			onClick={onClick}
			aria-label={label}
		>
			<Icon className="size-4 shrink-0" aria-hidden />
			{!collapsed && <span className="truncate">{label}</span>}
		</Button>
	);

	return collapsed ? <Tooltip content={label}>{button}</Tooltip> : button;
}

export const RightUtilitySidebar = forwardRef<RightUtilitySidebarHandle, RightUtilitySidebarProps>(
	function RightUtilitySidebar(
		{
			collapsed,
			onToggle,
			showToggle = true,
			sectionIdPrefix = "workspace",
			onCreateNote,
			onNavigateHistory,
			onNavigateCollections,
			onNavigateContradictions,
			onNavigateDigest,
			onToggleTheme,
			themeMode,
			onToggleFont,
			fontMode,
			onToggleEditorWidth,
			editorWidth,
			onToggleMainPaneMode,
			mainPaneMode,
			onToggleEditorMode,
			editorMode,
			onTogglePreview,
			previewOpen,
			onDownloadMarkdown,
			onOpenProfile,
			onOpenSettings,
			onOpenInfo,
		},
		ref,
	) {
		useImperativeHandle(ref, () => ({
			focusSection: (section) => {
				if (section === "review") {
					(
						document.getElementById(`${sectionIdPrefix}-review-primary-action`) as HTMLElement | null
					)?.focus();
					return;
				}
				if (section === "controls") {
					(
						document.getElementById(`${sectionIdPrefix}-controls-primary-action`) as HTMLElement | null
					)?.focus();
					return;
				}
				(
					document.getElementById(`${sectionIdPrefix}-utility-primary-action`) as HTMLElement | null
				)?.focus();
			},
		}), [sectionIdPrefix]);

		const groupClass = cn(
			"border-kumo-line flex flex-col gap-1 border-b py-2",
			collapsed ? "items-center" : "px-2",
		);

		return (
			<div className="flex h-full flex-col overflow-hidden">
				{showToggle ? (
					<div className="border-kumo-line flex h-12 shrink-0 items-center justify-end border-b px-2">
						<Tooltip content={collapsed ? "Open utilities (⌘.)" : "Close utilities (⌘.)"}>
							<Button
								size="sm"
								variant="ghost"
								shape="square"
								onClick={onToggle}
								aria-label="Toggle utility sidebar"
							>
								{collapsed ? (
									<PanelRightOpen className="size-4" aria-hidden />
								) : (
									<PanelRightClose className="size-4" aria-hidden />
								)}
							</Button>
						</Tooltip>
					</div>
				) : null}

				{/* New note */}
				<div className={groupClass}>
					<RailButton icon={Plus} label="New note" collapsed={collapsed} onClick={onCreateNote} />
				</div>

				{/* Review */}
				<div className={groupClass}>
					{!collapsed && (
						<p className="text-kumo-subtle px-2 text-[11px] font-medium tracking-[0.15em] uppercase">
							Review
						</p>
					)}
					<RailButton
						icon={History}
						label="History"
						collapsed={collapsed}
						onClick={onNavigateHistory}
						id={`${sectionIdPrefix}-review-primary-action`}
					/>
					<RailButton
						icon={Layers}
						label="Collections"
						collapsed={collapsed}
						onClick={onNavigateCollections}
					/>
					<RailButton
						icon={WandSparkles}
						label="Contradictions"
						collapsed={collapsed}
						onClick={onNavigateContradictions}
					/>
					<RailButton
						icon={BookOpenText}
						label="Digest"
						collapsed={collapsed}
						onClick={onNavigateDigest}
					/>
				</div>

				{/* Controls */}
				<div className={groupClass}>
					{!collapsed && (
						<p className="text-kumo-subtle px-2 text-[11px] font-medium tracking-[0.15em] uppercase">
							Workspace
						</p>
					)}
					<RailButton
						icon={themeMode === "dark" ? Sun : Moon}
						label={themeMode === "dark" ? "Light theme" : "Dark theme"}
						collapsed={collapsed}
						onClick={onToggleTheme}
						id={`${sectionIdPrefix}-controls-primary-action`}
					/>
					<RailButton
						icon={Type}
						label={fontMode === "mono" ? "Serif text" : "Mono text"}
						collapsed={collapsed}
						onClick={onToggleFont}
					/>
					<RailButton
						icon={mainPaneMode === "editor" ? LayoutGrid : Pencil}
						label={getWorkspaceMainPaneModeActionLabel(mainPaneMode)}
						collapsed={collapsed}
						onClick={onToggleMainPaneMode}
					/>
					{mainPaneMode === "editor" ? (
						<>
							<RailButton
								icon={Columns2}
								label={getEditorWidthActionLabel(editorWidth)}
								collapsed={collapsed}
								onClick={onToggleEditorWidth}
							/>
							<RailButton
								icon={editorMode === "source" ? Type : Pencil}
								label={getEditorModeActionLabel(editorMode)}
								collapsed={collapsed}
								onClick={onToggleEditorMode}
							/>
							<RailButton
								icon={previewOpen ? Pencil : Eye}
								label={previewOpen ? "Close preview" : "Open preview"}
								collapsed={collapsed}
								onClick={onTogglePreview}
							/>
						</>
					) : null}
					<RailButton
						icon={Download}
						label="Download (.md)"
						collapsed={collapsed}
						onClick={onDownloadMarkdown}
					/>
				</div>

				{/* Footer */}
				<div
					className={cn("mt-auto flex flex-col gap-1 py-2", collapsed ? "items-center" : "px-2")}
				>
					<RailButton
						icon={CircleUserRound}
						label="Profile"
						collapsed={collapsed}
						onClick={onOpenProfile}
						id={`${sectionIdPrefix}-utility-primary-action`}
					/>
					<RailButton icon={Cog} label="Settings" collapsed={collapsed} onClick={onOpenSettings} />
					<RailButton icon={Info} label="Info" collapsed={collapsed} onClick={onOpenInfo} />
				</div>
			</div>
		);
	},
);
