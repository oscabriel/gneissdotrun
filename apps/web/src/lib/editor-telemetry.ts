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

	console.info("[editor-telemetry]", event.event, event.detail);
}

export function reportEditorError(
	event: EditorTelemetryEvent["event"],
	error: unknown,
	detail?: EditorTelemetryEvent["detail"],
): void {
	console.error("[editor-telemetry]", event, error, detail ?? {});
}
