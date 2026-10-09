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

/** The auth server URL Gauzy's configuration falls back to when `KEYCLOAK_AUTH_SERVER_URL` is unset. */
const SAMPLE_AUTH_SERVER_URL = 'https://keycloak.example.com/auth';

/** True for a missing value or the sample placeholder of the client id and secret. */
export function isMissingOrPlaceholder(value: string | undefined): boolean {
	const trimmed = value?.trim();
	return !trimmed || trimmed === PLACEHOLDER;
}

/** True for a missing auth server URL or the sample one (with or without trailing slashes). */
export function isMissingOrSampleAuthServerUrl(value: string | undefined): boolean {
	let url = value?.trim() ?? '';
	while (url.endsWith('/')) {
		url = url.slice(0, -1);
	}
	return !url || url === SAMPLE_AUTH_SERVER_URL;
}

/**
 * Whether Keycloak sign-in is fully configured: a client id and secret (not the sample placeholder),
 * a realm and a real auth server URL.
 *
 * @param env - Environment variables.
 * @returns `true` when all four are set.
 */
export function isKeycloakConfigured(env: Env = process.env): boolean {
	return (
		!isMissingOrPlaceholder(env['KEYCLOAK_CLIENT_ID']) &&
		!isMissingOrPlaceholder(env['KEYCLOAK_CLIENT_SECRET']) &&
		!!env['KEYCLOAK_REALM']?.trim() &&
		!isMissingOrSampleAuthServerUrl(env['KEYCLOAK_AUTH_SERVER_URL'])
	);
}

/**
 * Whether the Keycloak plugin is loaded: `KEYCLOAK_ENABLED=true` and Keycloak fully configured.
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
