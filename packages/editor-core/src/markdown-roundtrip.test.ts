import { describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseMarkdownToCanonical, serializeCanonicalMarkdown } from "./index";

const FIXTURE_DIR = join(import.meta.dir, "__fixtures__/markdown");
const FIXTURE_FILES = readdirSync(FIXTURE_DIR)
	.filter((fileName) => fileName.endsWith(".md"))
	.sort();

describe("markdown roundtrip fixtures", () => {
	it("has fixture coverage", () => {
		expect(FIXTURE_FILES.length).toBeGreaterThan(0);
	});

	for (const fixtureFile of FIXTURE_FILES) {
		it(`round-trips canonical markdown for ${fixtureFile}`, () => {
			const markdown = readFileSync(join(FIXTURE_DIR, fixtureFile), "utf-8");
			const canonical = parseMarkdownToCanonical(markdown);
			const serialized = serializeCanonicalMarkdown(canonical);
			const reparsed = parseMarkdownToCanonical(serialized);
			const reserialized = serializeCanonicalMarkdown(reparsed);

			expect(reserialized).toBe(serialized);
			expect(serialized).toMatchSnapshot();
		});
	}
});
