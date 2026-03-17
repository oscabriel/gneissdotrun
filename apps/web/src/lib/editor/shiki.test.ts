import { describe, expect, it } from "bun:test";

import { detectCodeLanguage, normalizeCodeLanguage } from "@/lib/editor/shiki";

describe("shiki helpers", () => {
	it("detects markdown language classes", () => {
		expect(detectCodeLanguage("language-tsx")).toBe("tsx");
	});

	it("normalizes aliases and falls back to text", () => {
		expect(normalizeCodeLanguage("js")).toBe("javascript");
		expect(normalizeCodeLanguage("totally-unknown-lang")).toBe("text");
	});
});
