import { JSDOM } from "jsdom";

if (typeof document === "undefined") {
	const dom = new JSDOM("<!doctype html><html><body></body></html>", {
		url: "https://editor-pm.test",
	});
	const globalWithDom = globalThis as unknown as {
		window: Window;
		document: Document;
		navigator: Navigator;
		requestAnimationFrame?: (callback: FrameRequestCallback) => number;
		cancelAnimationFrame?: (handle: number) => void;
	};
	globalWithDom.window = dom.window as unknown as Window;
	globalWithDom.document = dom.window.document;
	globalWithDom.navigator = dom.window.navigator;
	globalWithDom.requestAnimationFrame = (callback) =>
		setTimeout(() => callback(performance.now()), 16) as unknown as number;
	globalWithDom.cancelAnimationFrame = (handle) =>
		clearTimeout(handle as unknown as ReturnType<typeof setTimeout>);
}
