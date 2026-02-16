import type { RouteExecutionOutcome } from "@gneissdotrun/api/capture-contract";

export interface CaptureUiIntent {
	openNoteId: string | null;
	resetCanvas: boolean;
	showToast: boolean;
	showEphemeral: boolean;
}

export function mapOutcomeToUiIntent(outcome: RouteExecutionOutcome): CaptureUiIntent {
	switch (outcome.kind) {
		case "new_note":
		case "update_existing":
		case "correction":
		case "split":
		case "fan_out":
			return {
				openNoteId: outcome.noteId ?? null,
				resetCanvas: false,
				showToast: Boolean(outcome.toast),
				showEphemeral: false,
			};
		case "ephemeral_answer":
			return {
				openNoteId: null,
				resetCanvas: true,
				showToast: Boolean(outcome.toast),
				showEphemeral: true,
			};
		case "workspace_action":
		case "store_preference":
		case "duplicate":
			return {
				openNoteId: null,
				resetCanvas: true,
				showToast: Boolean(outcome.toast),
				showEphemeral: false,
			};
		default:
			return {
				openNoteId: null,
				resetCanvas: outcome.uiAction !== "open_note",
				showToast: Boolean(outcome.toast),
				showEphemeral: outcome.uiAction === "show_ephemeral",
			};
	}
}
