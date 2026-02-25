import { beforeAll, describe, expect, it, mock } from "bun:test";
import { fireEvent, render, waitFor } from "@testing-library/react";
import { JSDOM } from "jsdom";
import type { ComponentProps } from "react";
import React from "react";

if (typeof window === "undefined") {
	const dom = new JSDOM("<!doctype html><html><body></body></html>", {
		url: "https://example.test",
	});
	(globalThis as typeof globalThis & { window: Window }).window = dom.window as unknown as Window;
	(globalThis as typeof globalThis & { document: Document }).document = dom.window.document;
	(globalThis as typeof globalThis & { navigator: Navigator }).navigator = dom.window
		.navigator as unknown as Navigator;
	(globalThis as typeof globalThis & { HTMLElement: typeof HTMLElement }).HTMLElement = dom.window
		.HTMLElement as typeof HTMLElement;
	(globalThis as typeof globalThis & { Node: typeof Node }).Node = dom.window.Node as typeof Node;
}

if (!(HTMLElement.prototype as { attachEvent?: () => void }).attachEvent) {
	(HTMLElement.prototype as { attachEvent: () => void }).attachEvent = () => {};
}

if (!(HTMLElement.prototype as { detachEvent?: () => void }).detachEvent) {
	(HTMLElement.prototype as { detachEvent: () => void }).detachEvent = () => {};
}

mock.module("@cloudflare/kumo", () => {
	const Button = (props: Record<string, unknown>) => <button type="button" {...props} />;
	const DropdownMenuRoot = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
	const DropdownMenuTrigger = ({
		children,
		render,
	}: {
		children: React.ReactNode;
		render: React.ReactNode;
	}) => (
		<div>
			{render}
			{children}
		</div>
	);
	const DropdownMenuContent = ({ children }: { children: React.ReactNode }) => (
		<div>{children}</div>
	);
	const DropdownMenuGroup = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
	const DropdownMenuLabel = ({ children }: { children: React.ReactNode }) => <div>{children}</div>;
	const DropdownMenuSeparator = () => <hr />;
	const DropdownMenuItem = ({
		children,
		onClick,
	}: {
		children: React.ReactNode;
		onClick?: () => void;
	}) => (
		<button type="button" onClick={onClick}>
			{children}
		</button>
	);
	const DropdownMenu = Object.assign(DropdownMenuRoot, {
		Trigger: DropdownMenuTrigger,
		Content: DropdownMenuContent,
		Group: DropdownMenuGroup,
		Label: DropdownMenuLabel,
		Separator: DropdownMenuSeparator,
		Item: DropdownMenuItem,
	});
	return {
		Button,
		DropdownMenu,
	};
});

mock.module("@/components/pm-markdown-editor", () => {
	const PmMarkdownEditor = ({
		label,
		value,
		placeholder,
		className,
		autoFocus,
		onChangeMarkdown,
		onBlur,
		onRunShortcut,
		onKeyDown,
	}: {
		label: string;
		value: string;
		placeholder?: string;
		className?: string;
		autoFocus?: boolean;
		onChangeMarkdown: (value: string) => void;
		onBlur?: () => void;
		onRunShortcut?: () => void;
		onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
	}) => (
		<input
			aria-label={label}
			value={value}
			placeholder={placeholder}
			className={className}
			autoFocus={autoFocus}
			onChange={(event) => {
				onChangeMarkdown(event.target.value);
			}}
			onInput={(event) => {
				onChangeMarkdown((event.target as HTMLInputElement).value);
			}}
			onBlur={onBlur}
			onKeyDown={(event) => {
				onKeyDown?.(event as unknown as React.KeyboardEvent<HTMLDivElement>);
				if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
					onRunShortcut?.();
				}
			}}
		/>
	);

	return {
		PmMarkdownEditor,
	};
});

let NoteEditor: (
	props: ComponentProps<(typeof import("./note-editor"))["NoteEditor"]>,
) => JSX.Element;

beforeAll(async () => {
	({ NoteEditor } = await import("./note-editor"));
});

function renderEditor(overrides?: Partial<ComponentProps<typeof NoteEditor>>) {
	const onCapture = mock(async () => {});
	const onSaveNoteContent = mock(async () => {});
	const onArchiveNote = mock(async () => {});
	const onEditorInput = mock(() => {});

	const props: ComponentProps<typeof NoteEditor> = {
		noteId: "note-1",
		title: "Note",
		initialContent: "Initial note",
		onCapture,
		onSaveNoteContent,
		onArchiveNote,
		onEditorInput,
		isCapturing: false,
		externalRunRequest: null,
		...overrides,
	};

	const result = render(<NoteEditor {...props} />);
	return {
		...result,
		props,
		onCapture,
		onSaveNoteContent,
		onArchiveNote,
		onEditorInput,
	};
}

describe("note editor runtime integration", () => {
	it("keeps the editor mounted after blur", async () => {
		const view = renderEditor();

		const input = await view.findByLabelText("Note content");
		fireEvent.change(input, { target: { value: "Updated line" } });
		fireEvent.blur(input);

		await waitFor(() => {
			expect(view.getByLabelText("Note content")).toBeTruthy();
		});
	});

	it("does not clobber unsaved local edits when props refresh for the same note", async () => {
		const view = renderEditor({
			noteId: "note-1",
			initialContent: "Server draft",
			title: "Server title",
		});

		const input = await view.findByLabelText("Note content");
		fireEvent.input(input, { target: { value: "Local unsaved draft" } });

		await waitFor(() => {
			expect((view.getByLabelText("Note content") as HTMLInputElement).value).toBe(
				"Local unsaved draft",
			);
		});

		view.rerender(
			<NoteEditor
				{...view.props}
				noteId="note-1"
				title="Server title (updated)"
				initialContent="Server draft (updated remotely)"
			/>,
		);

		expect((view.getByLabelText("Note content") as HTMLInputElement).value).toBe(
			"Local unsaved draft",
		);
	});

	it("opens directly in edit mode for empty notes", async () => {
		const view = renderEditor({
			initialContent: "",
		});

		expect(await view.findByLabelText("Note content")).toBeTruthy();
	});

	it("routes Cmd+Enter through capture for regular note content", async () => {
		const view = renderEditor({
			initialContent: "Capture this paragraph",
		});

		const input = await view.findByLabelText("Note content");
		fireEvent.focus(input);
		fireEvent.keyDown(input, {
			key: "Enter",
			code: "Enter",
			ctrlKey: true,
		});

		await waitFor(() => {
			expect(view.onCapture).toHaveBeenCalledTimes(1);
			expect(view.onCapture).toHaveBeenCalledWith(
				{ noteId: "note-1", userInput: "Capture this paragraph" },
				expect.any(Object),
			);
		});
	});

	it("routes Run button through capture", async () => {
		const view = renderEditor({
			initialContent: "Run this note",
		});

		fireEvent.click(view.getByText("Run"));

		await waitFor(() => {
			expect(view.onCapture).toHaveBeenCalledTimes(1);
			expect(view.onCapture).toHaveBeenCalledWith(
				{ noteId: "note-1", userInput: "Run this note" },
				expect.any(Object),
			);
		});
	});

	it("supports command execution flows", async () => {
		const view = renderEditor({
			initialContent: "",
			externalRunRequest: {
				command: "/ask summarize this",
				nonce: 1,
			},
		});
		const { onCapture } = view;

		await waitFor(() => {
			expect(onCapture).toHaveBeenCalledTimes(1);
		});

		const input = await view.findByLabelText("Note content");
		fireEvent.blur(input);
		await waitFor(() => {
			expect(view.getByLabelText("Note content")).toBeTruthy();
		});
	});
});
