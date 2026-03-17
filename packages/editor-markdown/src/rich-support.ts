import type { Code, Content, Root, Table } from "mdast";

import type { MarkdownParseArtifacts, MarkdownParseOptions } from "./markdown/types";
import { parseMarkdownToCanonicalArtifacts } from "./markdown/parse";

export type RichSupportIssueCode =
	| "unsupported-node"
	| "raw-html"
	| "code-fence-meta"
	| "table-alignment";

export interface RichSupportIssue {
	code: RichSupportIssueCode;
	message: string;
	detail?: string;
}

export interface RichSupportResult {
	supported: boolean;
	issues: RichSupportIssue[];
	artifacts: MarkdownParseArtifacts;
}

function visitMdast(node: Content | Root, visitor: (node: Content | Root) => void): void {
	visitor(node);
	if (!("children" in node) || !Array.isArray(node.children)) {
		return;
	}

	for (const child of node.children) {
		visitMdast(child as Content, visitor);
	}
}

function pushIssue(issues: RichSupportIssue[], nextIssue: RichSupportIssue): void {
	const duplicate = issues.some(
		(issue) => issue.code === nextIssue.code && issue.detail === nextIssue.detail,
	);
	if (!duplicate) {
		issues.push(nextIssue);
	}
}

export function analyzeRichModeSupport(
	markdown: string,
	options?: MarkdownParseOptions,
): RichSupportResult {
	const artifacts = parseMarkdownToCanonicalArtifacts(markdown, options);
	const issues: RichSupportIssue[] = artifacts.unsupportedNodes.map((node) => ({
		code: "unsupported-node",
		message: `Unsupported markdown node: ${node.type}`,
		detail: node.type,
	}));

	visitMdast(artifacts.mdast, (node) => {
		if (node.type === "html") {
			pushIssue(issues, {
				code: "raw-html",
				message: "Raw HTML is source-only.",
			});
			return;
		}

		if (node.type === "code") {
			const codeNode = node as Code;
			if (codeNode.meta && codeNode.meta.trim().length > 0) {
				pushIssue(issues, {
					code: "code-fence-meta",
					message: "Code fences with metadata are source-only.",
					detail: codeNode.meta,
				});
			}
			return;
		}

		if (node.type === "table") {
			const tableNode = node as Table;
			if ((tableNode.align ?? []).some((alignment) => alignment !== null)) {
				pushIssue(issues, {
					code: "table-alignment",
					message: "Aligned markdown tables are source-only.",
				});
			}
		}
	});

	return {
		supported: issues.length === 0,
		issues,
		artifacts,
	};
}

export function isRichModeSupported(markdown: string, options?: MarkdownParseOptions): boolean {
	return analyzeRichModeSupport(markdown, options).supported;
}
