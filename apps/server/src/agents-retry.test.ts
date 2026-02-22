import assert from "node:assert/strict";
import { describe, it } from "bun:test";

const { RetryableAgentError, shouldRetryTransientError } = await import("./agents/shared/retry");

describe("retry guards", () => {
	it("retries transient failures and blocks permanent failures", () => {
		assert.equal(
			shouldRetryTransientError(new RetryableAgentError("temporary", { status: 503 })),
			true,
		);
		assert.equal(shouldRetryTransientError(new Error("connection timeout")), true);
		assert.equal(shouldRetryTransientError(new Error("api key is missing")), false);
		assert.equal(
			shouldRetryTransientError(new RetryableAgentError("bad request", { status: 400 })),
			false,
		);
	});
});
