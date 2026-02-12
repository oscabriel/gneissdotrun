import type { UIMessage } from "ai";
import { useEffect, useMemo, useState } from "react";

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
	initialContent: string;
	routingContext: RewriteRoutingContext;
}

function extractText(message: UIMessage): string {
	return message.parts
		.filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
		.map((part) => part.text)
		.join("")
		.trim();
}

export function NoteEditor({ noteId, userId, initialContent, routingContext }: NoteEditorProps) {
	const [noteContent, setNoteContent] = useState(initialContent);
	const [prompt, setPrompt] = useState("");

	const { agent, messages, sendMessage, status } = useRewriteAgentChat({
		noteId,
		onStateUpdate: (state: RewriteAgentState) => {
			setNoteContent(state.noteContent);
		},
	});

	useEffect(() => {
		setNoteContent(initialContent);
		agent.setState({
			noteId,
			userId,
			noteContent: initialContent,
			routingContext,
			updatedAt: Date.now(),
		});
	}, [agent, initialContent, noteId, routingContext, userId]);

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

		setNoteContent(latestAssistantText);
		agent.setState({
			noteId,
			userId,
			noteContent: latestAssistantText,
			routingContext,
			updatedAt: Date.now(),
		});
	}, [agent, latestAssistantText, noteId, routingContext, userId]);

	const submitPrompt = async () => {
		const trimmed = prompt.trim();
		if (trimmed.length === 0) {
			return;
		}

		await sendMessage({
			role: "user",
			parts: [{ type: "text", text: trimmed }],
		});

		setPrompt("");
	};

	return (
		<div className="grid gap-4 md:grid-cols-2">
			<section className="space-y-2">
				<p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">Current note</p>
				<textarea
					value={noteContent}
					onChange={(event) => {
						setNoteContent(event.target.value);
					}}
					className="border-border bg-background min-h-[360px] w-full rounded-none border p-3 text-sm leading-relaxed"
				/>
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
			</section>
		</div>
	);
}
