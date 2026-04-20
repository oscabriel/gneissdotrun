import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { ensureSessionQueryData } from "@/lib/queries/session";

const LazyWorkspaceShell = lazy(async () => {
	const module = await import("@/components/workspace/workspace-shell");
	return { default: module.WorkspaceShell };
});

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
	loader: ({ context }) => ensureSessionQueryData(context.queryClient),
	component: HomeRoute,
});

function HomeRoute() {
	const session = Route.useLoaderData();
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
		<Suspense
			fallback={
				<div className="bg-kumo-base text-kumo-subtle flex min-h-screen items-center justify-center text-sm">
					Loading workspace...
				</div>
			}
		>
			<LazyWorkspaceShell
				userId={session.user.id}
				selectedNoteId={search.noteId ?? null}
				onSelectNoteId={handleSelectNoteId}
			/>
		</Suspense>
	);
}
