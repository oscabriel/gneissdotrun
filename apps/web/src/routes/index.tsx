import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { env } from "@gneissdotrun/env/web";

import { CommandPalette } from "@/components/command-palette/CommandPalette";
import { NoteEditor } from "@/components/editor/NoteEditor";
import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { UploadPanel } from "@/components/uploads/UploadPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import {
	useIndexAgent,
	type IndexAgentState,
	type RewriteRoutingContext,
} from "@/lib/agents/hooks";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

interface CreatedNote {
	id: string;
	title: string;
	content: string;
	tags: string[];
	updatedAt: number;
}

const DEFAULT_ROUTING_CONTEXT: RewriteRoutingContext = {
	kind: "new_note",
	confidence: 0.5,
	reason: "Blank note capture entry point.",
	tags: ["capture"],
	target: "rewrite-agent",
};

function HomeComponent() {
	const { data: session, isPending } = authClient.useSession();
	const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
	const [title, setTitle] = useState("");
	const [draft, setDraft] = useState("");
	const [activeNote, setActiveNote] = useState<CreatedNote | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [routerDecision, setRouterDecision] = useState<RewriteRoutingContext | null>(null);

	const createNote = async () => {
		setError(null);
		setIsCreating(true);

		try {
			const response = await fetch(`${env.VITE_SERVER_URL}/api/notes`, {
				method: "POST",
				headers: {
					"content-type": "application/json",
				},
				credentials: "include",
				body: JSON.stringify({
					title,
					content: draft,
					tags: [],
				}),
			});

			if (!response.ok) {
				const payload = (await response.json()) as { error?: string };
				throw new Error(payload.error ?? "Failed to create note");
			}

			const payload = (await response.json()) as { note: CreatedNote };
			setActiveNote(payload.note);

			if (draft.trim().length > 0) {
				const routeResponse = await fetch(`${env.VITE_SERVER_URL}/api/notes/route`, {
					method: "POST",
					headers: {
						"content-type": "application/json",
					},
					credentials: "include",
					body: JSON.stringify({
						noteId: payload.note.id,
						userInput: draft,
					}),
				});

				if (!routeResponse.ok) {
					const routePayload = (await routeResponse.json()) as { error?: string };
					throw new Error(routePayload.error ?? "Failed to route note input");
				}

				const routePayload = (await routeResponse.json()) as {
					decision: RewriteRoutingContext;
				};

				setRouterDecision(routePayload.decision);
				setActiveNote((previous) =>
					previous
						? {
								...previous,
								tags: routePayload.decision.tags ?? [],
							}
						: previous,
				);
			}
		} catch (createError) {
			setError(createError instanceof Error ? createError.message : "Failed to create note");
		} finally {
			setIsCreating(false);
		}
	};

	if (isPending) {
		return (
			<div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4">
				<p className="text-muted-foreground text-sm">Loading session...</p>
			</div>
		);
	}

	if (!session) {
		return (
			<div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-4">
				<div className="mb-4 text-center">
					<h1 className="text-3xl font-semibold tracking-tight">Gneiss Capture</h1>
					<p className="text-muted-foreground mt-2 text-sm">
						Sign in to use the blank-note capture and agent rewrite flow.
					</p>
				</div>

				{authMode === "signin" ? (
					<SignInForm onSwitchToSignUp={() => setAuthMode("signup")} />
				) : (
					<SignUpForm onSwitchToSignIn={() => setAuthMode("signin")} />
				)}
			</div>
		);
	}

	return (
		<div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-4 px-4 py-6">
			{session?.user.id ? (
				<IndexAgentSubscriber
					userId={session.user.id}
					activeNote={activeNote}
					onSelectNote={setActiveNote}
				/>
			) : null}
			<header className="border-border flex flex-col gap-2 border-b pb-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
						Phase 2 Capture
					</p>
					<h1 className="text-2xl font-semibold tracking-tight">Blank note workspace</h1>
				</div>
				<Button
					variant="outline"
					onClick={() => {
						setActiveNote(null);
						setTitle("");
						setDraft("");
						setError(null);
					}}
				>
					New note session
				</Button>
			</header>

			<CommandPalette
				onSelectCommand={(command) => {
					setDraft((value) => `${value}${value.length > 0 ? "\n" : ""}${command} `);
				}}
			/>

			{activeNote ? (
				<div className="space-y-4">
					<NoteEditor
						noteId={activeNote.id}
						userId={session.user.id}
						title={activeNote.title}
						initialContent={activeNote.content}
						routingContext={routerDecision ?? DEFAULT_ROUTING_CONTEXT}
					/>
					<UploadPanel noteId={activeNote.id} />
				</div>
			) : (
				<section className="border-border bg-card space-y-3 rounded-none border p-4">
					<p className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
						Start with a blank note
					</p>
					<Input
						value={title}
						onChange={(event) => {
							setTitle(event.target.value);
						}}
						placeholder="Optional title"
					/>
					<textarea
						value={draft}
						onChange={(event) => {
							setDraft(event.target.value);
						}}
						className="border-border bg-background min-h-[220px] w-full rounded-none border p-3 text-sm leading-relaxed"
						placeholder="Write your raw capture here, then start the note session."
					/>
					<div className="flex items-center gap-2">
						<Button onClick={() => void createNote()} disabled={isCreating}>
							{isCreating ? "Creating..." : "Create note session"}
						</Button>
						{error ? <span className="text-destructive text-xs">{error}</span> : null}
					</div>
				</section>
			)}
		</div>
	);
}

function IndexAgentSubscriber({
	userId,
	activeNote,
	onSelectNote,
}: {
	userId: string;
	activeNote: CreatedNote | null;
	onSelectNote: (note: CreatedNote) => void;
}) {
	useIndexAgent({
		userId,
		onStateUpdate: (state: IndexAgentState) => {
			if (activeNote || !state.notes.length) {
				return;
			}

			const latest = state.notes[0];
			onSelectNote({
				id: latest.id,
				title: latest.title,
				content: "",
				tags: [],
				updatedAt: latest.updatedAt,
			});
		},
	});

	return null;
}
