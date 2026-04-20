import { emitWorkspaceDevtoolsEvent } from "@/lib/devtools/workspace-devtools";

export interface EditorTelemetryEvent {
	event: "parse-error" | "serialize-error" | "plugin-error" | "parse-latency";
	detail: Record<string, string | number | boolean | null>;
}

export function reportEditorTelemetry(event: EditorTelemetryEvent): void {
	if (event.event === "parse-latency") {
		const durationMs = Number(event.detail.durationMs ?? 0);
		if (durationMs < 16) {
			return;
		}
	}

	emitWorkspaceDevtoolsEvent("editor-diagnostic", {
		kind: event.event,
		source: "editor-telemetry",
		detail: event.detail,
		timestamp: Date.now(),
	});
	console.info("[editor-telemetry]", event.event, event.detail);
}

export function reportEditorError(
	event: EditorTelemetryEvent["event"],
	error: unknown,
	detail?: EditorTelemetryEvent["detail"],
): void {
	emitWorkspaceDevtoolsEvent("editor-diagnostic", {
		kind: event,
		source: "editor-telemetry",
		message: error instanceof Error ? error.message : String(error),
		detail: detail,
		timestamp: Date.now(),
	});
	console.error("[editor-telemetry]", event, error, detail ?? {});
}
