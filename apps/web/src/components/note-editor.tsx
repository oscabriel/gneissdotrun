import { Button, DropdownMenu } from "@cloudflare/kumo";
import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

import { MarkdownProjectionEditor } from "@/components/markdown-projection-editor";

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
}

type SlashInstructionKind = "none" | "editor" | "agent" | "freeform";

interface SlashInstruction {
	kind: SlashInstructionKind;
	commandName: string | null;
	argument: string;
	raw: string;
}

const WIKI_LINK_PATTERN = /\[\[([^\]]+)\]\]/g;
const SLASH_COMMAND_LINE_PATTERN = /^\s*\/[a-z-]+(?:\s+.*)?\s*$/i;
const AUTOSAVE_DELAY_MS = 1000;

const EDITOR_FORMATTING_COMMANDS = new Set(["heading", "code", "quote", "bullets"]);
const AGENT_COMMANDS = new Set(["ask", "research", "link", "summarize"]);

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

function toRenderableMarkdown(input: string): string {
	return input.replace(WIKI_LINK_PATTERN, (_fullMatch, label: string) => {
		const normalized = label.trim();
		if (!normalized) {
			return "";
		}

		return `[[${normalized}]](/collections?query=${encodeURIComponent(normalized)})`;
	});
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
}: NoteEditorProps) {
	const [noteTitle, setNoteTitle] = useState(title);
	const [noteContent, setNoteContent] = useState(stripSlashCommandLines(initialContent));
	const [isEditingNote, setIsEditingNote] = useState(false);

	const noteTextareaRef = useRef<HTMLTextAreaElement | null>(null);
	const noteContentRef = useRef(stripSlashCommandLines(initialContent));
	const titleRef = useRef(title);
	const lastAcknowledgedContentRef = useRef(stripSlashCommandLines(initialContent));
	const lastAcknowledgedTitleRef = useRef(title);
	const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const saveInFlightRef = useRef<Promise<boolean> | null>(null);

	const resizeNoteTextarea = useCallback(() => {
		const textarea = noteTextareaRef.current;
		if (!textarea) {
			return;
		}

		textarea.style.height = "0px";
		textarea.style.height = `${textarea.scrollHeight}px`;
	}, []);

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

			const contentToSave = (
				options?.content ?? stripSlashCommandLines(noteContentRef.current)
			).trimEnd();
			const titleToSave = (options?.title ?? titleRef.current).trim() || "Untitled note";

			const isDirty =
				contentToSave !== lastAcknowledgedContentRef.current ||
				titleToSave !== lastAcknowledgedTitleRef.current;
			if (!isDirty) {
				return false;
			}

			const savePromise = (async () => {
				try {
					await onSaveNoteContent(
						{
							noteId,
							content: contentToSave,
							title: titleToSave,
						},
						{ silent: options?.silent ?? true },
					);
					lastAcknowledgedContentRef.current = contentToSave;
					lastAcknowledgedTitleRef.current = titleToSave;
					titleRef.current = titleToSave;
					setNoteTitle(titleToSave);
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
			if (pendingCommands.length === 0) {
				if (source === "explicit") {
					await flushSave({ silent: false });
				}
				return;
			}

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
				title: titleRef.current,
			});

			if (captureCommands.length === 0) {
				return;
			}

			let streamedContent = "";
			let sawStreamingUpdate = false;

			try {
				await onCapture(
					{
						noteId,
						userInput: captureCommands.join("\n"),
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
			}
		},
		[flushSave, noteId, onCapture],
	);

	useEffect(() => {
		const sanitized = stripSlashCommandLines(initialContent);

		setNoteTitle(title);
		titleRef.current = title;
		lastAcknowledgedTitleRef.current = title;
		setNoteContent(sanitized);
		noteContentRef.current = sanitized;
		lastAcknowledgedContentRef.current = sanitized;
	}, [initialContent, noteId, title]);

	useEffect(() => {
		setIsEditingNote(false);
	}, [noteId]);

	useEffect(() => {
		if (!isEditingNote) {
			return;
		}

		noteTextareaRef.current?.focus();
	}, [isEditingNote]);

	useLayoutEffect(() => {
		if (!isEditingNote) {
			return;
		}

		resizeNoteTextarea();
	}, [isEditingNote, noteContent, resizeNoteTextarea]);

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
		return () => {
			clearAutosaveTimer();
			if (extractSlashCommandLines(noteContentRef.current).length > 0) {
				void runCommandIntent("close");
				return;
			}

			void flushSave({ silent: true });
		};
	}, [clearAutosaveTimer, flushSave, runCommandIntent]);

	const markdownContent = useMemo(() => toRenderableMarkdown(noteContent), [noteContent]);

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
			<div className="absolute top-0 right-0 z-10">
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

			{isEditingNote ? (
				<MarkdownProjectionEditor
					label="Note content"
					tone="document"
					ref={noteTextareaRef}
					className="min-h-40 pr-14"
					rows={1}
					value={noteContent}
					onChange={(event) => {
						onEditorInput();
						setNoteContent(event.target.value);
						noteContentRef.current = event.target.value;
					}}
					onBlur={() => {
						setIsEditingNote(false);
						void flushSave({ silent: true });
					}}
					onKeyDown={(event: KeyboardEvent<HTMLTextAreaElement>) => {
						if (event.nativeEvent.isComposing) {
							return;
						}

						if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
							event.preventDefault();
							void runCommandIntent("explicit");
							return;
						}

						if (event.key === "Escape") {
							event.preventDefault();
							setIsEditingNote(false);
						}
					}}
					placeholder="Write your note. Add slash commands like /summarize on separate lines."
				/>
			) : (
				<div
					className="bg-kumo-base min-h-30 cursor-text rounded-md p-4 pr-14 font-serif text-[15px] leading-7 [&_h1]:mt-1 [&_h1]:text-3xl [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:text-xl [&_h3]:font-semibold [&_h4]:mt-2 [&_h4]:text-lg [&_h4]:font-semibold [&_li]:my-1 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-3 [&_strong]:font-semibold [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6"
					onClick={(event) => {
						if ((event.target as HTMLElement).closest("a")) {
							return;
						}
						onEditorInput();
						setIsEditingNote(true);
					}}
				>
					{noteContent.trim().length > 0 ? (
						<ReactMarkdown
							remarkPlugins={[remarkGfm]}
							rehypePlugins={[rehypeSanitize]}
							components={{
								a: ({ ...props }) => (
									<a {...props} className="text-kumo-link underline underline-offset-2" />
								),
							}}
						>
							{markdownContent}
						</ReactMarkdown>
					) : (
						"No note content yet."
					)}
				</div>
			)}
		</div>
	);
}
