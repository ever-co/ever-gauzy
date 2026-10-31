import { Logger } from '@nestjs/common';

/**
 * Settings of the OpenID Connect sign-in plugin, read from the environment.
 *
 * Kept free of other imports: `apps/api/src/plugins.ts` calls {@link isOidcEnabled} while it builds the
 * plugin list, before anything of the plugin is loaded.
 */

/** The switch that loads the plugin. Off unless set to exactly `true`. */
export const OIDC_ENABLED_ENV = 'OIDC_ENABLED';

/** Scopes requested when `OIDC_SCOPES` is unset: the e-mail address and its verification state come from the ID token. */
export const OIDC_DEFAULT_SCOPES: readonly string[] = ['openid', 'email', 'profile'];

/** Label of the login button when `OIDC_DISPLAY_NAME` is unset. */
export const OIDC_DEFAULT_DISPLAY_NAME = 'SSO';

/** Longest accepted `OIDC_DISPLAY_NAME`: it is a button label. */
export const OIDC_DISPLAY_NAME_MAX_LENGTH = 40;

/** Sample files ship this value for client ids and secrets; it never counts as configured. */
const PLACEHOLDER = 'XXXXXXX';

/** Hosts on which an `http` URL is accepted: the local machine only (development and tests). */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

type Env = Record<string, string | undefined>;

/** Why a setting the sign-in needs cannot be used. */
export type OidcSettingProblem = 'missing' | 'placeholder' | 'invalid_url' | 'insecure_url';

/** The plugin settings. */
export interface AuthOidcSettings {
	/** Issuer identifier exactly as the provider publishes it (`''` when unusable). */
	issuer: string;
	/** OAuth client id (`''` when unusable). */
	clientId: string;
	/** OAuth client secret of the confidential client (`''` when unusable). */
	clientSecret: string;
	/** Scopes to request; always includes `openid`. */
	scopes: string[];
	/** `OIDC_CALLBACK_URL`, or `''` for the default `<API_BASE_URL>/api/auth/oidc/callback`. */
	callbackUrl: string;
	/** Label of the login button (`Sign in with <displayName>`). */
	displayName: string;
	/** Settings the sign-in needs that are missing or refused. While any is listed the plugin stays off. */
	unusable: Array<{ name: string; problem: OidcSettingProblem }>;
}

/**
 * Why a URL cannot be used as an issuer: it must be absolute `https` (`http` only on the local machine),
 * without credentials, query or fragment. This is the rule the OIDC library of `@gauzy/auth` applies
 * when it contacts an issuer; checking it here keeps a plugin with an unusable issuer from loading at all.
 *
 * @param value - The issuer identifier.
 * @returns The problem, or `null` for a usable issuer.
 */
export function oidcIssuerProblem(value: string): 'invalid_url' | 'insecure_url' | null {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return 'invalid_url';
	}
	// `?` and `#` count even when empty: discovery appends its path to the issuer as text.
	if (value.includes('?') || value.includes('#') || url.username || url.password) {
		return 'invalid_url';
	}
	if (url.protocol === 'https:') {
		return null;
	}
	if (url.protocol === 'http:' && LOOPBACK_HOSTS.has(url.hostname)) {
		return null;
	}
	return url.protocol === 'http:' ? 'insecure_url' : 'invalid_url';
}

/**
 * Why a URL cannot be used as the callback (the OAuth redirect URI): it must be an absolute `http` or
 * `https` URL without credentials or fragment (RFC 6749, section 3.1.2).
 *
 * @param value - The callback URL.
 * @returns The problem, or `null` for a usable URL.
 */
export function oidcCallbackUrlProblem(value: string): 'invalid_url' | null {
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return 'invalid_url';
	}
	const usable = (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password && !value.includes('#');
	return usable ? null : 'invalid_url';
}

/**
 * Reads `OIDC_SCOPES` (separated by spaces or commas). `openid` is always requested; without `email`
 * most providers send no address, so that is reported.
 */
function parseScopes(raw: string | undefined, warn: (message: string) => void): string[] {
	const configured = (raw ?? '')
		.split(/[\s,]+/)
		.map((scope) => scope.trim())
		.filter(Boolean);
	const scopes = configured.length ? [...new Set(configured)] : [...OIDC_DEFAULT_SCOPES];
	if (!scopes.includes('email')) {
		warn('OIDC_SCOPES does not request "email": most providers then send no e-mail address, and nobody can sign in.');
	}
	return scopes.includes('openid') ? scopes : ['openid', ...scopes];
}

/** Reads `OIDC_DISPLAY_NAME`: a short label without control characters, `SSO` otherwise. */
function parseDisplayName(raw: string | undefined, warn: (message: string) => void): string {
	const value = (raw ?? '').trim();
	if (!value) {
		return OIDC_DEFAULT_DISPLAY_NAME;
	}
	// eslint-disable-next-line no-control-regex
	if (value.length > OIDC_DISPLAY_NAME_MAX_LENGTH || /[\u0000-\u001f\u007f]/.test(value)) {
		warn(
			`OIDC_DISPLAY_NAME must be at most ${OIDC_DISPLAY_NAME_MAX_LENGTH} characters without control characters; using "${OIDC_DEFAULT_DISPLAY_NAME}".`
		);
		return OIDC_DEFAULT_DISPLAY_NAME;
	}
	return value;
}

/**
 * Parses the plugin settings. Pure: everything comes in through `env`, and each fallback is reported
 * through `warn` (never with a secret in it).
 *
 * The issuer is used exactly as configured (only surrounding spaces are dropped): it must equal the
 * `issuer` of the provider's discovery document and the `iss` claim byte for byte, and some providers
 * (Authentik, for one) publish it with a trailing slash.
 *
 * @param env - Environment variables.
 * @param warn - Receives one line per fallback.
 * @returns The settings.
 */
export function parseOidcSettings(env: Env, warn: (message: string) => void = () => undefined): AuthOidcSettings {
	const unusable: AuthOidcSettings['unusable'] = [];

	const issuer = env['OIDC_ISSUER']?.trim() ?? '';
	const issuerProblem = issuer ? oidcIssuerProblem(issuer) : 'missing';
	if (issuerProblem) {
		unusable.push({ name: 'OIDC_ISSUER', problem: issuerProblem });
	}

	const credential = (name: string): string => {
		const value = env[name]?.trim() ?? '';
		if (!value || value === PLACEHOLDER) {
			unusable.push({ name, problem: value ? 'placeholder' : 'missing' });
			return '';
		}
		return value;
	};
	const clientId = credential('OIDC_CLIENT_ID');
	const clientSecret = credential('OIDC_CLIENT_SECRET');

	const callbackUrl = env['OIDC_CALLBACK_URL']?.trim() ?? '';
	const callbackProblem = callbackUrl ? oidcCallbackUrlProblem(callbackUrl) : null;
	if (callbackProblem) {
		unusable.push({ name: 'OIDC_CALLBACK_URL', problem: callbackProblem });
	}

	return {
		issuer: issuerProblem ? '' : issuer,
		clientId,
		clientSecret,
		scopes: parseScopes(env['OIDC_SCOPES'], warn),
		callbackUrl: callbackProblem ? '' : callbackUrl,
		displayName: parseDisplayName(env['OIDC_DISPLAY_NAME'], warn),
		unusable
	};
}

/**
 * Whether OpenID Connect sign-in is fully configured: a usable issuer, a client id and secret (not
 * the sample placeholder) and, when set, a usable callback URL.
 *
 * @param env - Environment variables.
 * @returns `true` when the sign-in can run.
 */
export function isOidcConfigured(env: Env = process.env): boolean {
	return parseOidcSettings(env).unusable.length === 0;
}

/**
 * Whether the plugin is loaded: `OIDC_ENABLED=true` and the sign-in fully configured.
 *
 * Read once, when the API assembles its plugin list. Unset, empty and `false` keep it off silently: no
 * route, no button, no outbound request, whatever the other `OIDC_*` values say. Any other value of the
 * switch, and a switched-on plugin that is not configured, keep it off and are reported through `warn`
 * (with the names of the settings only, never their values).
 *
 * @param env - Environment variables.
 * @param warn - Receives the reason the plugin stays off.
 * @returns `true` when the plugin should be loaded.
 */
export function isOidcEnabled(
	env: Env = process.env,
	warn: (message: string) => void = (message) => new Logger('AuthOidcPlugin').warn(message)
): boolean {
	const raw = env[OIDC_ENABLED_ENV];
	if (raw === undefined || raw === '' || raw === 'false') {
		return false;
	}
	if (raw !== 'true') {
		warn(`${OIDC_ENABLED_ENV} must be "true" or "false"; OpenID Connect sign-in stays off.`);
		return false;
	}
	const { unusable } = parseOidcSettings(env);
	if (unusable.length) {
		const list = unusable.map(({ name, problem }) => `${name} (${problem})`).join(', ');
		warn(`${OIDC_ENABLED_ENV}=true, but OpenID Connect sign-in is not configured: ${list}. It stays off.`);
		return false;
	}
	return true;
}
