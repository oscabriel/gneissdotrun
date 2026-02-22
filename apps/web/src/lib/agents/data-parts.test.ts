import assert from "node:assert/strict";
import { describe, it } from "bun:test";

import { consumeTransientDataChunk } from "./data-parts";

describe("rewrite transient data parts", () => {
	it("parses and emits routing payloads", () => {
		const seen = new Set<string>();
		const chunk = {
			type: "data-routing",
			data: {
				eventId: "event-routing-1",
				requestId: "request-1",
				prompt: "rewrite this",
				routing: {
					kind: "update_existing",
					confidence: 0.82,
					reason: "user asked to update",
					tags: ["update"],
					target: "rewrite-agent",
				},
				emittedAt: Date.now(),
			},
		};

		const parsed = consumeTransientDataChunk(seen, chunk);
		assert.ok(parsed);
		assert.equal(parsed.kind, "routing");
		assert.equal(parsed.payload.eventId, "event-routing-1");
	});

	it("deduplicates replayed events across reconnects", () => {
		const seen = new Set<string>();
		const chunk = {
			type: "data-rewrite-status",
			data: {
				eventId: "event-status-1",
				requestId: "request-1",
				status: "persisted",
				noteId: "note-1",
				routeKind: "new_note",
				hint: "Rewrite saved to note.",
				emittedAt: Date.now(),
			},
		};

		const first = consumeTransientDataChunk(seen, chunk);
		assert.ok(first);

		const replayed = consumeTransientDataChunk(seen, chunk);
		assert.equal(replayed, null);
	});

	it("accepts sequential started/persisted statuses with stable request metadata", () => {
		const seen = new Set<string>();
		const started = consumeTransientDataChunk(seen, {
			type: "data-rewrite-status",
			data: {
				eventId: "rewrite-status-started",
				requestId: "rewrite-request-1",
				status: "started",
				noteId: "note-1",
				routeKind: "update_existing",
				hint: "Generating rewrite...",
				emittedAt: Date.now(),
			},
		});
		assert.ok(started);
		assert.equal(started.kind, "status");

		const persisted = consumeTransientDataChunk(seen, {
			type: "data-rewrite-status",
			data: {
				eventId: "rewrite-status-persisted",
				requestId: "rewrite-request-1",
				status: "persisted",
				noteId: "note-1",
				routeKind: "update_existing",
				hint: "Rewrite saved to note.",
				emittedAt: Date.now(),
			},
		});
		assert.ok(persisted);
		assert.equal(persisted.kind, "status");
	});

	it("ignores malformed stream chunks", () => {
		const seen = new Set<string>();
		assert.equal(
			consumeTransientDataChunk(seen, { type: "data-routing", data: { bad: true } }),
			null,
		);
		assert.equal(
			consumeTransientDataChunk(seen, {
				type: "data-rewrite-status",
				data: {
					eventId: "bad-status",
					requestId: "request-1",
					status: "started",
					noteId: "note-1",
					routeKind: "invalid_kind",
					hint: "Generating rewrite...",
					emittedAt: Date.now(),
				},
			}),
			null,
		);
		assert.equal(consumeTransientDataChunk(seen, { type: "text-delta", delta: "x" }), null);
	});
});
