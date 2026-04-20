import { Button, Dialog, TooltipProvider } from "@cloudflare/kumo";
import { useCallback, useRef, useState } from "react";

import { CommandPalette } from "@/components/command-palette";
import { WorkspaceGridShell } from "@/components/layout/workspace-grid-shell";
import { NotesDirectory } from "@/components/sidebar/notes-directory";
import { CanvasPane } from "@/components/workspace/canvas-pane";
import { NoteBrowserPane } from "@/components/workspace/note-browser-pane";
import { RightUtilitySidebar, type RightUtilitySidebarHandle } from "@/components/workspace/right-utility-sidebar";
import { useWorkspaceCapture } from "@/components/workspace/use-workspace-capture";
import { useWorkspaceNavigation } from "@/components/workspace/use-workspace-navigation";
import { useWorkspaceNotes } from "@/components/workspace/use-workspace-notes";
import { useWorkspacePreferences } from "@/components/workspace/use-workspace-preferences";
import { useWorkspaceShortcuts } from "@/components/workspace/use-workspace-shortcuts";
import { toast } from "@/lib/toast";

interface WorkspaceShellProps {
	userId: string;
	selectedNoteId: string | null;
	onSelectNoteId: (noteId: string | null) => void;
}

export function WorkspaceShell({ userId, selectedNoteId, onSelectNoteId }: WorkspaceShellProps) {
	const rightUtilityRef = useRef<RightUtilitySidebarHandle | null>(null);
	const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
	const preferences = useWorkspacePreferences();
	const notes = useWorkspaceNotes({
		userId,
		selectedNoteId,
		onSelectNoteId,
	});
	const capture = useWorkspaceCapture({
		onSelectNoteId,
		refreshApiNotes: notes.refreshApiNotes,
	});
	const isWorkspaceBusy = capture.isCapturing || notes.isMutating;

	const handleSelectNote = (noteId: string) => {
		capture.clearEphemeral();
		onSelectNoteId(noteId);
		preferences.closeMobilePanel();
	};

	const createNewNote = useCallback(async () => {
		capture.clearEphemeral();
		return notes.createNewNote();
	}, [capture.clearEphemeral, notes.createNewNote]);
	const navigation = useWorkspaceNavigation({
		rightUtilityRef,
		selectedNote: notes.selectedNote,
		selectedNoteId,
		createNewNote,
		onCanvasInput: capture.handleCanvasInput,
		onRunOrganization: capture.handleRunOrganization,
		onRunFanOut: capture.handleRunFanOut,
		toggleLeftPanel: preferences.toggleLeftPanel,
		toggleRightPanel: preferences.toggleRightPanel,
		revealRightPanel: preferences.revealRightPanel,
	});

	const handleEditorNotice = useCallback(
		(notice: { tone: "info" | "success" | "warning" | "error"; message: string }) => {
			switch (notice.tone) {
				case "error": {
					toast.error(notice.message);
					break;
				}
				case "warning": {
					toast.warning(notice.message);
					break;
				}
				case "info": {
					toast.success(notice.message);
					break;
				}
				default: {
					toast.success(notice.message);
				}
			}
		},
		[],
	);

	useWorkspaceShortcuts({
		createNewNote,
		focusEditor: navigation.focusEditor,
		toggleLeftPanel: preferences.toggleLeftPanel,
		toggleRightPanel: preferences.toggleRightPanel,
	});

	const renderRightUtilitySidebar = (
		collapsed: boolean,
		showToggle = true,
		sectionIdPrefix = "workspace",
	) => (
		<RightUtilitySidebar
			ref={showToggle ? rightUtilityRef : undefined}
			collapsed={collapsed}
			showToggle={showToggle}
			sectionIdPrefix={sectionIdPrefix}
			onToggle={showToggle ? preferences.toggleRightPanel : preferences.closeMobilePanel}
			onCreateNote={() => {
				void createNewNote();
			}}
			onNavigateHistory={() => {
				navigation.navigateToHistory();
			}}
			onNavigateCollections={navigation.navigateToCollections}
			onNavigateContradictions={navigation.navigateToContradictions}
			onNavigateDigest={navigation.navigateToDigest}
			onToggleTheme={preferences.toggleThemeMode}
			themeMode={preferences.themeMode}
				onToggleFont={preferences.toggleFontMode}
				fontMode={preferences.fontMode}
				onToggleEditorWidth={preferences.handleToggleEditorWidth}
				editorWidth={preferences.editorWidth}
				onToggleMainPaneMode={preferences.handleToggleMainPaneMode}
				mainPaneMode={preferences.mainPaneMode}
				onToggleEditorMode={preferences.handleToggleEditorMode}
				editorMode={preferences.editorMode}
				onTogglePreview={preferences.handleTogglePreview}
			previewOpen={preferences.previewOpen}
			onDownloadMarkdown={navigation.downloadSelectedNote}
			onOpenProfile={navigation.navigateToProfile}
			onOpenSettings={() => {
				toast.warning("Settings is coming soon.");
			}}
			onOpenInfo={() => {
				setIsInfoDialogOpen(true);
			}}
		/>
	);

	return (
		<>
			<TooltipProvider>
				<WorkspaceGridShell
					leftCollapsed={preferences.leftCollapsed}
					rightCollapsed={preferences.rightCollapsed}
					onToggleLeft={preferences.toggleLeftPanel}
					onToggleRight={preferences.toggleRightPanel}
					mobilePanel={preferences.mobilePanel}
					onCloseMobilePanel={preferences.closeMobilePanel}
					leftRail={
						<NotesDirectory
							notes={notes.sidebarNotes}
							selectedNoteId={selectedNoteId}
							onSelectNote={handleSelectNote}
							isLoading={notes.isApiLoading && notes.sidebarNotes.length === 0}
							error={notes.apiError}
							usingFallback={notes.usingFallback}
							processingStatesByNoteId={capture.noteProcessingStates}
						/>
					}
					main={
						preferences.mainPaneMode === "browse" ? (
							<NoteBrowserPane
								notes={notes.sidebarNotes}
								selectedNoteId={selectedNoteId}
								onSelectNote={handleSelectNote}
								onOpenEditor={preferences.openEditorPane}
								onCreateNote={() => {
									void createNewNote();
								}}
								processingStatesByNoteId={capture.noteProcessingStates}
							/>
						) : (
							<CanvasPane
								userId={userId}
								selectedNote={notes.selectedNote}
								onCapture={capture.handleCapture}
								onSaveNoteContent={notes.saveNoteContent}
								onArchiveNote={notes.archiveNote}
								onCreateNote={() => {
									void createNewNote();
								}}
								isCapturing={isWorkspaceBusy}
								runStateByNoteId={capture.noteProcessingStates}
								ephemeralContent={capture.ephemeralContent}
								onCanvasInput={capture.handleCanvasInput}
								editorWidth={preferences.editorWidth}
								editorMode={preferences.editorMode}
								previewOpen={preferences.previewOpen}
								editorFocusToken={navigation.editorFocusToken}
								externalCommandRequest={navigation.externalCommandRequest}
								rightSidebarCollapsed={preferences.rightCollapsed}
								onNotify={handleEditorNotice}
								onRewritePersisted={notes.handleNoteRewritePersisted}
							/>
						)
					}
					rightRail={renderRightUtilitySidebar(preferences.rightCollapsed)}
					mobileRightRail={renderRightUtilitySidebar(false, false, "workspace-mobile")}
				/>
			</TooltipProvider>
			<CommandPalette
				onSelectAction={(action) => {
					void navigation.handlePaletteAction(action);
				}}
			/>
			<Dialog.Root
				open={isInfoDialogOpen}
				onOpenChange={(open) => {
					setIsInfoDialogOpen(open);
				}}
			>
				<Dialog size="sm" className="space-y-4 p-6">
					<Dialog.Title className="text-kumo-default text-base font-semibold">
						About Gneiss
					</Dialog.Title>
					<Dialog.Description className="text-kumo-subtle text-sm leading-6">
						Gneiss captures first and organizes with agents in the background.
					</Dialog.Description>
					<div className="flex justify-end">
						<Dialog.Close
							render={(props) => (
								<Button {...props} size="sm" variant="secondary">
									Close
								</Button>
							)}
						/>
					</div>
				</Dialog>
			</Dialog.Root>
		</>
	);
}
