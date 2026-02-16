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
	type: "updated_note" | "created_note" | "queued_fanout" | "action_executed" | "preference_saved";
	id?: string;
	label?: string;
};

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
