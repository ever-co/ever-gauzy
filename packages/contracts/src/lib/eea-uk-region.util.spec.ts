import {
	isEEAOrUKRegion,
	checkAgentExitLogoutRestrictionChange,
	getNewAgentExitLogoutRestrictions,
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
		expect(isEEAOrUKRegion({ timeZone: 'Indian/Reunion' })).toBe(true);
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

const DE = { countryCode: 'DE' };
const US = { countryCode: 'US' };
const ALLOWED = { allowAgentAppExit: true, allowLogoutFromAgentApp: true };
const RESTRICTED = { allowAgentAppExit: false, allowLogoutFromAgentApp: false };

describe('getNewAgentExitLogoutRestrictions', () => {
	it('lists only the settings that go from allowed to denied', () => {
		expect(getNewAgentExitLogoutRestrictions({ allowAgentAppExit: false }, ALLOWED)).toEqual(['allowAgentAppExit']);
		expect(getNewAgentExitLogoutRestrictions({ allowAgentAppExit: false, allowLogoutFromAgentApp: true }, undefined)).toEqual([
			'allowAgentAppExit'
		]);
	});

	it('does not treat an existing restriction that is echoed back as new', () => {
		expect(getNewAgentExitLogoutRestrictions(RESTRICTED, RESTRICTED)).toEqual([]);
		expect(getNewAgentExitLogoutRestrictions({}, RESTRICTED)).toEqual([]);
	});
});

describe('checkAgentExitLogoutRestrictionChange', () => {
	it('allows changes that do not restrict anything, anywhere', () => {
		expect(checkAgentExitLogoutRestrictionChange(ALLOWED, RESTRICTED, DE)).toEqual({ error: null, newRestrictions: [] });
		expect(checkAgentExitLogoutRestrictionChange({}, ALLOWED, US)).toEqual({ error: null, newRestrictions: [] });
	});

	it('rejects newly restricting exit or logout in EEA/UK, even with an acknowledgement', () => {
		expect(checkAgentExitLogoutRestrictionChange({ allowAgentAppExit: false }, ALLOWED, DE).error).toBe(
			EEA_UK_AGENT_RESTRICTION_ERR_MSG
		);
		expect(
			checkAgentExitLogoutRestrictionChange(
				{ allowLogoutFromAgentApp: false, acknowledgeAgentExitLogoutRestriction: true },
				ALLOWED,
				DE
			).error
		).toBe(EEA_UK_AGENT_RESTRICTION_ERR_MSG);
	});

	it('requires an acknowledgement to newly restrict outside EEA/UK, and reports what it covers', () => {
		expect(checkAgentExitLogoutRestrictionChange({ allowAgentAppExit: false }, ALLOWED, US).error).toBe(
			ACKNOWLEDGEMENT_REQUIRED_ERR_MSG
		);
		expect(
			checkAgentExitLogoutRestrictionChange(
				{ allowAgentAppExit: false, acknowledgeAgentExitLogoutRestriction: true },
				ALLOWED,
				US
			)
		).toEqual({ error: null, newRestrictions: ['allowAgentAppExit'] });
	});

	it('does not block or rewrite unrelated updates to an entity that is already restricted', () => {
		// Outside EEA/UK: no fresh acknowledgement needed to save something else.
		expect(checkAgentExitLogoutRestrictionChange({}, RESTRICTED, US)).toEqual({ error: null, newRestrictions: [] });
		expect(checkAgentExitLogoutRestrictionChange({ ...RESTRICTED }, RESTRICTED, US)).toEqual({
			error: null,
			newRestrictions: []
		});
		// In EEA/UK: an existing restriction is reported for review, not silently migrated.
		const input: Record<string, unknown> = {};
		expect(checkAgentExitLogoutRestrictionChange(input, RESTRICTED, DE)).toEqual({ error: null, newRestrictions: [] });
		expect(input).toEqual({});
	});

	it('rejects moving a restricted entity into EEA/UK unless the restriction is lifted in the same change', () => {
		expect(checkAgentExitLogoutRestrictionChange({}, RESTRICTED, DE, US).error).toBe(EEA_UK_AGENT_RESTRICTION_ERR_MSG);
		expect(checkAgentExitLogoutRestrictionChange({ ...ALLOWED }, RESTRICTED, DE, US).error).toBeNull();
	});
});
