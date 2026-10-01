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
	// France (incl. EU outermost regions)
	'europe/paris', 'indian/reunion', 'indian/mayotte', 'america/martinique', 'america/guadeloupe', 'america/cayenne', 'america/marigot',
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

/**
 * Where a worker (or the organization employing them) is, as far as Gauzy knows it.
 */
export interface IAgentRestrictionLocation {
	regionCode?: string;
	countryCode?: string;
	country?: string;
	timeZone?: string;
}

/**
 * The two settings that, set to `false`, stop a monitored worker quitting or logging out of the desktop agent.
 */
export const AGENT_EXIT_LOGOUT_FIELDS = ['allowAgentAppExit', 'allowLogoutFromAgentApp'] as const;
export type AgentExitLogoutField = (typeof AGENT_EXIT_LOGOUT_FIELDS)[number];

export type IAgentExitLogoutSettings = Partial<Record<AgentExitLogoutField, boolean>>;

export interface IAgentExitLogoutRestrictionInput extends IAgentExitLogoutSettings {
	/** The admin explicitly accepted the legal risk of restricting exit/logout for this change. */
	acknowledgeAgentExitLogoutRestriction?: boolean;
}

export const EEA_UK_AGENT_RESTRICTION_ERR_MSG =
	'Workers in the EEA or UK must always be able to exit and log out of the desktop agent, so allowAgentAppExit and allowLogoutFromAgentApp cannot be turned off here.';

export const ACKNOWLEDGEMENT_REQUIRED_ERR_MSG =
	'Turning off allowAgentAppExit or allowLogoutFromAgentApp requires an explicit acknowledgement of the legal risk (acknowledgeAgentExitLogoutRestriction: true), which is recorded against your account.';

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
		const codePart = (parts[parts.length - 1] || '').toUpperCase();
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
export function isEEAOrUKRegion(params?: IAgentRestrictionLocation): boolean {
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
 * The exit/logout settings this change turns from allowed into denied.
 *
 * A setting that is already denied and stays denied is NOT a new restriction: re-saving an entity
 * (or any unrelated update that echoes its current values back) must not require a fresh
 * acknowledgement, and must not silently lift a restriction an admin has to review deliberately.
 */
export function getNewAgentExitLogoutRestrictions(
	input: IAgentExitLogoutSettings,
	persisted?: IAgentExitLogoutSettings | null
): AgentExitLogoutField[] {
	return AGENT_EXIT_LOGOUT_FIELDS.filter((field) => input[field] === false && persisted?.[field] !== false);
}

export interface IAgentExitLogoutRestrictionCheck {
	/** Why the change must be rejected, or `null` when it may proceed. */
	error: string | null;
	/** The settings this change newly restricts (non-empty only when an acknowledgement was given). */
	newRestrictions: AgentExitLogoutField[];
}

/**
 * Server-side rule for issue #9873, applied to every organization / employee update.
 *
 * - In EEA/UK, a change may not newly deny exit or logout, and may not move an entity INTO EEA/UK
 *   while a restriction remains in force (lift it in the same request instead).
 * - Elsewhere, newly denying exit or logout requires `acknowledgeAgentExitLogoutRestriction: true`,
 *   which the caller records against the acting admin.
 * - Restrictions that already exist are left untouched; they are reported for deliberate review
 *   (see the `ReportRestrictedAgentSettings` migration) rather than changed by an unrelated save.
 *
 * @param input the incoming update
 * @param persisted the entity as currently stored
 * @param location the entity's location after this update
 * @param previousLocation the entity's location before this update
 */
export function checkAgentExitLogoutRestrictionChange(
	input: IAgentExitLogoutRestrictionInput,
	persisted: IAgentExitLogoutSettings | null | undefined,
	location: IAgentRestrictionLocation,
	previousLocation?: IAgentRestrictionLocation
): IAgentExitLogoutRestrictionCheck {
	const newRestrictions = getNewAgentExitLogoutRestrictions(input, persisted);
	const isEEAOrUK = isEEAOrUKRegion(location);

	if (isEEAOrUK) {
		if (newRestrictions.length > 0) {
			return { error: EEA_UK_AGENT_RESTRICTION_ERR_MSG, newRestrictions: [] };
		}
		const movingIntoEEAOrUK = !!previousLocation && !isEEAOrUKRegion(previousLocation);
		const stillRestricted = AGENT_EXIT_LOGOUT_FIELDS.some(
			(field) => (input[field] !== undefined ? input[field] : persisted?.[field]) === false
		);
		if (movingIntoEEAOrUK && stillRestricted) {
			return { error: EEA_UK_AGENT_RESTRICTION_ERR_MSG, newRestrictions: [] };
		}
		return { error: null, newRestrictions: [] };
	}

	if (newRestrictions.length > 0 && input.acknowledgeAgentExitLogoutRestriction !== true) {
		return { error: ACKNOWLEDGEMENT_REQUIRED_ERR_MSG, newRestrictions: [] };
	}

	return { error: null, newRestrictions };
}
