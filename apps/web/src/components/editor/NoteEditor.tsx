import type { UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";

import {
	useRewriteAgentChat,
	type RewriteAgentState,
	type RewriteRoutingContext,
} from "@/lib/agents/hooks";

import { Button } from "../ui/button";
import { Input } from "../ui/input";

interface NoteEditorProps {
	noteId: string;
	userId: string;
	title: string;
	initialContent: string;
	routingContext: RewriteRoutingContext;
}

interface SlashCommandResult {
	cleaned: string;
	commands: string[];
}

function parseSlashCommands(input: string): SlashCommandResult {
	const lines = input.split("\n");
	const commands: string[] = [];
	const cleanedLines: string[] = [];

	for (const line of lines) {
		const trimmed = line.trim();
		if (trimmed.startsWith("/")) {
			commands.push(trimmed);
			continue;
		}
		cleanedLines.push(line);
	}

	return {
		cleaned: cleanedLines.join("\n").trimEnd(),
		commands,
	};
}

function extractText(message: UIMessage): string {
	return message.parts
		.filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
		.map((part) => part.text)
		.join("")
		.trim();
}

export function NoteEditor({
	noteId,
	userId,
	title,
	initialContent,
	routingContext,
}: NoteEditorProps) {
	const [noteContent, setNoteContent] = useState(initialContent);
	const [prompt, setPrompt] = useState("");
	const [pendingRemoteUpdate, setPendingRemoteUpdate] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const lastAcknowledgedContentRef = useRef(initialContent);
	const noteContentRef = useRef(initialContent);

	const { agent, messages, sendMessage, status } = useRewriteAgentChat({
		noteId,
		onStateUpdate: (state: RewriteAgentState) => {
			const incoming = state.noteContent;
			const lastAck = lastAcknowledgedContentRef.current;
			const hasLocalEdits = noteContentRef.current !== lastAck;

			if (hasLocalEdits && incoming !== noteContentRef.current) {
				setPendingRemoteUpdate(incoming);
				setStatusMessage("Incoming update available. Review before applying.");
				return;
			}

			lastAcknowledgedContentRef.current = incoming;
			setPendingRemoteUpdate(null);
			setStatusMessage(null);
			setNoteContent(incoming);
		},
	});

	useEffect(() => {
		setNoteContent(initialContent);
		lastAcknowledgedContentRef.current = initialContent;
		noteContentRef.current = initialContent;
		setPendingRemoteUpdate(null);
		setStatusMessage(null);
		agent.setState({
			noteId,
			userId,
			title,
			noteContent: initialContent,
			routingContext,
			updatedAt: Date.now(),
		});
	}, [agent, initialContent, noteId, routingContext, title, userId]);

	useEffect(() => {
		noteContentRef.current = noteContent;
	}, [noteContent]);

	const latestAssistantText = useMemo(() => {
		for (let index = messages.length - 1; index >= 0; index -= 1) {
			const message = messages[index];
			if (!message || message.role !== "assistant") {
				continue;
			}

			const text = extractText(message);
			if (text.length > 0) {
				return text;
			}
		}

		return "";
	}, [messages]);

	useEffect(() => {
		if (latestAssistantText.length === 0) {
			return;
		}

		const lastAck = lastAcknowledgedContentRef.current;
		const hasLocalEdits = noteContentRef.current !== lastAck;
		if (hasLocalEdits) {
			setPendingRemoteUpdate(latestAssistantText);
			setStatusMessage("Agent finished a rewrite. Apply when ready.");
			return;
		}

		lastAcknowledgedContentRef.current = latestAssistantText;
		setPendingRemoteUpdate(null);
		setStatusMessage(null);
		setNoteContent(latestAssistantText);
		agent.setState({
			noteId,
			userId,
			title,
			noteContent: latestAssistantText,
			routingContext,
			updatedAt: Date.now(),
		});
	}, [agent, latestAssistantText, noteId, routingContext, title, userId]);

	const submitPrompt = async () => {
		const trimmed = prompt.trim();
		if (trimmed.length === 0) {
			return;
		}

		const parsedPrompt = parseSlashCommands(trimmed);
		const commandText = parsedPrompt.commands.join("\n");
		const text = parsedPrompt.cleaned;
		const payload = [text, commandText].filter((value) => value.length > 0).join("\n\n");
		if (payload.trim().length === 0) {
			setPrompt("");
			return;
		}

		if (parsedPrompt.commands.length > 0 && parsedPrompt.cleaned !== noteContent) {
			setNoteContent(parsedPrompt.cleaned);
			lastAcknowledgedContentRef.current = parsedPrompt.cleaned;
			noteContentRef.current = parsedPrompt.cleaned;
			agent.setState({
				noteId,
				userId,
				title,
				noteContent: parsedPrompt.cleaned,
				routingContext,
				updatedAt: Date.now(),
			});
		}

		await sendMessage({
			role: "user",
			parts: [{ type: "text", text: payload }],
		});

		setPrompt("");
	};

	const applyPendingUpdate = () => {
		if (!pendingRemoteUpdate) {
			return;
		}

		lastAcknowledgedContentRef.current = pendingRemoteUpdate;
		setNoteContent(pendingRemoteUpdate);
		setPendingRemoteUpdate(null);
		setStatusMessage(null);
		agent.setState({
			noteId,
			userId,
			title,
			noteContent: pendingRemoteUpdate,
			routingContext,
			updatedAt: Date.now(),
		});
	};

	const keepLocalEdits = () => {
		setPendingRemoteUpdate(null);
		setStatusMessage("Kept local edits. Agent update dismissed.");
	};

	const promptHint = useMemo(() => {
		const trimmed = prompt.trim();
		if (!trimmed.startsWith("/")) {
			return null;
		}

		const parsed = parseSlashCommands(trimmed);
		if (!parsed.commands.length) {
			return null;
		}

		return `Slash commands queued: ${parsed.commands.join(", ")}`;
	}, [prompt]);

	return (
		<div className="grid gap-4 md:grid-cols-2">
			<section className="space-y-2">
				<p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">Current note</p>
				{pendingRemoteUpdate ? (
					<div className="border-border bg-card space-y-2 border px-3 py-2 text-xs">
						<p className="text-muted-foreground">{statusMessage ?? "Remote update waiting."}</p>
						<div className="flex flex-wrap gap-2">
							<Button variant="outline" size="sm" onClick={applyPendingUpdate}>
								Apply update
							</Button>
							<Button variant="ghost" size="sm" onClick={keepLocalEdits}>
								Keep local edits
							</Button>
						</div>
					</div>
				) : statusMessage ? (
					<p className="text-muted-foreground text-xs">{statusMessage}</p>
				) : null}
				<textarea
					value={noteContent}
					onChange={(event) => {
						setNoteContent(event.target.value);
					}}
					className="border-border bg-background min-h-[360px] w-full rounded-none border p-3 text-sm leading-relaxed"
				/>
				<p className="text-muted-foreground text-xs">
					Slash commands are routed to the agent and removed from the note surface.
				</p>
			</section>

			<section className="space-y-2">
				<p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">Streaming output</p>
				<div className="border-border bg-card min-h-[360px] overflow-y-auto rounded-none border p-3 text-sm leading-relaxed">
					{latestAssistantText.length > 0
						? latestAssistantText
						: "Waiting for the first rewrite..."}
				</div>
			</section>

			<section className="space-y-2 md:col-span-2">
				<p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">Interaction</p>
				<div className="flex flex-col gap-2 sm:flex-row">
					<Input
						value={prompt}
						onChange={(event) => {
							setPrompt(event.target.value);
						}}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								void submitPrompt();
							}
						}}
						placeholder="Ask RewriteAgent to reshape this note"
					/>
					<Button onClick={() => void submitPrompt()} disabled={status === "streaming"}>
						{status === "streaming" ? "Rewriting..." : "Go"}
					</Button>
				</div>
				{promptHint ? <p className="text-muted-foreground text-xs">{promptHint}</p> : null}
			</section>
		</div>
	);
}
