import { describe, expect, it } from "bun:test";

import { parseMarkdownToCanonicalArtifacts } from "./index";

describe("markdown unsupported-node fallback", () => {
	it("emits deterministic fallback text for unsupported block nodes", () => {
		const markdown = "| a | b |\n| - | - |\n| 1 | 2 |\n";
		const artifacts = parseMarkdownToCanonicalArtifacts(markdown);

		expect(artifacts.unsupportedNodes).toContainEqual({
			type: "table",
			fallback: "[unsupported:table]",
		});
		expect(artifacts.canonical.blocks[0]).toEqual({
			type: "paragraph",
			inlines: [{ type: "text", value: "[unsupported:table]" }],
		});
	});
});
