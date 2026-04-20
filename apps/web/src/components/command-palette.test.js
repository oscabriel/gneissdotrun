import { describe, expect, it } from "bun:test";

import { workspacePaletteItems } from "./command-palette.tsx";

describe("workspace command palette items", () => {
	it("removes the dead directory search action", () => {
		expect(workspacePaletteItems.some((item) => item.id === "focus-directory")).toBe(false);
		expect(
			workspacePaletteItems.some(
				(item) => item.action.kind === "focus" && item.action.target === "editor",
			),
		).toBe(true);
	});
});
