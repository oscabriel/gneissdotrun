import {
	createBundledHighlighter,
	createSingletonShorthands,
	type SpecialLanguage,
	type ThemedTokenWithVariants,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

import { detectCodeLanguage } from "@/lib/editor/code-language";

const SHIKI_THEMES = {
	light: "github-light",
	dark: "github-dark",
} as const;

const shikiLanguageImports = {
	css: () => import("shiki/dist/langs/css.mjs"),
	diff: () => import("shiki/dist/langs/diff.mjs"),
	html: () => import("shiki/dist/langs/html.mjs"),
	javascript: () => import("shiki/dist/langs/javascript.mjs"),
	json: () => import("shiki/dist/langs/json.mjs"),
	jsx: () => import("shiki/dist/langs/jsx.mjs"),
	markdown: () => import("shiki/dist/langs/markdown.mjs"),
	python: () => import("shiki/dist/langs/python.mjs"),
	shellscript: () => import("shiki/dist/langs/shellscript.mjs"),
	sql: () => import("shiki/dist/langs/sql.mjs"),
	tsx: () => import("shiki/dist/langs/tsx.mjs"),
	typescript: () => import("shiki/dist/langs/typescript.mjs"),
	yaml: () => import("shiki/dist/langs/yaml.mjs"),
} as const;

const shikiThemeImports = {
	"github-dark": () => import("shiki/dist/themes/github-dark.mjs"),
	"github-light": () => import("shiki/dist/themes/github-light.mjs"),
} as const;

type SupportedCodeLanguage = keyof typeof shikiLanguageImports;
type SupportedTheme = keyof typeof shikiThemeImports;

const supportedLanguageSet = new Set<string>(Object.keys(shikiLanguageImports));
const languageAliasMap = new Map<string, SupportedCodeLanguage>([
	["bash", "shellscript"],
	["cjs", "javascript"],
	["htm", "html"],
	["jade", "html"],
	["js", "javascript"],
	["json5", "json"],
	["jsonc", "json"],
	["jsx", "jsx"],
	["md", "markdown"],
	["mdx", "markdown"],
	["mjs", "javascript"],
	["mts", "typescript"],
	["py", "python"],
	["sh", "shellscript"],
	["shell", "shellscript"],
	["ts", "typescript"],
	["tsx", "tsx"],
	["yml", "yaml"],
	["zsh", "shellscript"],
]);

const createHighlighter = createBundledHighlighter<SupportedCodeLanguage, SupportedTheme>({
	langs: shikiLanguageImports,
	themes: shikiThemeImports,
	engine: () => createJavaScriptRegexEngine(),
});

const { codeToHtml, codeToTokensWithThemes } = createSingletonShorthands(createHighlighter);

const htmlCache = new Map<string, Promise<string>>();
const tokenCache = new Map<string, Promise<ThemedTokenWithVariants[][]>>();

function getCacheKey(code: string, language: string): string {
	return `${language}\u0000${code}`;
}

export function normalizeCodeLanguage(input?: string | null): SupportedCodeLanguage | SpecialLanguage {
	const candidate = detectCodeLanguage(input)?.toLowerCase();
	if (!candidate) {
		return "text";
	}

	if (supportedLanguageSet.has(candidate)) {
		return candidate as SupportedCodeLanguage;
	}

	return languageAliasMap.get(candidate) ?? "text";
}

export async function highlightCodeToHtml(code: string, language?: string | null): Promise<string> {
	const normalizedLanguage = normalizeCodeLanguage(language);
	const cacheKey = getCacheKey(code, normalizedLanguage);
	const cached = htmlCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	const result = codeToHtml(code, {
		lang: normalizedLanguage,
		themes: SHIKI_THEMES,
	}).catch((error) => {
		htmlCache.delete(cacheKey);
		throw error;
	});
	htmlCache.set(cacheKey, result);
	return result;
}

export async function highlightCodeToTokens(
	code: string,
	language?: string | null,
): Promise<ThemedTokenWithVariants[][]> {
	const normalizedLanguage = normalizeCodeLanguage(language);
	const cacheKey = getCacheKey(code, normalizedLanguage);
	const cached = tokenCache.get(cacheKey);
	if (cached) {
		return cached;
	}

	const result = codeToTokensWithThemes(code, {
		lang: normalizedLanguage,
		themes: SHIKI_THEMES,
	}).catch((error) => {
		tokenCache.delete(cacheKey);
		throw error;
	});
	tokenCache.set(cacheKey, result);
	return result;
}
