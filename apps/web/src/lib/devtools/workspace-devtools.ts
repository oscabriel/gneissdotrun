type EditorDiagnosticKind =
	| "rich-support-loading"
	| "rich-support-ready"
	| "rich-support-error"
	| "parse-error"
	| "serialize-error"
	| "plugin-error"
	| "parse-latency";

type WorkspaceCaptureAction = "capture" | "organize" | "fanout";
type WorkspaceCapturePhase = "start" | "rewrite" | "persisting" | "success" | "error";
type NotePersistenceAction = "create" | "save" | "archive" | "restore";
type NotePersistenceStatus = "success" | "error";

export interface WorkspaceDevtoolsEventMap {
	"editor-diagnostic": {
		kind: EditorDiagnosticKind;
		source: string;
		message?: string;
		detail?: Record<string, string | number | boolean | null>;
		timestamp: number;
	};
	"workspace-capture": {
		action: WorkspaceCaptureAction;
		phase: WorkspaceCapturePhase;
		noteId?: string | null;
		noteIds?: string[];
		streaming?: boolean;
		durationMs?: number;
		message?: string;
		timestamp: number;
	};
	"note-persistence": {
		action: NotePersistenceAction;
		status: NotePersistenceStatus;
		noteId?: string | null;
		silent?: boolean;
		durationMs?: number;
		message?: string;
		timestamp: number;
	};
}

interface WorkspaceDevtoolsClient {
	emit<TEvent extends keyof WorkspaceDevtoolsEventMap & string>(
		event: TEvent,
		payload: WorkspaceDevtoolsEventMap[TEvent],
	): void;
}

let clientPromise: Promise<WorkspaceDevtoolsClient | null> | null = null;

function getWorkspaceDevtoolsClient(): Promise<WorkspaceDevtoolsClient | null> {
	if (!import.meta.env.DEV) {
		return Promise.resolve(null);
	}

	if (!clientPromise) {
		clientPromise = import("@tanstack/devtools-event-client")
			.then(({ EventClient }) => {
				return new EventClient<WorkspaceDevtoolsEventMap>({
					pluginId: "gneiss-web",
					enabled: true,
					debug: false,
				});
			})
			.catch(() => null);
	}

	return clientPromise;
}

export function emitWorkspaceDevtoolsEvent<TEvent extends keyof WorkspaceDevtoolsEventMap & string>(
	event: TEvent,
	payload: WorkspaceDevtoolsEventMap[TEvent],
): void {
	if (!import.meta.env.DEV) {
		return;
	}

	void getWorkspaceDevtoolsClient().then((client) => {
		client?.emit(event, payload);
	});
}
