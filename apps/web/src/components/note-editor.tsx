import { Button, DropdownMenu } from "@cloudflare/kumo";
import type { CaptureRequest } from "@gneissdotrun/api/capture-contract";
import {
	parseSlashCommandLine,
	parseSlashCommands,
	stripSlashCommandLines,
	type SlashCommandIntent,
} from "@gneissdotrun/api/slash-commands";
import type { UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { NoteContentEditor, type NoteContentEditorHandle } from "@/components/note-content-editor";
import { TextPromptDialog } from "@/components/dialogs/text-prompt-dialog";
import { createNoteSessionId } from "@/lib/agents/client";
import { useRewriteAgentChat } from "@/lib/agents/hooks";
import type { EditorMode } from "@/lib/editor/editor-mode";
import type { EditorWidth } from "@/lib/editor/editor-width";
import { cn } from "@/lib/utils";

interface RewriteProgressUpdate {
	mode: "append" | "replace";
	text: string;
}

type NoteRunStatus = "idle" | "queued" | "streaming" | "persisting";

interface RewriteAgentBody {
	invocationSource: "note_run";
	interactionType: "slash_command";
	noteId: string;
	userId: string;
	title: string;
	noteContent: string;
	pendingCommand: SlashCommandIntent;
}

interface ActiveSlashRun {
	sessionId: string;
	noteContent: string;
	title: string;
	command: SlashCommandIntent;
}

interface SlashRewriteRunnerProps {
	noteId: string;
	userId: string;
	run: ActiveSlashRun;
	onStarted: () => void;
	onProgress: (nextMarkdown: string) => void;
	onCompleted: (result: { status: "persisted" | "skipped"; finalText: string }) => void;
	onFailed: () => void;
}

interface NoteEditorProps {
	userId: string;
	noteId: string;
	title: string;
	initialContent: string;
	onCapture: (
		input: CaptureRequest,
		options?: {
			onRewriteProgress?: (update: RewriteProgressUpdate) => void;
		},
	) => Promise<void>;
	onSaveNoteContent: (
		input: { noteId: string; content: string; title?: string },
		options?: { silent?: boolean },
	) => Promise<void>;
	onArchiveNote: (noteId: string) => Promise<void>;
	onEditorInput: () => void;
	isCapturing: boolean;
	runStatus?: NoteRunStatus;
	externalCommandRequest?: { command: string; nonce: number } | null;
	editorMode?: EditorMode;
	editorWidth?: EditorWidth;
	previewOpen?: boolean;
	focusToken?: number;
	rightSidebarCollapsed?: boolean;
	onNotify?: (notice: { tone: "info" | "success" | "warning" | "error"; message: string }) => void;
	onRewritePersisted?: (noteId: string) => Promise<void> | void;
}

const AUTOSAVE_DELAY_MS = 1000;

function normalizeDraftContent(input: string): string {
	return stripSlashCommandLines(input).trimEnd();
}

function normalizeDraftTitle(input: string): string {
	return input.trim() || "Untitled note";
}

function appendBlock(current: string, block: string): string {
	if (!current.trim()) {
		return block;
	}

	return `${current.trimEnd()}\n\n${block}`;
}

function applyEditorFormatting(current: string, commandName: string, argument: string): string {
	switch (commandName) {
		case "heading": {
			const text = argument || "New heading";
			return appendBlock(current, `# ${text}`);
		}
		case "code": {
			const text = argument || "// Add code";
			return appendBlock(current, `\`\`\`\n${text}\n\`\`\``);
		}
		case "quote": {
			const text = argument || "Quote";
			return appendBlock(current, `> ${text}`);
		}
		case "bullets": {
			const lines = argument
				? argument
						.split(";")
						.map((line) => line.trim())
						.filter(Boolean)
				: ["List item"];

			return appendBlock(current, lines.map((line) => `- ${line}`).join("\n"));
		}
		default:
			return current;
	}
}

function appendPendingCommand(current: string, rawCommand: string): string {
	const nextCommand = rawCommand.trim();
	if (!nextCommand) {
		return current;
	}

	if (!current.trim()) {
		return nextCommand;
	}

	return `${current.trimEnd()}\n\n${nextCommand}`;
}

function extractTextFromMessage(message: UIMessage): string {
	return message.parts
		.filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
		.map((part) => part.text)
		.join("")
		.trim();
}

function getLatestAssistantText(messages: UIMessage[]): string {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (!message || message.role !== "assistant") {
			continue;
		}

		const text = extractTextFromMessage(message);
		if (text.length > 0) {
			return text;
		}
	}

	return "";
}

function SlashRewriteRunner({
	noteId,
	userId,
	run,
	onStarted,
	onProgress,
	onCompleted,
	onFailed,
}: SlashRewriteRunnerProps) {
	const startedRef = useRef(false);
	const completedRef = useRef(false);
	const messagesRef = useRef<UIMessage[]>([]);
	const bodyRef = useRef<RewriteAgentBody>({
		invocationSource: "note_run",
		interactionType: "slash_command",
		noteId,
		userId,
		title: run.title,
		noteContent: run.noteContent,
		pendingCommand: run.command,
	});

	const { clearHistory, messages, sendMessage } = useRewriteAgentChat({
		agentName: `${noteId}:${run.sessionId}`,
		body: () => ({ ...bodyRef.current }),
		onStatusData: (payload) => {
			if (payload.status === "started") {
				onStarted();
				return;
			}

			if (completedRef.current) {
				return;
			}

			completedRef.current = true;
			onCompleted({
				status: payload.status,
				finalText: getLatestAssistantText(messagesRef.current),
			});
		},
	});

	useEffect(() => {
		messagesRef.current = messages;
		const latestAssistantText = getLatestAssistantText(messages);
		if (latestAssistantText) {
			onProgress(latestAssistantText);
		}
	}, [messages, onProgress]);

	useEffect(() => {
		if (startedRef.current) {
			return;
		}

		startedRef.current = true;

		try {
			clearHistory();
			sendMessage({ text: run.command.raw });
		} catch {
			onFailed();
		}
	}, [clearHistory, onFailed, run.command.raw, sendMessage]);

	return null;
}

export function NoteEditor({
	userId,
	noteId,
	title,
	initialContent,
	onCapture,
	onSaveNoteContent,
	onArchiveNote,
	onEditorInput,
	// retained for compatibility with parent capture-level controls
	isCapturing: _isCapturing,
	runStatus = "idle",
	externalCommandRequest,
	editorMode = "source",
	editorWidth = "full",
	previewOpen = false,
	focusToken,
	rightSidebarCollapsed = false,
	onNotify,
	onRewritePersisted,
}: NoteEditorProps) {
	const sanitizedInitialContent = normalizeDraftContent(initialContent);
	const normalizedInitialTitle = normalizeDraftTitle(title);

	const [noteTitle, setNoteTitle] = useState(normalizedInitialTitle);
	const [noteContent, setNoteContent] = useState(sanitizedInitialContent);
	const [activeSlashRun, setActiveSlashRun] = useState<ActiveSlashRun | null>(null);
	const [slashRunStatus, setSlashRunStatus] = useState<Exclude<NoteRunStatus, "idle"> | null>(null);
	const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);

	const noteContentRef = useRef(sanitizedInitialContent);
	const titleRef = useRef(normalizedInitialTitle);
	const lastAcknowledgedContentRef = useRef(sanitizedInitialContent);
	const lastAcknowledgedTitleRef = useRef(normalizedInitialTitle);
	const syncedNoteIdRef = useRef(noteId);
	const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const saveInFlightRef = useRef<Promise<boolean> | null>(null);
	const editorRef = useRef<NoteContentEditorHandle | null>(null);

	const effectiveRunStatus = slashRunStatus ?? runStatus;

	const handleSlashRewriteStarted = useCallback(() => {
		setSlashRunStatus("streaming");
	}, []);

	const handleSlashRewriteProgress = useCallback((nextMarkdown: string) => {
		const sanitized = stripSlashCommandLines(nextMarkdown).trim();
		setNoteContent(sanitized);
		noteContentRef.current = sanitized;
	}, []);

	const handleSlashRewriteCompleted = useCallback(
		async (result: { status: "persisted" | "skipped"; finalText: string }) => {
			setSlashRunStatus("persisting");
			try {
				const fallbackContent = activeSlashRun?.noteContent ?? noteContentRef.current;
				const finalContent = stripSlashCommandLines(result.finalText || fallbackContent).trim();
				setNoteContent(finalContent);
				noteContentRef.current = finalContent;
				lastAcknowledgedContentRef.current = finalContent;

				if (result.status === "skipped") {
					onNotify?.({
						tone: "warning",
						message: "Slash command completed without a persisted rewrite.",
					});
				}

				await onRewritePersisted?.(noteId);
			} finally {
				setActiveSlashRun(null);
				setSlashRunStatus(null);
			}
		},
		[activeSlashRun, noteId, onNotify, onRewritePersisted],
	);

	const handleSlashRewriteFailed = useCallback(() => {
		setActiveSlashRun(null);
		setSlashRunStatus(null);
		onNotify?.({
			tone: "error",
			message: "Failed to start slash command rewrite.",
		});
	}, [onNotify]);

	const clearAutosaveTimer = useCallback(() => {
		if (!autosaveTimerRef.current) {
			return;
		}

		clearTimeout(autosaveTimerRef.current);
		autosaveTimerRef.current = null;
	}, []);

	const flushSave = useCallback(
		async (options?: { silent?: boolean; content?: string; title?: string }) => {
			if (saveInFlightRef.current) {
				await saveInFlightRef.current;
			}

			const contentToSave = normalizeDraftContent(options?.content ?? noteContentRef.current);
			const titleToSave = normalizeDraftTitle(options?.title ?? titleRef.current);
			const hasExplicitTitleOverride = options?.title !== undefined;

			const isDirty =
				contentToSave !== lastAcknowledgedContentRef.current ||
				(hasExplicitTitleOverride && titleToSave !== lastAcknowledgedTitleRef.current);
			if (!isDirty) {
				return false;
			}

			const savePromise = (async () => {
				try {
					const saveInput: { noteId: string; content: string; title?: string } = {
						noteId,
						content: contentToSave,
					};
					if (hasExplicitTitleOverride) {
						saveInput.title = titleToSave;
					}

					await onSaveNoteContent(saveInput, { silent: options?.silent ?? true });
					lastAcknowledgedContentRef.current = contentToSave;
					if (hasExplicitTitleOverride) {
						lastAcknowledgedTitleRef.current = titleToSave;
						titleRef.current = titleToSave;
						setNoteTitle(titleToSave);
					}
					return true;
				} catch {
					return false;
				} finally {
					saveInFlightRef.current = null;
				}
			})();

			saveInFlightRef.current = savePromise;
			return savePromise;
		},
		[noteId, onSaveNoteContent],
	);

	const runCommandIntent = useCallback(async () => {
		const pendingCommands = parseSlashCommands(noteContentRef.current);
		const agentCommands = pendingCommands.filter((command) => command.kind !== "editor");

		if (agentCommands.length > 1) {
			onNotify?.({
				tone: "warning",
				message: "Run supports only one agent slash command at a time.",
			});
			return;
		}

		const baselineContent = stripSlashCommandLines(noteContentRef.current);
		let transformedContent = baselineContent;

		for (const command of pendingCommands) {
			if (command.kind === "editor" && command.commandName) {
				transformedContent = applyEditorFormatting(
					transformedContent,
					command.commandName,
					command.argument,
				);
			}
		}

		if (transformedContent !== noteContentRef.current) {
			setNoteContent(transformedContent);
			noteContentRef.current = transformedContent;
		}

		await flushSave({
			silent: false,
			content: transformedContent,
		});

		const slashCommand = agentCommands[0] ?? null;
		if (slashCommand) {
			const sessionId = createNoteSessionId(noteId);
			setActiveSlashRun({
				sessionId,
				noteContent: transformedContent,
				title: titleRef.current,
				command: slashCommand,
			});
			setSlashRunStatus("queued");
			return;
		}

		const userInput = transformedContent.trim();

		if (userInput.length === 0) {
			return;
		}

		let streamedContent = "";
		let sawStreamingUpdate = false;

		try {
			await onCapture(
				{
					noteId,
					userInput,
					invocationSource: "note_run",
					runMode: pendingCommands.length > 0 ? "content_and_slash" : "content_only",
				},
				{
					onRewriteProgress: (update) => {
						sawStreamingUpdate = true;
						streamedContent =
							update.mode === "replace" ? update.text : `${streamedContent}${update.text}`;
						const sanitized = stripSlashCommandLines(streamedContent).trim();
						setNoteContent(sanitized);
						noteContentRef.current = sanitized;
					},
				},
			);
			lastAcknowledgedContentRef.current = normalizeDraftContent(noteContentRef.current);
		} catch {
			if (sawStreamingUpdate) {
				setNoteContent(transformedContent);
				noteContentRef.current = transformedContent;
			}

			await flushSave({
				silent: false,
				content: transformedContent,
			});
		}
	}, [flushSave, noteId, onCapture, onNotify, userId]);

	useEffect(() => {
		const sanitized = normalizeDraftContent(initialContent);
		const normalizedTitle = normalizeDraftTitle(title);
		const isNoteSwitch = syncedNoteIdRef.current !== noteId;

		if (!isNoteSwitch) {
			const hasUnsavedLocalChanges =
				normalizeDraftContent(noteContentRef.current) !== lastAcknowledgedContentRef.current ||
				normalizeDraftTitle(titleRef.current) !== lastAcknowledgedTitleRef.current;
			if (hasUnsavedLocalChanges || saveInFlightRef.current) {
				return;
			}
		} else {
			setActiveSlashRun(null);
			setSlashRunStatus(null);
		}

		syncedNoteIdRef.current = noteId;
		setNoteTitle(normalizedTitle);
		titleRef.current = normalizedTitle;
		lastAcknowledgedTitleRef.current = normalizedTitle;
		// Only reset editor content when it actually differs after normalization,
		// so trailing-whitespace-only changes (e.g. pressing Enter to create an
		// empty paragraph) don't cause a cursor-snapping content reset.
		if (isNoteSwitch || normalizeDraftContent(noteContentRef.current) !== sanitized) {
			setNoteContent(sanitized);
			noteContentRef.current = sanitized;
		}
		lastAcknowledgedContentRef.current = sanitized;
	}, [initialContent, noteId, title]);

	useEffect(() => {
		clearAutosaveTimer();
		autosaveTimerRef.current = setTimeout(() => {
			void flushSave({ silent: true });
		}, AUTOSAVE_DELAY_MS);

		return () => {
			clearAutosaveTimer();
		};
	}, [clearAutosaveTimer, flushSave, noteContent, noteTitle]);

	useEffect(() => {
		if (!externalCommandRequest?.command) {
			return;
		}

		const parsed = parseSlashCommandLine(externalCommandRequest.command);
		if (!parsed) {
			return;
		}

		onEditorInput();
		const nextContent = appendPendingCommand(noteContentRef.current, parsed.raw);
		setNoteContent(nextContent);
		noteContentRef.current = nextContent;
	}, [externalCommandRequest?.nonce, externalCommandRequest?.command, onEditorInput]);

	useEffect(() => {
		if (focusToken === undefined) {
			return;
		}

		editorRef.current?.focus();
	}, [focusToken]);

	useEffect(() => {
		return () => {
			clearAutosaveTimer();
			void flushSave({ silent: true });
		};
	}, [clearAutosaveTimer, flushSave]);

	const handleRename = async (nextTitle: string) => {
		const normalized = nextTitle.trim() || "Untitled note";
		if (normalized === titleRef.current) {
			return;
		}

		onEditorInput();
		setNoteTitle(normalized);
		titleRef.current = normalized;
		await flushSave({
			silent: false,
			title: normalized,
			content: noteContentRef.current,
		});
	};

	const noteOptionsCollisionPadding = useMemo(() => {
		if (
			typeof window !== "undefined" &&
			typeof window.matchMedia === "function" &&
			window.matchMedia("(max-width: 1023px)").matches
		) {
			return 8;
		}

		return {
			top: 8,
			bottom: 8,
			left: 8,
			right: rightSidebarCollapsed ? 64 : 208,
		};
	}, [rightSidebarCollapsed]);

	return (
		<div className="relative">
			<TextPromptDialog
				open={isRenameDialogOpen}
				onOpenChange={setIsRenameDialogOpen}
				title="Rename note"
				description="Update the note title without leaving the editor."
				label="Note title"
				defaultValue={titleRef.current}
				placeholder="Untitled note"
				confirmLabel="Save title"
				onSubmit={handleRename}
				maxLength={120}
			/>
			{activeSlashRun ? (
				<SlashRewriteRunner
					noteId={noteId}
					userId={userId}
					run={activeSlashRun}
					onStarted={handleSlashRewriteStarted}
					onProgress={handleSlashRewriteProgress}
					onCompleted={(result) => {
						void handleSlashRewriteCompleted(result);
					}}
					onFailed={handleSlashRewriteFailed}
				/>
			) : null}
			<div className="absolute top-0 right-0 z-10 flex items-center gap-1">
				<Button
					size="sm"
					variant="outline"
					disabled={effectiveRunStatus !== "idle"}
					onClick={() => {
						onEditorInput();
						void runCommandIntent();
					}}
				>
					Run
				</Button>
				<DropdownMenu>
					<DropdownMenu.Trigger
						render={
							<Button
								size="lg"
								variant="ghost"
								shape="square"
								className="text-2xl leading-none"
								aria-label="Note options"
								disabled={effectiveRunStatus !== "idle"}
							/>
						}
					>
						⋯
					</DropdownMenu.Trigger>
					<DropdownMenu.Content align="end" collisionPadding={noteOptionsCollisionPadding}>
						<DropdownMenu.Group>
							<DropdownMenu.Label>Note options</DropdownMenu.Label>
							<DropdownMenu.Separator />
							<DropdownMenu.Item
								onClick={() => {
									setIsRenameDialogOpen(true);
								}}
							>
								Rename note
							</DropdownMenu.Item>
							<DropdownMenu.Item
								variant="danger"
								onClick={() => {
									void onArchiveNote(noteId);
								}}
							>
								Delete note
							</DropdownMenu.Item>
						</DropdownMenu.Group>
					</DropdownMenu.Content>
				</DropdownMenu>
				{effectiveRunStatus !== "idle" ? (
					<span
						className="text-kumo-subtle inline-flex items-center gap-1 text-xs"
						aria-live="polite"
					>
						<span className="bg-kumo-subtle inline-block h-1.5 w-1.5 animate-pulse rounded-full" />
						{effectiveRunStatus === "queued"
							? "Running…"
							: effectiveRunStatus === "streaming"
								? "Streaming…"
								: "Saving…"}
					</span>
				) : null}
			</div>

			<NoteContentEditor
				ref={editorRef}
				label="Note content"
				value={noteContent}
				editorMode={editorMode}
				previewOpen={previewOpen}
				autoFocus
				className={cn(
					"min-h-40 w-full pr-28",
					editorWidth === "narrow" ? "mx-auto max-w-3xl" : undefined,
				)}
				onChangeMarkdown={(nextMarkdown) => {
					onEditorInput();
					setNoteContent(nextMarkdown);
					noteContentRef.current = nextMarkdown;
				}}
				onBlur={() => {
					void flushSave({ silent: true });
				}}
				onRunShortcut={() => {
					void runCommandIntent();
				}}
				placeholder="Write your note. Add slash commands like /summarize on separate lines."
			/>
		</div>
	);
}
