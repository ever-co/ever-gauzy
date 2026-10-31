/**
 * Operator switches for self-service account creation and for account recovery by e-mail
 * (ever-co/ever-gauzy#5784, ever-co/ever-gauzy#7821).
 *
 * They exist for a self-hosted server that serves one company: its operator wants nobody else to sign up and
 * start a workspace there, and may want an administrator's password never to be resettable from a mailbox.
 *
 * Every switch is ON by default, which is the behaviour every installation has always had, so a deployment that
 * sets nothing sees no change. They are environment variables only, read once at boot, and no feature flag can
 * turn one back on: the point is that registration stays closed even if the flag system misbehaves.
 *
 * Whatever their values, these keep working: accepting an invitation, an administrator adding a user to their own
 * tenant, signing in, and creating the very first tenant of an installation that has none (see the API's
 * `RegistrationPolicyService`).
 */
export interface IAuthSwitches {
	/**
	 * `APP_USER_REGISTRATION`: whether anyone may create an account through the public sign-up
	 * (`POST /api/auth/register` without an administrator's token, and the sign-ups of identity-provider plugins).
	 */
	userRegistration: boolean;

	/**
	 * `ALLOW_TENANTS_REGISTRATION`: whether new tenants (workspaces) may be created once the installation has one.
	 * A public sign-up only ever leads to creating a tenant, so it is closed by this switch too.
	 */
	tenantsRegistration: boolean;

	/**
	 * `ADMIN_PASSWORD_RESET`: whether Admin and Super Admin accounts may reset their password through the e-mailed
	 * link. Off, the request is answered exactly as for any other address, but no link is sent for those accounts
	 * and a link sent earlier no longer works for them.
	 */
	adminPasswordReset: boolean;
}

/** The environment variable behind each switch. */
export const AUTH_SWITCH_ENV: Readonly<Record<keyof IAuthSwitches, string>> = Object.freeze({
	userRegistration: 'APP_USER_REGISTRATION',
	tenantsRegistration: 'ALLOW_TENANTS_REGISTRATION',
	adminPasswordReset: 'ADMIN_PASSWORD_RESET'
});

/** Values that turn a switch off (compared trimmed and lower-cased). */
const OFF_VALUES: ReadonlySet<string> = new Set(['false', '0', 'no', 'off']);

/** Values that leave a switch on (compared trimmed and lower-cased). An unset or blank value does too. */
const ON_VALUES: ReadonlySet<string> = new Set(['true', '1', 'yes', 'on']);

/**
 * Reads a switch that is on unless explicitly turned off.
 *
 * `false`, `0`, `no` and `off` (any case, surrounding blanks ignored) turn it off; unset, blank, `true`, `1`, `yes`
 * and `on` leave it on. Anything else also leaves it on, which is today's behaviour, and is reported through
 * `onUnrecognised` so a misspelled attempt to close registration does not pass unnoticed.
 *
 * @param raw - The raw environment value.
 * @param onUnrecognised - Called with the trimmed value when it is neither an on nor an off value.
 * @returns False only for an explicit off value.
 */
export function parseOnByDefaultSwitch(raw: string | undefined, onUnrecognised?: (value: string) => void): boolean {
	const value = (raw ?? '').trim().toLowerCase();
	if (OFF_VALUES.has(value)) {
		return false;
	}
	if (value && !ON_VALUES.has(value)) {
		onUnrecognised?.(value);
	}
	return true;
}

/**
 * Reads every auth switch from the environment.
 *
 * @param env - The environment to read (defaults to `process.env`).
 * @param warn - Receives one line per value that is neither an on nor an off value.
 * @returns The switches, each on unless explicitly turned off.
 */
export function resolveAuthSwitches(
	env: Readonly<Record<string, string | undefined>> = process.env,
	warn: (message: string) => void = () => undefined
): IAuthSwitches {
	const read = (key: keyof IAuthSwitches): boolean => {
		const name = AUTH_SWITCH_ENV[key];
		return parseOnByDefaultSwitch(env[name], (value) =>
			warn(`${name}="${value}" is not a recognised value (true/false); leaving it on.`)
		);
	};

	return {
		userRegistration: read('userRegistration'),
		tenantsRegistration: read('tenantsRegistration'),
		adminPasswordReset: read('adminPasswordReset')
	};
}

/**
 * Whether the switches let a stranger create an account through a public sign-up.
 *
 * Both have to be on: such an account belongs to no tenant, and the only thing it can do next is create one.
 *
 * @param switches - The resolved switches.
 * @returns True when neither `APP_USER_REGISTRATION` nor `ALLOW_TENANTS_REGISTRATION` is off.
 */
export function isSelfServiceSignupAllowed(switches: Pick<IAuthSwitches, 'userRegistration' | 'tenantsRegistration'>): boolean {
	return switches.userRegistration && switches.tenantsRegistration;
}
