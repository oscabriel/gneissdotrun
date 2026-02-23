import { JSDOM } from "jsdom";

if (typeof document === "undefined") {
	const dom = new JSDOM("<!doctype html><html><body></body></html>", {
		url: "https://editor-pm.test",
	});
	const globalWithDom = globalThis as unknown as {
		window: unknown;
		document: Document;
		navigator: Navigator;
	};
	globalWithDom.window = dom.window;
	globalWithDom.document = dom.window.document;
	globalWithDom.navigator = dom.window.navigator;
}
