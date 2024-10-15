import { LanguagesEnum } from '@gauzy/contracts';

/**
 * Utility function to get the browser language and fall back to a default if needed.
 * @returns {string} The browser language or the default language.
 */
export function getBrowserLanguage(): string {
	const browserLang = window.navigator.language.split('-')[0]; // Get base language code
	const supportedLanguages = Object.values(LanguagesEnum); // List of supported languages

	// Check if the browser language is supported; otherwise, return default
	return supportedLanguages.includes(browserLang as LanguagesEnum) ? browserLang : LanguagesEnum.ENGLISH;
}
