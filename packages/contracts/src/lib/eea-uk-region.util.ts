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
	// Åland Islands (Finland)
	'europe/mariehamn'
	// Deliberately NOT included: Andorra, Monaco, San Marino, Vatican, Gibraltar, Guernsey,
	// Isle of Man and Jersey are neither in the EEA nor part of the UK.
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

export const AGENT_RESTRICTION_ON_CREATE_ERR_MSG =
	'allowAgentAppExit and allowLogoutFromAgentApp cannot be turned off when creating a record; create it first, then restrict it with an explicit acknowledgement.';

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

/**
 * `regionCode` is a display locale (`RegionsEnum`), not a location. Only two forms say where
 * someone is: a region-qualified locale (`en-GB`, `de_DE`), and the `RegionsEnum` keys, whose
 * labels name a country (`BG` = "Bulgarian (Bulgaria)"). A bare language such as `fr` or `de`
 * does not, even though it happens to look like a country code.
 */
const REGIONS_ENUM_COUNTRY: Readonly<Record<string, string>> = { EN: 'US', BG: 'BG', HE: 'IL', RU: 'RU' };

function checkRegionCode(regionCode?: string): boolean {
	if (!regionCode) return false;
	const trimmedRegion = regionCode.trim();

	if (trimmedRegion.includes('-') || trimmedRegion.includes('_')) {
		const codePart = (trimmedRegion.split(/[-_]/).at(-1) ?? '').toUpperCase();
		return EEA_UK_COUNTRY_CODES.has(codePart);
	}

	return EEA_UK_COUNTRY_CODES.has(REGIONS_ENUM_COUNTRY[trimmedRegion.toUpperCase()] ?? '');
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
 * Whether any of the given locations is in the EEA/UK. An employee has two — their own (contact,
 * user time zone) and their organization's — and one location must not be able to mask the other.
 */
export function isEEAOrUKLocation(location?: IAgentRestrictionLocation | IAgentRestrictionLocation[]): boolean {
	const locations = Array.isArray(location) ? location : [location];
	return locations.some((loc) => isEEAOrUKRegion(loc));
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
 * @param location the entity's location(s) after this update
 * @param previousLocation the entity's location(s) before this update
 */
export function checkAgentExitLogoutRestrictionChange(
	input: IAgentExitLogoutRestrictionInput,
	persisted: IAgentExitLogoutSettings | null | undefined,
	location: IAgentRestrictionLocation | IAgentRestrictionLocation[],
	previousLocation?: IAgentRestrictionLocation | IAgentRestrictionLocation[]
): IAgentExitLogoutRestrictionCheck {
	const newRestrictions = getNewAgentExitLogoutRestrictions(input, persisted);
	const isEEAOrUK = isEEAOrUKLocation(location);

	if (isEEAOrUK) {
		if (newRestrictions.length > 0) {
			return { error: EEA_UK_AGENT_RESTRICTION_ERR_MSG, newRestrictions: [] };
		}
		const movingIntoEEAOrUK = !!previousLocation && !isEEAOrUKLocation(previousLocation);
		const stillRestricted = AGENT_EXIT_LOGOUT_FIELDS.some((field) => (input[field] ?? persisted?.[field]) === false);
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
