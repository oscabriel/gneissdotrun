import assert from "node:assert/strict";
import { describe, it } from "bun:test";

import {
	deriveNoteTitleFromContent,
	rewriteTitleForStorage,
	sanitizeTitleForStorage,
	titleContainsLinks,
	UNTITLED_NOTE_TITLE,
} from "./note-title";

describe("note title sanitization", () => {
	it("detects wiki, markdown, and url links", () => {
		assert.equal(titleContainsLinks("[[Roadmap]]"), true);
		assert.equal(titleContainsLinks("[Roadmap](https://gneiss.run)"), true);
		assert.equal(titleContainsLinks("https://gneiss.run/docs"), true);
		assert.equal(titleContainsLinks("Quarterly planning"), false);
	});

	it("rewrites link syntax into plain text", () => {
		assert.equal(rewriteTitleForStorage("[[Roadmap]] updates"), "Roadmap updates");
		assert.equal(
			rewriteTitleForStorage("[Roadmap](https://gneiss.run) updates"),
			"Roadmap updates",
		);
		assert.equal(rewriteTitleForStorage("Updates https://gneiss.run/docs"), "Updates");
	});

	it("falls back to untitled when sanitized title is empty", () => {
		assert.equal(sanitizeTitleForStorage("https://gneiss.run/docs"), UNTITLED_NOTE_TITLE);
	});

	it("derives and sanitizes from content first line", () => {
		assert.equal(
			deriveNoteTitleFromContent("# [[Roadmap]] launch plan\n\nDetails..."),
			"Roadmap launch plan",
		);
	});
});
