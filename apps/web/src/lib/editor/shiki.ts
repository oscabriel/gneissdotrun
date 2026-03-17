import {
	bundledLanguagesInfo,
	codeToHtml,
	codeToTokensWithThemes,
	type BundledLanguage,
	type ThemedTokenWithVariants,
} from "shiki";

const SHIKI_THEMES = {
	light: "github-light",
	dark: "github-dark",
} as const;

const bundledLanguageSet = new Set<string>(bundledLanguagesInfo.map((entry) => entry.id));
const languageAliasMap = new Map<string, BundledLanguage>();

for (const language of bundledLanguagesInfo) {
	for (const alias of language.aliases ?? []) {
		languageAliasMap.set(alias.toLowerCase(), language.id as BundledLanguage);
	}
}

const htmlCache = new Map<string, Promise<string>>();
const tokenCache = new Map<string, Promise<ThemedTokenWithVariants[][]>>();

function getCacheKey(code: string, language: string): string {
	return `${language}\u0000${code}`;
}

export function detectCodeLanguage(input?: string | null): string | null {
	if (!input) {
		return null;
	}

	const match = input.match(/language-([^\s]+)/i);
	if (match?.[1]) {
		return match[1];
	}

	return input.trim().length > 0 ? input.trim() : null;
}

export function normalizeCodeLanguage(input?: string | null): string {
	const candidate = detectCodeLanguage(input)?.toLowerCase();
	if (!candidate) {
		return "text";
	}

	if (bundledLanguageSet.has(candidate)) {
		return candidate as BundledLanguage;
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
		lang: normalizedLanguage as BundledLanguage,
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
		lang: normalizedLanguage as BundledLanguage,
		themes: SHIKI_THEMES,
	}).catch((error) => {
		tokenCache.delete(cacheKey);
		throw error;
	});
	tokenCache.set(cacheKey, result);
	return result;
}
