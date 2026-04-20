import { describe, expect, it } from "bun:test";

import { detectCodeLanguage } from "./code-language";
import { normalizeCodeLanguage } from "./shiki";

describe("shiki helpers", () => {
	it("detects markdown language classes", () => {
		expect(detectCodeLanguage("language-tsx")).toBe("tsx");
	});

	it("normalizes aliases and falls back to text", () => {
		expect(normalizeCodeLanguage("js")).toBe("javascript");
		expect(normalizeCodeLanguage("totally-unknown-lang")).toBe("text");
	});
});
