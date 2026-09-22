import { LanguagesEnum } from '@gauzy/contracts';

/**
 * Language code → country flag asset mapping for the system languages (LanguagesEnum).
 * Emoji flags don't render on Windows, so small SVG flags are vendored under
 * apps/gauzy/src/assets/images/flags.
 */
const LANGUAGE_FLAG_COUNTRIES: Record<string, string> = {
	[LanguagesEnum.ENGLISH]: 'gb',
	[LanguagesEnum.BULGARIAN]: 'bg',
	[LanguagesEnum.HEBREW]: 'il',
	[LanguagesEnum.RUSSIAN]: 'ru',
	[LanguagesEnum.FRENCH]: 'fr',
	[LanguagesEnum.SPANISH]: 'es',
	[LanguagesEnum.CHINESE]: 'cn',
	[LanguagesEnum.GERMAN]: 'de',
	[LanguagesEnum.PORTUGUESE]: 'pt',
	[LanguagesEnum.ITALIAN]: 'it',
	[LanguagesEnum.DUTCH]: 'nl',
	[LanguagesEnum.POLISH]: 'pl',
	[LanguagesEnum.ARABIC]: 'sa'
};

/**
 * Returns the flag asset URL for a language code, or null when no flag is vendored
 * (callers hide the image and fall back to the plain language name).
 *
 * @param code - Language code (e.g. 'en', 'pt-br').
 */
export function getLanguageFlagUrl(code: string): string | null {
	if (!code) {
		return null;
	}
	const country = LANGUAGE_FLAG_COUNTRIES[code.toLowerCase().split('-')[0]];
	return country ? `assets/images/flags/${country}.svg` : null;
}
