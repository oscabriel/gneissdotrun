import { describe, expect, it } from "bun:test";

import { canonicalToPmDoc, markdownToPmDoc, pmDocToCanonical, pmDocToMarkdown } from "./adapters";

describe("editor-pm adapters", () => {
	it("maps canonical document to prosemirror and back for tasks, links, images, and tables", () => {
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
							blocks: [
								{
									type: "paragraph",
									inlines: [
										{
											type: "link",
											url: "https://example.com",
											title: null,
											inlines: [{ type: "text", value: "Task" }],
										},
									],
								},
							],
						},
					],
				},
				{ type: "image", url: "https://cdn.example.com/a.png", alt: "Alt", title: "Title" },
				{
					type: "table",
					rows: [
						{
							type: "tableRow",
							cells: [
								{
									type: "tableCell",
									header: true,
									blocks: [{ type: "paragraph", inlines: [{ type: "text", value: "A" }] }],
								},
								{
									type: "tableCell",
									header: true,
									blocks: [{ type: "paragraph", inlines: [{ type: "text", value: "B" }] }],
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
				},
			],
		} as const;

		const pm = canonicalToPmDoc(canonical);
		expect(pm.type).toBe("doc");
		expect(pm.content?.[2]?.type).toBe("image");
		expect(pm.content?.[3]?.type).toBe("table");

		const roundTrip = pmDocToCanonical(pm);
		expect(roundTrip.blocks[1]?.type).toBe("list");
		expect(roundTrip.blocks[2]).toEqual(canonical.blocks[2]);
		expect(roundTrip.blocks[3]?.type).toBe("table");
	});

	it("maps markdown through PM JSON with wiki links, blockquotes, task lists, and tables", () => {
		const markdown = [
			"Visit [[Roadmap]] and [example](https://example.com).",
			"> quoted line",
			"- [x] done",
			"",
			"| c1 | c2 |",
			"| -- | -- |",
			"| v1 | v2 |",
		].join("\n");

		const pm = markdownToPmDoc(markdown);
		const serialized = pmDocToMarkdown(pm);

		expect(serialized).toContain("[[Roadmap]]");
		expect(serialized).toContain("https://example.com");
		expect(serialized).toContain("> quoted line");
		expect(serialized).toContain("- [x] done");
		expect(serialized).toContain("| c1 | c2 |");
	});

	it("keeps wiki-link attribute in PM link marks", () => {
		const pm = markdownToPmDoc("[[Daily/2026-02-23]]");
		const markAttrs = pm.content?.[0]?.content?.[0]?.marks?.[0]?.attrs as
			| Record<string, string>
			| undefined;
		expect(markAttrs?.["data-wiki-link"]).toBe("Daily/2026-02-23");
	});
});
