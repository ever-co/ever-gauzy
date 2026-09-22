/**
 * ISO 3166-1 alpha-2 codes for EEA member states (EU 27 + EFTA 3) and the UK (GB).
 */
export const EEA_UK_COUNTRY_CODES: ReadonlySet<string> = new Set([
	// EU 27 Member States
	'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
	'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
	'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
	// EFTA EEA States
	'IS', 'LI', 'NO',
	// UK
	'GB', 'UK'
]);

/**
 * Full country names for EEA member states and UK (case-insensitive search).
 */
export const EEA_UK_COUNTRY_NAMES: ReadonlySet<string> = new Set([
	'austria', 'belgium', 'bulgaria', 'croatia', 'cyprus', 'czech republic', 'czechia',
	'denmark', 'estonia', 'finland', 'france', 'germany', 'greece', 'hungary',
	'ireland', 'italy', 'latvia', 'lithuania', 'luxembourg', 'malta', 'netherlands',
	'poland', 'portugal', 'romania', 'slovakia', 'slovenia', 'spain', 'sweden',
	'iceland', 'liechtenstein', 'norway', 'united kingdom', 'uk', 'great britain', 'england', 'scotland', 'wales'
]);

/**
 * Determines whether a region, country, or timezone belongs to the EEA or the UK.
 *
 * @param params Object containing optional regionCode, countryCode, country, or timeZone.
 * @returns boolean true if the location corresponds to EEA or UK, false otherwise.
 */
export function isEEAOrUKRegion(params?: {
	regionCode?: string;
	countryCode?: string;
	country?: string;
	timeZone?: string;
}): boolean {
	if (!params) {
		return false;
	}

	const { regionCode, countryCode, country, timeZone } = params;

	// Check 2-letter country code
	if (countryCode && EEA_UK_COUNTRY_CODES.has(countryCode.trim().toUpperCase())) {
		return true;
	}

	// Check country string
	if (country) {
		const normCountry = country.trim().toLowerCase();
		if (EEA_UK_COUNTRY_CODES.has(normCountry.toUpperCase()) || EEA_UK_COUNTRY_NAMES.has(normCountry)) {
			return true;
		}
	}

	// Check regionCode (e.g. 'bg', 'de', 'fr', 'en-GB', 'en-IE', 'DE', 'GB')
	if (regionCode) {
		const trimmedRegion = regionCode.trim();
		const upperRegion = trimmedRegion.toUpperCase();

		// If regionCode is a 2-letter country code (e.g., 'GB', 'DE', 'BG')
		if (EEA_UK_COUNTRY_CODES.has(upperRegion)) {
			return true;
		}

		// If regionCode contains a locale with country part like 'en-GB', 'de-DE', 'fr-FR'
		if (trimmedRegion.includes('-') || trimmedRegion.includes('_')) {
			const parts = trimmedRegion.split(/[-_]/);
			const codePart = parts[parts.length - 1].toUpperCase();
			if (EEA_UK_COUNTRY_CODES.has(codePart)) {
				return true;
			}
		}

		// Known 2-letter locale prefix mapping to EEA/UK languages if specific
		const eeaLanguageLocales = new Set(['bg', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'ro', 'hu', 'cs', 'sk', 'sl', 'hr', 'da', 'fi', 'sv', 'et', 'lv', 'lt', 'ga', 'mt', 'el']);
		if (eeaLanguageLocales.has(trimmedRegion.toLowerCase())) {
			return true;
		}
	}

	// Check timeZone starting with Europe/ (excluding non-EEA Eastern European zones if needed, but Europe timezones generally default to EEA/UK protection)
	if (timeZone && typeof timeZone === 'string') {
		const normTz = timeZone.trim().toLowerCase();
		// Non-EEA Europe timezones: Moscow, Samara, Kaliningrad, Volgograd, Minsk, Istanbul (Turkey)
		const nonEeaEuropeTzs = ['europe/moscow', 'europe/samara', 'europe/kaliningrad', 'europe/volgograd', 'europe/minsk', 'europe/istanbul'];
		if (normTz.startsWith('europe/') && !nonEeaEuropeTzs.some((nonEea) => normTz.includes(nonEea))) {
			return true;
		}
	}

	return false;
}
