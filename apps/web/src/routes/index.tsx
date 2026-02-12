import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: HomeComponent,
});

const TITLE_TEXT = `
 ██████╗ ███╗   ██╗███████╗██╗███████╗███████╗   ██████╗ ██╗   ██╗███╗   ██╗
██╔════╝ ████╗  ██║██╔════╝██║██╔════╝██╔════╝   ██╔══██╗██║   ██║████╗  ██║
██║  ███╗██╔██╗ ██║█████╗  ██║███████╗███████╗   ██████╔╝██║   ██║██╔██╗ ██║
██║   ██║██║╚██╗██║██╔══╝  ██║╚════██║╚════██║   ██╔══██╗██║   ██║██║╚██╗██║
╚██████╔╝██║ ╚████║███████╗██║███████║███████║██╗██║  ██║╚██████╔╝██║ ╚████║
 ╚═════╝ ╚═╝  ╚═══╝╚══════╝╚═╝╚══════╝╚══════╝╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
`;

function HomeComponent() {
	return (
		<div className="container mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center px-4 text-center">
			<pre className="mb-6 overflow-x-auto font-mono text-lg sm:text-xl">{TITLE_TEXT}</pre>
			<p className="text-muted-foreground mb-4 font-mono text-sm">/naɪs dɑt rʌn/</p>
			<p className="text-muted-foreground mt-2 text-lg font-medium tracking-[0.35em] uppercase">
				THINK MORE SORT LESS
			</p>
			<p className="text-muted-foreground mt-32 text-lg font-medium italic">Coming soon.</p>
		</div>
	);
}
