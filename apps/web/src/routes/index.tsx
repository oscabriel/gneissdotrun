import { createFileRoute } from "@tanstack/react-router";
import { Surface } from "@cloudflare/kumo";
import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
	validateSearch: (search: Record<string, unknown>): { noteId?: string } => {
		const noteId =
			typeof search.noteId === "string" && search.noteId.trim().length > 0
				? search.noteId
				: undefined;

		if (!noteId) {
			return {};
		}

		return { noteId };
	},
	component: HomeRoute,
});

function HomeRoute() {
	const { data: session, isPending } = authClient.useSession();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

	const handleSelectNoteId = (noteId: string | null) => {
		void navigate({
			search: (previous) => ({
				...previous,
				noteId: noteId ?? undefined,
			}),
			replace: false,
		});
	};

	if (isPending) {
		return (
			<div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-6">
				<Surface className="w-full max-w-xl p-8 text-center">
					<p className="text-kumo-subtle text-sm">Loading workspace...</p>
				</Surface>
			</div>
		);
	}

	if (!session) {
		return (
			<div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-4 py-6">
				<div className="mb-4 text-center">
					<h1 className="text-3xl font-semibold tracking-tight">Gneiss</h1>
					<p className="text-kumo-subtle mt-2 text-sm">
						Sign in to access the sidebar + canvas workspace shell.
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
		<WorkspaceShell
			userId={session.user.id}
			selectedNoteId={search.noteId ?? null}
			onSelectNoteId={handleSelectNoteId}
		/>
	);
}
