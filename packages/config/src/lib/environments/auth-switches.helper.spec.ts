import {
	AUTH_SWITCH_ENV,
	isSelfServiceSignupAllowed,
	parseOnByDefaultSwitch,
	resolveAuthSwitches
} from './auth-switches.helper';

/**
 * The self-registration and admin password-reset switches (#5784, #7821): on unless explicitly turned off, so an
 * installation that sets nothing keeps today's behaviour.
 */
describe('parseOnByDefaultSwitch', () => {
	it.each([undefined, '', '   ', 'true', 'TRUE', ' 1 ', 'yes', 'On'])('%p leaves the switch on', (value) => {
		expect(parseOnByDefaultSwitch(value)).toBe(true);
	});

	it.each(['false', 'FALSE', ' False ', '0', 'no', 'OFF'])('%p turns the switch off', (value) => {
		expect(parseOnByDefaultSwitch(value)).toBe(false);
	});

	it('leaves an unrecognised value on and reports it', () => {
		const onUnrecognised = jest.fn();

		expect(parseOnByDefaultSwitch(' Flase ', onUnrecognised)).toBe(true);
		expect(onUnrecognised).toHaveBeenCalledWith('flase');
	});

	it('reports nothing for a recognised or empty value', () => {
		const onUnrecognised = jest.fn();

		for (const value of [undefined, '', 'true', 'false', '0', 'yes']) {
			parseOnByDefaultSwitch(value, onUnrecognised);
		}

		expect(onUnrecognised).not.toHaveBeenCalled();
	});
});

describe('resolveAuthSwitches', () => {
	it('turns every switch on when nothing is set (today’s behaviour)', () => {
		expect(resolveAuthSwitches({})).toEqual({
			userRegistration: true,
			tenantsRegistration: true,
			adminPasswordReset: true
		});
	});

	it('reads each switch from its own variable', () => {
		expect(resolveAuthSwitches({ APP_USER_REGISTRATION: 'false' })).toEqual({
			userRegistration: false,
			tenantsRegistration: true,
			adminPasswordReset: true
		});
		expect(resolveAuthSwitches({ ALLOW_TENANTS_REGISTRATION: 'false' })).toEqual({
			userRegistration: true,
			tenantsRegistration: false,
			adminPasswordReset: true
		});
		expect(resolveAuthSwitches({ ADMIN_PASSWORD_RESET: 'false' })).toEqual({
			userRegistration: true,
			tenantsRegistration: true,
			adminPasswordReset: false
		});
	});

	it('names the variable and the value when a value is not recognised', () => {
		const warn = jest.fn();

		const switches = resolveAuthSwitches({ [AUTH_SWITCH_ENV.tenantsRegistration]: 'nope' }, warn);

		expect(switches.tenantsRegistration).toBe(true);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][0]).toContain('ALLOW_TENANTS_REGISTRATION="nope"');
	});

	it('reads process.env by default', () => {
		const previous = process.env.ADMIN_PASSWORD_RESET;
		process.env.ADMIN_PASSWORD_RESET = 'false';
		try {
			expect(resolveAuthSwitches().adminPasswordReset).toBe(false);
		} finally {
			if (previous === undefined) delete process.env.ADMIN_PASSWORD_RESET;
			else process.env.ADMIN_PASSWORD_RESET = previous;
		}
	});
});

describe('isSelfServiceSignupAllowed', () => {
	it('is allowed only while both registration switches are on', () => {
		expect(isSelfServiceSignupAllowed({ userRegistration: true, tenantsRegistration: true })).toBe(true);
		expect(isSelfServiceSignupAllowed({ userRegistration: false, tenantsRegistration: true })).toBe(false);
		expect(isSelfServiceSignupAllowed({ userRegistration: true, tenantsRegistration: false })).toBe(false);
		expect(isSelfServiceSignupAllowed({ userRegistration: false, tenantsRegistration: false })).toBe(false);
	});
});
