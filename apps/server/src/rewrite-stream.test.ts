import assert from "node:assert/strict";
import { describe, it } from "bun:test";

import {
	createRewriteRequestId,
	createRewriteRoutingEventId,
	createRewriteStatusPayload,
} from "./agents/rewrite-stream";

describe("rewrite stream ids", () => {
	it("creates a stable request id for reconnect-safe replays", () => {
		const requestA = createRewriteRequestId({
			noteId: "note-1",
			userInput: "Rewrite this paragraph",
			messageCount: 4,
		});
		const requestB = createRewriteRequestId({
			noteId: "note-1",
			userInput: "Rewrite this paragraph",
			messageCount: 4,
		});
		const requestC = createRewriteRequestId({
			noteId: "note-1",
			userInput: "Rewrite this paragraph",
			messageCount: 5,
		});

		assert.equal(requestA, requestB);
		assert.notEqual(requestA, requestC);
	});

	it("builds deterministic event ids and transient hints", () => {
		const requestId = createRewriteRequestId({
			noteId: "note-2",
			userInput: "Summarize this",
			messageCount: 3,
		});

		const started = createRewriteStatusPayload({
			requestId,
			status: "started",
			noteId: "note-2",
			routeKind: "update_existing",
			emittedAt: 123,
		});
		const replayedStarted = createRewriteStatusPayload({
			requestId,
			status: "started",
			noteId: "note-2",
			routeKind: "update_existing",
			emittedAt: 456,
		});
		const persisted = createRewriteStatusPayload({
			requestId,
			status: "persisted",
			noteId: "note-2",
			routeKind: "update_existing",
		});

		assert.equal(started.eventId, replayedStarted.eventId);
		assert.notEqual(started.eventId, persisted.eventId);
		assert.equal(started.hint, "Generating rewrite...");
		assert.equal(persisted.hint, "Rewrite saved to note.");
		assert.equal(createRewriteRoutingEventId(requestId), createRewriteRoutingEventId(requestId));
	});
});
