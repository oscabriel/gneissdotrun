const REWRITE_STATUS_VALUES = new Set(["started", "persisted", "skipped"]);
const ROUTE_KIND_VALUES = new Set([
	"new_note",
	"update_existing",
	"correction",
	"split",
	"fan_out",
	"workspace_action",
	"ephemeral_answer",
	"store_preference",
	"duplicate",
]);

type RewriteRouteKind =
	| "new_note"
	| "update_existing"
	| "correction"
	| "split"
	| "fan_out"
	| "workspace_action"
	| "ephemeral_answer"
	| "store_preference"
	| "duplicate";

interface RewriteRoutingContextShape {
	kind: RewriteRouteKind;
	confidence: number;
	reason: string;
	tags: string[];
	target: "rewrite-agent" | "organization-agent" | "none";
}

export interface RewriteRoutingDataPart {
	eventId: string;
	requestId: string;
	prompt: string;
	routing: RewriteRoutingContextShape;
	emittedAt: number;
}

export interface RewriteStatusDataPart {
	eventId: string;
	requestId: string;
	status: "started" | "persisted" | "skipped";
	noteId: string;
	routeKind: RewriteRouteKind;
	hint: string;
        emittedAt: number;
}

export type RewriteTransientDataChunk =
	| {
			kind: "routing";
			payload: RewriteRoutingDataPart;
	  }
	| {
			kind: "status";
			payload: RewriteStatusDataPart;
	  };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

export function parseRoutingDataPart(chunk: unknown): RewriteRoutingDataPart | null {
	if (!isRecord(chunk) || chunk.type !== "data-routing" || !isRecord(chunk.data)) {
		return null;
	}

	const data = chunk.data;
	if (
		typeof data.eventId !== "string" ||
		typeof data.requestId !== "string" ||
		typeof data.prompt !== "string" ||
		typeof data.emittedAt !== "number" ||
		!isRecord(data.routing)
	) {
		return null;
	}

	return data as unknown as RewriteRoutingDataPart;
}

export function parseStatusDataPart(chunk: unknown): RewriteStatusDataPart | null {
	if (!isRecord(chunk) || chunk.type !== "data-rewrite-status" || !isRecord(chunk.data)) {
		return null;
	}

	const data = chunk.data;
	if (
		typeof data.eventId !== "string" ||
		typeof data.requestId !== "string" ||
		typeof data.status !== "string" ||
		typeof data.noteId !== "string" ||
		typeof data.routeKind !== "string" ||
		typeof data.emittedAt !== "number"
	) {
		return null;
	}

	if (!REWRITE_STATUS_VALUES.has(data.status) || !ROUTE_KIND_VALUES.has(data.routeKind)) {
		return null;
	}

	const hint =
		typeof data.hint === "string"
			? data.hint
			: data.status === "started"
				? "Generating rewrite..."
				: data.status === "persisted"
					? "Rewrite saved to note."
					: "No rewrite changes were persisted.";

	return {
		eventId: data.eventId,
		requestId: data.requestId,
		status: data.status as RewriteStatusDataPart["status"],
		noteId: data.noteId,
		routeKind: data.routeKind as RewriteStatusDataPart["routeKind"],
		hint,
		emittedAt: data.emittedAt,
	};
}

export function consumeTransientDataChunk(
	seenEventIds: Set<string>,
	chunk: unknown,
): RewriteTransientDataChunk | null {
	const routingData = parseRoutingDataPart(chunk);
	if (routingData) {
		if (seenEventIds.has(routingData.eventId)) {
			return null;
		}

		seenEventIds.add(routingData.eventId);
		return {
			kind: "routing",
			payload: routingData,
		};
	}

	const statusData = parseStatusDataPart(chunk);
	if (!statusData) {
		return null;
	}

	if (seenEventIds.has(statusData.eventId)) {
		return null;
	}

	seenEventIds.add(statusData.eventId);
	return {
		kind: "status",
		payload: statusData,
	};
}
