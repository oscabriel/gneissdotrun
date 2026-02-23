import { describe, expect, it } from "bun:test";

import { parseProjectionMarkdown, serializeProjectionMarkdown } from "./markdown-projection";

const MARKDOWN_FIXTURE = [
	"# Heading **bold** and *italic*",
	"",
	"> Quote with [example](https://example.com)",
	"- [x] Task with [[Wiki Link]] and `code`",
	"1. Ordered item",
	"```ts",
	"const value = 42;",
	"",
	"```",
	"Paragraph tail",
].join("\n");

describe("markdown projection", () => {
	it("round-trips markdown through projection parsing", () => {
		const projection = parseProjectionMarkdown(MARKDOWN_FIXTURE);
		const serialized = serializeProjectionMarkdown(projection);

		expect(serialized).toBe(MARKDOWN_FIXTURE);
		expect(serialized).toMatchSnapshot();
	});

	it("projects markdown lines into stable structural output", () => {
		const projection = parseProjectionMarkdown(MARKDOWN_FIXTURE);
		expect(projection).toMatchSnapshot();
	});
});
