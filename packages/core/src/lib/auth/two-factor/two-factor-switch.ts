/**
 * The operator's switch for turning two-factor authentication on (ever-co/ever-gauzy#11916).
 *
 * Once a user turns it on, every sign-in of theirs asks for a code, and the clients that cannot ask for one yet (the
 * Gauzy web app, the desktop apps and the agent, the mobile app, the MCP servers) cannot sign them in. So new
 * enrolments wait for the operator: while the switch is off, the status answers `available: false` and enrolling or
 * confirming is refused. Users who already turned it on keep being asked for their code, and can still turn it off.
 */

/** The environment variable of the switch. */
export const TWO_FACTOR_ENV = 'TWO_FACTOR_ENABLED';

/** What enrolling or confirming answers while the switch is off. */
export const TWO_FACTOR_SWITCHED_OFF_MESSAGE =
	'Two-factor authentication cannot be turned on on this server yet: its operator has not set TWO_FACTOR_ENABLED.';

/**
 * Whether new enrolments are open.
 *
 * @param value The switch's raw value (the environment variable by default).
 * @returns True only for `true`, `1`, `yes` or `on`.
 */
export function isTwoFactorEnrolmentOpen(value: string | undefined = process.env[TWO_FACTOR_ENV]): boolean {
	const normalized = String(value ?? '')
		.trim()
		.toLowerCase();
	return ['true', '1', 'yes', 'on'].includes(normalized);
}
