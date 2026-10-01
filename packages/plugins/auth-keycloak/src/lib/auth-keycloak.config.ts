import { Logger } from '@nestjs/common';

/** The switch that loads the plugin. Off unless set to exactly `true`. */
export const KEYCLOAK_ENABLED_ENV = 'KEYCLOAK_ENABLED';

/** Sample files ship this value for client id and secret; it never counts as configured. */
const PLACEHOLDER = 'XXXXXXX';

type Env = Record<string, string | undefined>;

const logger = new Logger('AuthKeycloakPlugin');
let warnedAboutSwitch = false;

/**
 * Reads a boolean switch strictly: only the exact strings `true` and `false` count. Anything else
 * (`TRUE`, `1`, `yes`) is treated as the default and logged once.
 *
 * @param value - Raw environment value.
 * @param name - Variable name, for the log line.
 * @param fallback - The default.
 * @returns The switch value.
 */
export function readStrictBoolean(value: string | undefined, name: string, fallback: boolean): boolean {
	if (value === undefined || value === '') {
		return fallback;
	}
	if (value === 'true') {
		return true;
	}
	if (value === 'false') {
		return false;
	}
	if (!warnedAboutSwitch) {
		warnedAboutSwitch = true;
		logger.warn(`${name} must be "true" or "false"; using ${fallback}.`);
	}
	return fallback;
}

/**
 * Whether a Keycloak client id and secret are present (and not the sample placeholder).
 *
 * @param env - Environment variables.
 * @returns `true` when both are set.
 */
export function isKeycloakConfigured(env: Env = process.env): boolean {
	const clientId = env['KEYCLOAK_CLIENT_ID']?.trim();
	const clientSecret = env['KEYCLOAK_CLIENT_SECRET']?.trim();
	return !!clientId && !!clientSecret && clientId !== PLACEHOLDER && clientSecret !== PLACEHOLDER;
}

/**
 * Whether the Keycloak plugin is loaded: `KEYCLOAK_ENABLED=true` and a client id and secret.
 *
 * Read once, when the API assembles its plugin list. With the switch unset the plugin is not loaded
 * at all: no route, no button, no outbound request, whatever the other `KEYCLOAK_*` values say.
 *
 * @param env - Environment variables.
 * @returns `true` when the plugin should be loaded.
 */
export function isKeycloakEnabled(env: Env = process.env): boolean {
	return readStrictBoolean(env[KEYCLOAK_ENABLED_ENV], KEYCLOAK_ENABLED_ENV, false) && isKeycloakConfigured(env);
}
