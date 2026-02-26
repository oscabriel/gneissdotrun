export const routeExecutionKinds = [
	"new_note",
	"update_existing",
	"correction",
	"split",
	"fan_out",
	"workspace_action",
	"ephemeral_answer",
	"store_preference",
	"duplicate",
] as const;

export type RouteExecutionKind = (typeof routeExecutionKinds)[number];

export type RouteExecutionUiAction = "open_note" | "stay_blank" | "show_ephemeral" | "show_toast";

export type RouteExecutionSecondaryEffect = {
	type:
		| "updated_note"
		| "created_note"
		| "queued_fanout"
		| "fanout_skipped_no_targets"
		| "fanout_queue_failed"
		| "action_executed"
		| "preference_saved";
	id?: string;
	label?: string;
};

export type CaptureSideEffect = {
	name: "index_upsert" | "index_remove" | "history" | "organize_refresh" | "fanout_queue";
	status: "ok" | "failed" | "skipped";
	detail?: string;
};

export type FanOutQueueStatus = "queued" | "skipped-no-targets" | "queue_failed";

export type RouteExecutionOutcome = {
	kind: RouteExecutionKind;
	uiAction: RouteExecutionUiAction;
	noteId?: string;
	noteIds?: string[];
	toast?: {
		message: string;
		tone?: "info" | "success" | "warning" | "error";
	};
	ephemeral?: {
		content: string;
		dismiss: "on_input" | "timeout";
		timeoutMs?: number;
	};
	secondaryEffects?: RouteExecutionSecondaryEffect[];
	result?: "success" | "partial_success";
	sideEffects?: CaptureSideEffect[];
	fanOut?: {
		status: FanOutQueueStatus;
		targetNoteIds: string[];
	};
};

export type CaptureErrorCode =
	| "INVALID_INPUT"
	| "UNAUTHORIZED"
	| "RATE_LIMITED"
	| "ROUTE_EXECUTION_FAILED"
	| "DEPENDENCY_UNAVAILABLE"
	| "INTERNAL";

export type CaptureError = {
	error: {
		code: CaptureErrorCode;
		message: string;
		recoverable: boolean;
	};
};
