import { Logger } from '@nestjs/common';
import { isSelfServiceSignupAllowed, resolveAuthSwitches } from '@gauzy/config';

/** The switch that loads the plugin. Off unless set to exactly `true`. */
export const ZITADEL_ENABLED_ENV = 'ZITADEL_ENABLED';

/**
 * The App Launcher switch (shared with the Ever Platform connection plugin, which serves the launcher's routes).
 * Off unless set to exactly `true`. Only while it is on does a sign-in ask Ever ID for a refresh token
 * (`offline_access`) and keep it, encrypted, with the session it opened.
 */
export const APP_LAUNCHER_ENABLED_ENV = 'EVER_APP_LAUNCHER_ENABLED';

/** The scope that asks the issuer for a refresh token. */
export const OFFLINE_ACCESS_SCOPE = 'offline_access';

/** How a person without a link may be connected to an existing Gauzy account. */
export type ZitadelLinkMode = 'explicit' | 'confirmed';

/** Why an issuer from `ZITADEL_ISSUERS` was not accepted. */
export type ZitadelIssuerRefusal = 'invalid_url' | 'insecure_url' | 'ever_issuer_requires_connect' | 'too_many';

/** The plugin settings, read once from the environment when the plugin starts. */
export interface AuthZitadelSettings {
	/** Accepted issuers; the first one is used for the sign-in button. */
	issuers: string[];
	/** Issuers that were configured but not accepted, with the reason. */
	refusedIssuers: Array<{ issuer: string; reason: ZitadelIssuerRefusal }>;
	/** Ever-host issuers that only Ever Connect can enable on a non-cloud install. */
	everIssuersAwaitingConnect: string[];
	clientId: string | null;
	clientSecret: string | null;
	callbackUrl: string;
	/** Client ids whose tokens `POST /api/auth/zitadel/token` accepts. */
	allowedAudiences: string[];
	/** The link mode in effect (`confirmed` only on Ever Cloud). */
	linkMode: ZitadelLinkMode;
	/**
	 * The confirmed sign-up path for people new to Gauzy (Ever Cloud only, and never while the operator has closed
	 * registration with `APP_USER_REGISTRATION=false` or `ALLOW_TENANTS_REGISTRATION=false`).
	 */
	signupEnabled: boolean;
	backchannelLogoutEnabled: boolean;
	handoffTtlSeconds: number;
	confirmTtlSeconds: number;
	scopes: string[];
	/** `EVER_INSTALL_SOURCE=cloud`. Never inferred from anything else. */
	isCloud: boolean;
	everConnectEnabled: boolean;
	apiBaseUrl: string;
	clientBaseUrl: string;
	/** Mark cookies `Secure` (the API is served over https). */
	secureCookies: boolean;
	/**
	 * `EVER_APP_LAUNCHER_ENABLED=true`: a browser sign-in also asks for `offline_access` and keeps the refresh token
	 * of its Ever ID session (encrypted), so the App Launcher can read the person's apps. Off: nothing changes.
	 */
	launcherEnabled: boolean;
}

type Env = Record<string, string | undefined>;

/** Hosts whose issuers are only accepted on a non-cloud install through Ever Connect. */
const EVER_DOMAIN = 'ever.co';

/** The OpenID scope a product must never request on its own (it scopes the login to one organization). */
const ORG_SCOPE_PREFIX = 'urn:zitadel:iam:org:id:';

const MAX_ISSUERS = 3;

/**
 * Reads a boolean switch strictly: only the exact strings `true` and `false` count; anything else
 * (`TRUE`, `1`, `yes`) is the default and is reported through `warn`.
 */
export function readStrictBoolean(
	env: Env,
	name: string,
	fallback: boolean,
	warn: (message: string) => void = () => undefined
): boolean {
	const value = env[name];
	if (value === undefined || value === '') {
		return fallback;
	}
	if (value === 'true') {
		return true;
	}
	if (value === 'false') {
		return false;
	}
	warn(`${name} must be "true" or "false"; using ${fallback}.`);
	return fallback;
}

/**
 * Whether the plugin is loaded. Read once, when the API assembles its plugin list; with the switch
 * unset the plugin is not loaded at all: no route, no timer, no outbound request.
 *
 * @param env - Environment variables.
 * @returns `true` only for `ZITADEL_ENABLED=true`.
 */
export function isZitadelEnabled(env: Env = process.env): boolean {
	return readStrictBoolean(env, ZITADEL_ENABLED_ENV, false, (message) =>
		new Logger('AuthZitadelPlugin').warn(message)
	);
}

/**
 * Whether the App Launcher is on. Read once, when the plugin starts: only the exact string `true` turns it on;
 * unset, empty and `false` keep it off, any other value keeps it off and is reported through `warn`.
 *
 * @param env - Environment variables.
 * @param warn - Receives one line when the value is not `true` or `false` (never the value itself).
 * @returns `true` only for `EVER_APP_LAUNCHER_ENABLED=true`.
 */
export function isAppLauncherEnabled(env: Env = process.env, warn: (message: string) => void = () => undefined): boolean {
	return readStrictBoolean(env, APP_LAUNCHER_ENABLED_ENV, false, warn);
}

/**
 * The scopes of a sign-in's authorize request: the configured ones, plus `offline_access` while the App Launcher
 * keeps refresh tokens. Without that, exactly the configured ones.
 *
 * @param scopes - The configured scopes (`ZITADEL_SCOPES`, or the default).
 * @param keepRefreshToken - Whether the sign-in keeps the refresh token of its Ever ID session.
 * @returns The scopes to request.
 */
export function signinScopes(scopes: string[], keepRefreshToken: boolean): string[] {
	if (!keepRefreshToken || scopes.includes(OFFLINE_ACCESS_SCOPE)) {
		return scopes;
	}
	return [...scopes, OFFLINE_ACCESS_SCOPE];
}

/**
 * Whether an issuer URL is on an Ever host (`ever.co` or a subdomain of it).
 *
 * @param issuer - Issuer URL.
 * @returns `true` for an Ever host.
 */
export function isEverHost(issuer: string): boolean {
	let host: string;
	try {
		host = new URL(issuer).hostname.toLowerCase();
	} catch {
		return false;
	}
	while (host.endsWith('.')) {
		host = host.slice(0, -1);
	}
	return host === EVER_DOMAIN || host.endsWith(`.${EVER_DOMAIN}`);
}

/**
 * Whether a URL may be used as an issuer: https, or http on a loopback host (local development and
 * tests only). No query, fragment or credentials.
 */
export function issuerProblem(issuer: string): ZitadelIssuerRefusal | null {
	let url: URL;
	try {
		url = new URL(issuer);
	} catch {
		return 'invalid_url';
	}
	// `?` and `#` count even when empty: discovery appends its path to the issuer as text.
	if (issuer.includes('?') || issuer.includes('#') || url.username || url.password) {
		return 'invalid_url';
	}
	if (url.protocol === 'https:') {
		return null;
	}
	if (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
		return null;
	}
	return url.protocol === 'http:' ? 'insecure_url' : 'invalid_url';
}

export function stripTrailingSlashes(value: string): string {
	let end = value.length;
	while (end > 0 && value.charAt(end - 1) === '/') {
		end--;
	}
	return value.slice(0, end);
}

function list(value: string | undefined, separator = ','): string[] {
	return (value ?? '')
		.split(separator)
		.map((item) => item.trim())
		.filter(Boolean);
}

function boundedInt(env: Env, name: string, fallback: number, min: number, max: number, warn: (m: string) => void): number {
	const raw = env[name];
	if (raw === undefined || raw === '') {
		return fallback;
	}
	const value = Number(raw);
	if (!Number.isInteger(value) || value < min || value > max) {
		warn(`${name} must be a whole number between ${min} and ${max}; using ${fallback}.`);
		return fallback;
	}
	return value;
}

type IssuerSettings = Pick<AuthZitadelSettings, 'issuers' | 'refusedIssuers' | 'everIssuersAwaitingConnect'>;

/** Reads `ZITADEL_ISSUERS`: at most three valid issuers; an Ever host only on Ever Cloud. */
function parseIssuers(env: Env, isCloud: boolean, warn: (message: string) => void): IssuerSettings {
	const result: IssuerSettings = { issuers: [], refusedIssuers: [], everIssuersAwaitingConnect: [] };
	for (const raw of list(env['ZITADEL_ISSUERS'])) {
		const issuer = stripTrailingSlashes(raw);
		const problem = issuerProblem(issuer);
		if (problem) {
			result.refusedIssuers.push({ issuer, reason: problem });
			warn(`ZITADEL_ISSUERS: ${issuer} is not accepted (${problem}).`);
		} else if (result.issuers.length + result.everIssuersAwaitingConnect.length >= MAX_ISSUERS) {
			result.refusedIssuers.push({ issuer, reason: 'too_many' });
			warn(`ZITADEL_ISSUERS: at most ${MAX_ISSUERS} issuers are used; ${issuer} is ignored.`);
		} else if (!isCloud && isEverHost(issuer)) {
			// On a non-cloud install an Ever issuer is only ever enabled through Ever Connect.
			result.everIssuersAwaitingConnect.push(issuer);
		} else if (!result.issuers.includes(issuer)) {
			result.issuers.push(issuer);
		}
	}
	if (result.everIssuersAwaitingConnect.length) {
		warn(
			`ZITADEL_ISSUERS: ${result.everIssuersAwaitingConnect.join(', ')} can only be enabled through Ever Connect on this install; not used.`
		);
	}
	return result;
}

/** Reads `ZITADEL_LINK_MODE`: `confirmed` only on Ever Cloud, `explicit` otherwise. */
function parseLinkMode(env: Env, isCloud: boolean, warn: (message: string) => void): ZitadelLinkMode {
	const requested = env['ZITADEL_LINK_MODE'] || 'explicit';
	if (requested === 'confirmed') {
		if (isCloud) {
			return 'confirmed';
		}
		warn('ZITADEL_LINK_MODE=confirmed is only available on Ever Cloud; using explicit.');
	} else if (requested !== 'explicit') {
		warn('ZITADEL_LINK_MODE must be "explicit" or "confirmed"; using explicit.');
	}
	return 'explicit';
}

/** Reads `ZITADEL_SCOPES`: always `openid`, never an organization-scoped login scope. */
function parseScopes(env: Env, warn: (message: string) => void): string[] {
	const projectId = env['EVER_PLATFORM_PROJECT_ID']?.trim();
	const defaultScopes = ['openid', 'profile', 'email', 'urn:zitadel:iam:user:resourceowner'];
	if (projectId) {
		defaultScopes.push(`urn:zitadel:iam:org:project:id:${projectId}:aud`);
	}
	let scopes = env['ZITADEL_SCOPES'] ? list(env['ZITADEL_SCOPES'], ' ') : defaultScopes;
	if (scopes.some((scope) => scope.startsWith(ORG_SCOPE_PREFIX))) {
		warn('ZITADEL_SCOPES: organization-scoped login scopes are never requested; removed.');
		scopes = scopes.filter((scope) => !scope.startsWith(ORG_SCOPE_PREFIX));
	}
	return scopes.includes('openid') ? scopes : ['openid', ...scopes];
}

/**
 * Parses the plugin settings from the environment. Pure: everything it needs comes in through `env`,
 * and every problem is reported through `warn` (never with a secret in it).
 *
 * @param env - Environment variables.
 * @param warn - Receives one line per problem.
 * @returns The settings.
 */
export function parseZitadelSettings(env: Env, warn: (message: string) => void = () => undefined): AuthZitadelSettings {
	const apiBaseUrl = stripTrailingSlashes(env['API_BASE_URL'] || 'http://localhost:3000');
	const clientBaseUrl = stripTrailingSlashes(env['CLIENT_BASE_URL'] || 'http://localhost:4200');
	const isCloud = env['EVER_INSTALL_SOURCE'] === 'cloud';
	const everConnectEnabled = readStrictBoolean(env, 'EVER_CONNECT_ENABLED', false, warn);
	const { issuers, refusedIssuers, everIssuersAwaitingConnect } = parseIssuers(env, isCloud, warn);
	const linkMode = parseLinkMode(env, isCloud, warn);

	const signupRequested = readStrictBoolean(env, 'ZITADEL_SIGNUP_ENABLED', false, warn);
	if (signupRequested && !isCloud) {
		warn('ZITADEL_SIGNUP_ENABLED is only available on Ever Cloud; ignored.');
	}
	// The operator's registration switches close every sign-up, this one included: it creates a workspace owner
	// through Gauzy's register path, which the public register route refuses while registration is closed.
	const registrationOpen = isSelfServiceSignupAllowed(resolveAuthSwitches(env));
	if (signupRequested && isCloud && !registrationOpen) {
		warn('ZITADEL_SIGNUP_ENABLED is ignored: APP_USER_REGISTRATION or ALLOW_TENANTS_REGISTRATION is false.');
	}

	if (readStrictBoolean(env, 'ZITADEL_JIT_PROVISIONING', false, warn)) {
		warn('ZITADEL_JIT_PROVISIONING: accounts are never created without the person confirming; ignored.');
	}

	const scopes = parseScopes(env, warn);

	return {
		issuers,
		refusedIssuers,
		everIssuersAwaitingConnect,
		clientId: env['ZITADEL_CLIENT_ID']?.trim() || null,
		clientSecret: env['ZITADEL_CLIENT_SECRET']?.trim() || null,
		callbackUrl: env['ZITADEL_CALLBACK_URL']?.trim() || `${apiBaseUrl}/api/auth/zitadel/callback`,
		allowedAudiences: list(env['ZITADEL_ALLOWED_AUDIENCES']),
		linkMode,
		signupEnabled: signupRequested && isCloud && registrationOpen,
		backchannelLogoutEnabled: readStrictBoolean(env, 'ZITADEL_BACKCHANNEL_LOGOUT_ENABLED', true, warn),
		handoffTtlSeconds: boundedInt(env, 'ZITADEL_HANDOFF_TTL_S', 60, 10, 600, warn),
		confirmTtlSeconds: boundedInt(env, 'ZITADEL_CONFIRM_TTL_S', 1800, 60, 86_400, warn),
		scopes,
		isCloud,
		everConnectEnabled,
		apiBaseUrl,
		clientBaseUrl,
		secureCookies: /^https:\/\//i.test(apiBaseUrl),
		launcherEnabled: isAppLauncherEnabled(env, warn)
	};
}
