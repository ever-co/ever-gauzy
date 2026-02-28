import { LanguagesEnum } from '@gauzy/contracts';

/**
 * Cached set of supported language codes for O(1) lookups.
 */
const SUPPORTED_LANGUAGES: ReadonlySet<string> = new Set(Object.values(LanguagesEnum));

/**
 * Detects the user's preferred language from the runtime environment.
 *
 * Detection order:
 * 1. `navigator.languages` — the user's full preference list (most reliable in browsers).
 *    Iterates the list and returns the first supported match.
 * 2. `navigator.language` — single locale string. Works in both browsers and Electron
 *    (Electron returns the OS locale here).
 * 3. Falls back to English.
 *
 * Safe to call in any environment:
 * - **Browser** — reads from `navigator.languages` / `navigator.language`
 * - **Electron / Desktop** — `navigator.language` returns the OS locale
 * - **SSR / Node.js** — returns English (no `navigator` available)
 *
 * @returns A supported language code (e.g. `'en'`, `'de'`), or English as the default.
 */
export function getBrowserLanguage(): string {
	// Guard against non-browser environments (SSR / Node.js / Web Workers)
	if (typeof window === 'undefined' || typeof navigator === 'undefined') {
		return LanguagesEnum.ENGLISH;
	}

	// Try navigator.languages first (ordered by user preference).
	// This picks the highest-priority language the app actually supports.
	if (navigator.languages?.length) {
		for (const lang of navigator.languages) {
			const base = lang.split('-')[0].toLowerCase();
			if (SUPPORTED_LANGUAGES.has(base)) {
				return base;
			}
		}
	}

	// Fall back to navigator.language (single locale, works in browsers & Electron)
	if (navigator.language) {
		const base = navigator.language.split('-')[0].toLowerCase();
		if (SUPPORTED_LANGUAGES.has(base)) {
			return base;
		}
	}

	return LanguagesEnum.ENGLISH;
}
