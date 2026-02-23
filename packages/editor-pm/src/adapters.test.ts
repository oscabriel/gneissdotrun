import { describe, expect, it } from "bun:test";

import { canonicalToPmDoc, markdownToPmDoc, pmDocToCanonical, pmDocToMarkdown } from "./adapters";

describe("editor-pm adapters", () => {
	it("maps canonical document to prosemirror and back", () => {
		const canonical = {
			blocks: [
				{ type: "heading", level: 2, inlines: [{ type: "text", value: "Title" }] },
				{
					type: "list",
					ordered: false,
					start: 1,
					tight: true,
					items: [
						{
							type: "listItem",
							checked: true,
							blocks: [{ type: "paragraph", inlines: [{ type: "text", value: "Task" }] }],
						},
					],
				},
			],
		} as const;

		const pm = canonicalToPmDoc(canonical);
		expect(pm.type).toBe("doc");

		const roundTrip = pmDocToCanonical(pm);
		expect(roundTrip.blocks[0]).toEqual(canonical.blocks[0]);
		expect(roundTrip.blocks[1]?.type).toBe("list");
	});

	it("maps markdown through PM JSON with wiki links", () => {
		const markdown = "Visit [[Roadmap]] and [example](https://example.com).";
		const pm = markdownToPmDoc(markdown);
		const serialized = pmDocToMarkdown(pm);

		expect(serialized).toContain("[[Roadmap]]");
		expect(serialized).toContain("https://example.com");
	});
});
