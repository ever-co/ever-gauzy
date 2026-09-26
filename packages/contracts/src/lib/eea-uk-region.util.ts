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

const EEA_LANGUAGE_LOCALES: ReadonlySet<string> = new Set([
	'bg', 'de', 'fr', 'es', 'it', 'nl', 'pl', 'ro', 'hu', 'cs', 'sk', 'sl',
	'hr', 'da', 'fi', 'sv', 'et', 'lv', 'lt', 'ga', 'mt', 'el'
]);

export const EEA_UK_TIMEZONES: ReadonlySet<string> = new Set([
	// Austria
	'europe/vienna',
	// Belgium
	'europe/brussels',
	// Bulgaria
	'europe/sofia',
	// Croatia
	'europe/zagreb',
	// Cyprus
	'asia/nicosia', 'europe/nicosia', 'asia/famagusta',
	// Czech Republic
	'europe/prague',
	// Denmark
	'europe/copenhagen',
	// Estonia
	'europe/tallinn',
	// Finland
	'europe/helsinki',
	// France
	'europe/paris',
	// Germany
	'europe/berlin', 'europe/busingen',
	// Greece
	'europe/athens',
	// Hungary
	'europe/budapest',
	// Ireland
	'europe/dublin',
	// Italy
	'europe/rome',
	// Latvia
	'europe/riga',
	// Lithuania
	'europe/vilnius',
	// Luxembourg
	'europe/luxembourg',
	// Malta
	'europe/malta',
	// Netherlands
	'europe/amsterdam',
	// Poland
	'europe/warsaw',
	// Portugal
	'europe/lisbon', 'atlantic/madeira', 'atlantic/azores',
	// Romania
	'europe/bucharest',
	// Slovakia
	'europe/bratislava',
	// Slovenia
	'europe/ljubljana',
	// Spain
	'europe/madrid', 'africa/ceuta', 'atlantic/canary',
	// Sweden
	'europe/stockholm',
	// Iceland
	'atlantic/reykjavik',
	// Liechtenstein
	'europe/vaduz',
	// Norway
	'europe/oslo',
	// UK
	'europe/london', 'europe/belfast', 'gb', 'gb-eire',
	// EU dependencies / Microstates with EEA ties
	'europe/andorra', 'europe/monaco', 'europe/san_marino', 'europe/vatican',
	'europe/gibraltar', 'europe/guernsey', 'europe/isle_of_man', 'europe/jersey', 'europe/mariehamn'
]);

export const EEA_UK_AGENT_RESTRICTION_ERR_MSG =
	'In accordance with EEA/UK privacy regulations (GDPR / ECHR Art 8), desktop agent exit and logout restrictions cannot be enabled for workers in EEA/UK tenants.';

export const ACKNOWLEDGEMENT_REQUIRED_ERR_MSG =
	'An explicit recorded acknowledgement of legal and proportionality risks is required before restricting agent app exit or logout.';

function checkCountryCode(countryCode?: string): boolean {
	if (!countryCode) return false;
	return EEA_UK_COUNTRY_CODES.has(countryCode.trim().toUpperCase());
}

function checkCountryName(country?: string): boolean {
	if (!country) return false;
	const normCountry = country.trim().toLowerCase();
	return EEA_UK_COUNTRY_CODES.has(normCountry.toUpperCase()) || EEA_UK_COUNTRY_NAMES.has(normCountry);
}

function checkRegionCode(regionCode?: string): boolean {
	if (!regionCode) return false;
	const trimmedRegion = regionCode.trim();
	const upperRegion = trimmedRegion.toUpperCase();

	if (EEA_UK_COUNTRY_CODES.has(upperRegion)) {
		return true;
	}

	if (trimmedRegion.includes('-') || trimmedRegion.includes('_')) {
		const parts = trimmedRegion.split(/[-_]/);
		const codePart = parts.at(-1)?.toUpperCase() ?? '';
		if (EEA_UK_COUNTRY_CODES.has(codePart)) {
			return true;
		}
	}

	return EEA_LANGUAGE_LOCALES.has(trimmedRegion.toLowerCase());
}

function checkTimeZone(timeZone?: string): boolean {
	if (!timeZone || typeof timeZone !== 'string') return false;
	const normTz = timeZone.trim().toLowerCase();
	return EEA_UK_TIMEZONES.has(normTz);
}

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

	return (
		checkCountryCode(params.countryCode) ||
		checkCountryName(params.country) ||
		checkRegionCode(params.regionCode) ||
		checkTimeZone(params.timeZone)
	);
}

/**
 * Validates agent exit and logout restriction rules for EEA/UK region compliance and required acknowledgements.
 * Returns an error message if validation fails, or null if valid.
 */
export function validateAgentExitLogoutRestriction(
	input: {
		allowAgentAppExit?: boolean;
		allowLogoutFromAgentApp?: boolean;
		acknowledgeAgentExitLogoutRestriction?: boolean;
	},
	location: {
		regionCode?: string;
		countryCode?: string;
		country?: string;
		timeZone?: string;
	}
): string | null {
	const isRestrictingExit = input.allowAgentAppExit === false;
	const isRestrictingLogout = input.allowLogoutFromAgentApp === false;

	if (!isRestrictingExit && !isRestrictingLogout) {
		return null;
	}

	if (isEEAOrUKRegion(location)) {
		return EEA_UK_AGENT_RESTRICTION_ERR_MSG;
	}

	if (!input.acknowledgeAgentExitLogoutRestriction) {
		return ACKNOWLEDGEMENT_REQUIRED_ERR_MSG;
	}

	return null;
}
