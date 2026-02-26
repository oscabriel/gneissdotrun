import { Button, DropdownMenu } from "@cloudflare/kumo";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { PmMarkdownEditor } from "@/components/pm-markdown-editor";

interface RewriteProgressUpdate {
	mode: "append" | "replace";
	text: string;
}

interface NoteEditorProps {
	noteId: string;
	title: string;
	initialContent: string;
	onCapture: (
		input: { userInput: string; noteId?: string },
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
	externalRunRequest?: { command: string; nonce: number } | null;
	markdownMode?: "edit" | "preview";
	focusToken?: number;
}

type SlashInstructionKind = "none" | "editor" | "agent" | "freeform";

interface SlashInstruction {
	kind: SlashInstructionKind;
	commandName: string | null;
	argument: string;
	raw: string;
}

const SLASH_COMMAND_LINE_PATTERN = /^\s*\/[a-z-]+(?:\s+.*)?\s*$/i;
const AUTOSAVE_DELAY_MS = 1000;

const EDITOR_FORMATTING_COMMANDS = new Set(["heading", "code", "quote", "bullets"]);
const AGENT_COMMANDS = new Set(["ask", "research", "link", "summarize"]);

function normalizeDraftContent(input: string): string {
	return stripSlashCommandLines(input).trimEnd();
}

function normalizeDraftTitle(input: string): string {
	return input.trim() || "Untitled note";
}

function extractSlashCommandLines(input: string): string[] {
	return input
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => SLASH_COMMAND_LINE_PATTERN.test(line));
}

function stripSlashCommandLines(input: string): string {
	const lines = input.split("\n");
	const filtered = lines.filter((line) => !SLASH_COMMAND_LINE_PATTERN.test(line.trim()));
	return filtered.join("\n").trimEnd();
}

function classifySlashInstruction(rawInput: string): SlashInstruction {
	const raw = rawInput.trim();
	if (!raw.startsWith("/")) {
		return {
			kind: "none",
			commandName: null,
			argument: raw,
			raw,
		};
	}

	const match = raw.match(/^\/([a-z-]+)\s*(.*)$/i);
	if (!match) {
		return {
			kind: "freeform",
			commandName: null,
			argument: "",
			raw,
		};
	}

	const commandName = (match[1] ?? "").toLowerCase();
	const argument = (match[2] ?? "").trim();

	if (EDITOR_FORMATTING_COMMANDS.has(commandName)) {
		return {
			kind: "editor",
			commandName,
			argument,
			raw,
		};
	}

	if (AGENT_COMMANDS.has(commandName)) {
		return {
			kind: "agent",
			commandName,
			argument,
			raw,
		};
	}

	return {
		kind: "freeform",
		commandName,
		argument,
		raw,
	};
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

export function NoteEditor({
	noteId,
	title,
	initialContent,
	onCapture,
	onSaveNoteContent,
	onArchiveNote,
	onEditorInput,
	isCapturing,
	externalRunRequest,
	markdownMode = "edit",
	focusToken,
}: NoteEditorProps) {
	const sanitizedInitialContent = normalizeDraftContent(initialContent);
	const normalizedInitialTitle = normalizeDraftTitle(title);

	const [noteTitle, setNoteTitle] = useState(normalizedInitialTitle);
	const [noteContent, setNoteContent] = useState(sanitizedInitialContent);

	const noteContentRef = useRef(sanitizedInitialContent);
	const titleRef = useRef(normalizedInitialTitle);
	const lastAcknowledgedContentRef = useRef(sanitizedInitialContent);
	const lastAcknowledgedTitleRef = useRef(normalizedInitialTitle);
	const syncedNoteIdRef = useRef(noteId);
	const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const saveInFlightRef = useRef<Promise<boolean> | null>(null);

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

	const runCommandIntent = useCallback(
		async (source: "explicit" | "close", forcedCommand?: string) => {
			const pendingCommands = forcedCommand
				? [forcedCommand]
				: extractSlashCommandLines(noteContentRef.current);
			const baselineContent = stripSlashCommandLines(noteContentRef.current);
			let transformedContent = baselineContent;
			const captureCommands: string[] = [];

			for (const commandLine of pendingCommands) {
				const instruction = classifySlashInstruction(commandLine);
				if (instruction.kind === "editor" && instruction.commandName) {
					transformedContent = applyEditorFormatting(
						transformedContent,
						instruction.commandName,
						instruction.argument,
					);
					continue;
				}

				captureCommands.push(instruction.raw);
			}

			if (transformedContent !== baselineContent) {
				setNoteContent(transformedContent);
				noteContentRef.current = transformedContent;
			}

			await flushSave({
				silent: source === "close",
				content: transformedContent,
			});

			const shouldRunCapture = source === "explicit" || captureCommands.length > 0;
			if (!shouldRunCapture) {
				return;
			}

			let userInput = captureCommands.join("\n").trim();
			if (userInput.length === 0 && source === "explicit") {
				userInput = transformedContent.trim();
			}

			if (userInput.length === 0) {
				if (source === "explicit") {
					await flushSave({ silent: false });
				}
				return;
			}

			let streamedContent = "";
			let sawStreamingUpdate = false;

			try {
				await onCapture(
					{
						noteId,
						userInput,
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
			} catch {
				if (sawStreamingUpdate) {
					setNoteContent(transformedContent);
					noteContentRef.current = transformedContent;
				}

				if (source === "explicit") {
					await flushSave({
						silent: false,
						content: transformedContent,
					});
				}
			}
		},
		[flushSave, noteId, onCapture],
	);

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
		if (!externalRunRequest?.command) {
			return;
		}

		void runCommandIntent("explicit", externalRunRequest.command);
	}, [externalRunRequest?.nonce, externalRunRequest?.command, runCommandIntent]);

	useEffect(() => {
		if (focusToken === undefined) {
			return;
		}

		const target = document.querySelector<HTMLElement>("[contenteditable='true']");
		target?.focus();
	}, [focusToken]);

	useEffect(() => {
		return () => {
			clearAutosaveTimer();
			if (extractSlashCommandLines(noteContentRef.current).length > 0) {
				void runCommandIntent("close");
				return;
			}

			void flushSave({ silent: true });
		};
	}, [clearAutosaveTimer, flushSave, runCommandIntent]);

	const handleRename = async () => {
		const nextTitle = window.prompt("Rename note", titleRef.current);
		if (nextTitle === null) {
			return;
		}

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

	return (
		<div className="relative">
			<div className="absolute top-0 right-0 z-10 flex items-center gap-1">
				<Button
					size="sm"
					variant="outline"
					disabled={isCapturing}
					onClick={() => {
						onEditorInput();
						void runCommandIntent("explicit");
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
								disabled={isCapturing}
							/>
						}
					>
						⋯
					</DropdownMenu.Trigger>
					<DropdownMenu.Content>
						<DropdownMenu.Group>
							<DropdownMenu.Label>Note options</DropdownMenu.Label>
							<DropdownMenu.Separator />
							<DropdownMenu.Item
								onClick={() => {
									void handleRename();
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
			</div>

			{markdownMode === "edit" ? (
				<PmMarkdownEditor
					label="Note content"
					value={noteContent}
					autoFocus
					className="min-h-40 pr-28"
					onChangeMarkdown={(nextMarkdown) => {
						onEditorInput();
						setNoteContent(nextMarkdown);
						noteContentRef.current = nextMarkdown;
					}}
					onBlur={() => {
						void flushSave({ silent: true });
					}}
					onRunShortcut={() => {
						void runCommandIntent("explicit");
					}}
					placeholder="Write your note. Add slash commands like /summarize on separate lines."
				/>
			) : (
				<div className="bg-kumo-base min-h-40 rounded-md p-4 pr-28">
					<article className="prose prose-neutral text-kumo-default max-w-none">
						<ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeSanitize]}>
							{noteContent.trim().length > 0 ? noteContent : "_Nothing to preview yet._"}
						</ReactMarkdown>
					</article>
				</div>
			)}
		</div>
	);
}
