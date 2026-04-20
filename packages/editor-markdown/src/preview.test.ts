import { describe, expect, it } from "bun:test";

import { canonicalToPreviewText, markdownToPreviewText } from "./preview";

describe("markdown preview text", () => {
	it("flattens supported markdown into compact preview copy", () => {
		expect(
			markdownToPreviewText(`# Launch plan

This **week** we ship [[Alpha]].

- Confirm rollout
- Share notes

| Area | Owner |
| --- | --- |
| API | Ops |

	console.log("ready")

![Diagram](https://example.com/diagram.png)
`),
		).toBe(
			[
				"Launch plan",
				"This week we ship Alpha.",
				"- Confirm rollout",
				"- Share notes",
				"Area | Owner",
				"API | Ops",
				'console.log("ready")',
				"Diagram",
			].join("\n\n"),
		);
	});

	it("handles canonical list and image blocks directly", () => {
		expect(
			canonicalToPreviewText({
				blocks: [
					{
						type: "list",
						ordered: true,
						start: 1,
						tight: true,
						items: [
							{
								type: "listItem",
								checked: null,
								blocks: [
									{
										type: "paragraph",
										inlines: [{ type: "text", value: "First step" }],
									},
								],
							},
							{
								type: "listItem",
								checked: true,
								blocks: [
									{
										type: "paragraph",
										inlines: [{ type: "text", value: "Second step" }],
									},
								],
							},
						],
					},
					{
						type: "image",
						url: "https://example.com/cover.png",
						alt: "Cover sketch",
						title: null,
					},
				],
			}),
		).toBe(["1. First step", "[x] Second step", "Cover sketch"].join("\n\n"));
	});
});
