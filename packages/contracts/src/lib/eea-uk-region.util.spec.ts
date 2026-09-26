import {
	isEEAOrUKRegion,
	validateAgentExitLogoutRestriction,
	EEA_UK_AGENT_RESTRICTION_ERR_MSG,
	ACKNOWLEDGEMENT_REQUIRED_ERR_MSG
} from './eea-uk-region.util';

describe('isEEAOrUKRegion', () => {
	it('should return true for EEA country codes', () => {
		expect(isEEAOrUKRegion({ countryCode: 'DE' })).toBe(true);
		expect(isEEAOrUKRegion({ countryCode: 'FR' })).toBe(true);
		expect(isEEAOrUKRegion({ countryCode: 'BG' })).toBe(true);
		expect(isEEAOrUKRegion({ countryCode: 'NL' })).toBe(true);
		expect(isEEAOrUKRegion({ countryCode: 'ES' })).toBe(true);
		expect(isEEAOrUKRegion({ countryCode: 'NO' })).toBe(true);
	});

	it('should return true for UK country codes', () => {
		expect(isEEAOrUKRegion({ countryCode: 'GB' })).toBe(true);
		expect(isEEAOrUKRegion({ countryCode: 'UK' })).toBe(true);
	});

	it('should return false for non-EEA/UK country codes', () => {
		expect(isEEAOrUKRegion({ countryCode: 'US' })).toBe(false);
		expect(isEEAOrUKRegion({ countryCode: 'CA' })).toBe(false);
		expect(isEEAOrUKRegion({ countryCode: 'IN' })).toBe(false);
		expect(isEEAOrUKRegion({ countryCode: 'AU' })).toBe(false);
	});

	it('should identify EEA/UK by country name', () => {
		expect(isEEAOrUKRegion({ country: 'Germany' })).toBe(true);
		expect(isEEAOrUKRegion({ country: 'United Kingdom' })).toBe(true);
		expect(isEEAOrUKRegion({ country: 'Bulgaria' })).toBe(true);
		expect(isEEAOrUKRegion({ country: 'United States' })).toBe(false);
	});

	it('should identify EEA/UK by regionCode', () => {
		expect(isEEAOrUKRegion({ regionCode: 'bg' })).toBe(true);
		expect(isEEAOrUKRegion({ regionCode: 'en-GB' })).toBe(true);
		expect(isEEAOrUKRegion({ regionCode: 'de-DE' })).toBe(true);
		expect(isEEAOrUKRegion({ regionCode: 'en-US' })).toBe(false);
	});

	it('should identify EEA/UK by timeZone', () => {
		expect(isEEAOrUKRegion({ timeZone: 'Europe/London' })).toBe(true);
		expect(isEEAOrUKRegion({ timeZone: 'Europe/Berlin' })).toBe(true);
		expect(isEEAOrUKRegion({ timeZone: 'Europe/Sofia' })).toBe(true);
		expect(isEEAOrUKRegion({ timeZone: 'Atlantic/Canary' })).toBe(true);
		expect(isEEAOrUKRegion({ timeZone: 'Atlantic/Madeira' })).toBe(true);
		expect(isEEAOrUKRegion({ timeZone: 'Atlantic/Azores' })).toBe(true);
		expect(isEEAOrUKRegion({ timeZone: 'Europe/Zurich' })).toBe(false);
		expect(isEEAOrUKRegion({ timeZone: 'Europe/Kyiv' })).toBe(false);
		expect(isEEAOrUKRegion({ timeZone: 'Europe/Belgrade' })).toBe(false);
		expect(isEEAOrUKRegion({ timeZone: 'America/New_York' })).toBe(false);
		expect(isEEAOrUKRegion({ timeZone: 'Asia/Kolkata' })).toBe(false);
	});

	it('should handle empty/undefined inputs gracefully', () => {
		expect(isEEAOrUKRegion()).toBe(false);
		expect(isEEAOrUKRegion({})).toBe(false);
	});
});

describe('validateAgentExitLogoutRestriction', () => {
	it('should return null when exit and logout are allowed', () => {
		const result = validateAgentExitLogoutRestriction(
			{ allowAgentAppExit: true, allowLogoutFromAgentApp: true },
			{ countryCode: 'DE' }
		);
		expect(result).toBeNull();
	});

	it('should return EEA/UK error message when restricting in EEA/UK region', () => {
		const result = validateAgentExitLogoutRestriction(
			{ allowAgentAppExit: false },
			{ countryCode: 'DE' }
		);
		expect(result).toBe(EEA_UK_AGENT_RESTRICTION_ERR_MSG);
	});

	it('should return acknowledgement error message when non-EEA/UK without acknowledgement', () => {
		const result = validateAgentExitLogoutRestriction(
			{ allowAgentAppExit: false },
			{ countryCode: 'US' }
		);
		expect(result).toBe(ACKNOWLEDGEMENT_REQUIRED_ERR_MSG);
	});

	it('should return null when non-EEA/UK with acknowledgement', () => {
		const result = validateAgentExitLogoutRestriction(
			{ allowAgentAppExit: false, acknowledgeAgentExitLogoutRestriction: true },
			{ countryCode: 'US' }
		);
		expect(result).toBeNull();
	});
});
