import { createStableId } from "./shared";

interface RewriteRequestSeed {
	noteId: string;
	userInput: string;
	messageCount: number;
}

export interface RewriteStatusPayload {
	eventId: string;
	requestId: string;
	status: "started" | "persisted" | "skipped";
	noteId: string;
	routeKind:
		| "new_note"
		| "update_existing"
		| "correction"
		| "split"
		| "fan_out"
		| "workspace_action"
		| "ephemeral_answer"
		| "store_preference"
		| "duplicate";
	hint: string;
	emittedAt: number;
}

export function createRewriteRequestId(seed: RewriteRequestSeed): string {
	const normalized = `${seed.noteId.trim().toLowerCase()}|${seed.messageCount}|${seed.userInput.trim().toLowerCase()}`;
	return createStableId("rewrite-request", normalized);
}

export function createRewriteStatusPayload(input: {
	requestId: string;
	status: RewriteStatusPayload["status"];
	noteId: string;
	routeKind: RewriteStatusPayload["routeKind"];
	emittedAt?: number;
}): RewriteStatusPayload {
	return {
		eventId: createStableId("rewrite-status", `${input.requestId}:${input.status}`),
		requestId: input.requestId,
		status: input.status,
		noteId: input.noteId,
		routeKind: input.routeKind,
		hint:
			input.status === "started"
				? "Generating rewrite..."
				: input.status === "persisted"
					? "Rewrite saved to note."
					: "No rewrite changes were persisted.",
		emittedAt: input.emittedAt ?? Date.now(),
	};
}

export function createRewriteRoutingEventId(requestId: string): string {
	return createStableId("rewrite-routing", requestId);
}
