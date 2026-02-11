import { LanguagesEnum } from '@gauzy/contracts';

/**
 * Utility function to get the browser language and fall back to a default if needed.
 * Safe to call in non-browser environments (SSR / Node.js) — returns the default language.
 *
 * @returns {string} The browser language or the default language.
 */
export function getBrowserLanguage(): string {
	// Guard against non-browser environments (SSR / Node.js)
	if (typeof window === 'undefined' || !window.navigator) {
		return LanguagesEnum.ENGLISH;
	}

	const browserLang = window.navigator.language.split('-')[0]; // Get base language code
	const supportedLanguages = Object.values(LanguagesEnum); // List of supported languages

	// Check if the browser language is supported; otherwise, return default
	return supportedLanguages.includes(browserLang as LanguagesEnum) ? browserLang : LanguagesEnum.ENGLISH;
}
