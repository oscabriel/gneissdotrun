import { describe, expect, it } from "bun:test";

import { parseMarkdownToCanonicalArtifacts } from "./index";

describe("markdown unsupported-node fallback", () => {
	it("parses GFM tables into canonical table blocks", () => {
		const markdown = "| a | b |\n| - | - |\n| 1 | 2 |\n";
		const artifacts = parseMarkdownToCanonicalArtifacts(markdown);

		expect(artifacts.unsupportedNodes).toHaveLength(0);
		expect(artifacts.canonical.blocks[0]).toEqual({
			type: "table",
			rows: [
				{
					type: "tableRow",
					cells: [
						{
							type: "tableCell",
							header: true,
							blocks: [{ type: "paragraph", inlines: [{ type: "text", value: "a" }] }],
						},
						{
							type: "tableCell",
							header: true,
							blocks: [{ type: "paragraph", inlines: [{ type: "text", value: "b" }] }],
						},
					],
				},
				{
					type: "tableRow",
					cells: [
						{
							type: "tableCell",
							header: false,
							blocks: [{ type: "paragraph", inlines: [{ type: "text", value: "1" }] }],
						},
						{
							type: "tableCell",
							header: false,
							blocks: [{ type: "paragraph", inlines: [{ type: "text", value: "2" }] }],
						},
					],
				},
			],
		});
	});
});
