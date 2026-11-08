import { isAppLauncherEnabled } from '@gauzy/plugin-auth-zitadel';
import { isLoopbackHost } from '../ever-connect-config';
import { isEverConnectEnabled } from '../ever-connect-enabled';

type Env = Record<string, string | undefined>;
type Warn = (message: string) => void;

/** Injection token of the App Launcher settings ({@link LauncherConfig}). */
export const EVER_CONNECT_LAUNCHER_SETTINGS = 'EVER_CONNECT_LAUNCHER_SETTINGS';

/** The most browser origins `EVER_APP_LAUNCHER_ORIGINS` may list. */
export const MAX_LAUNCHER_ORIGINS = 50;

/** Ever Works' API, whose public catalog lists the Ever apps (no credentials are ever sent to it). */
export const DEFAULT_WORKS_API_URL = 'https://api.ever.works';

/** Ever Works' web app, where the launcher's "Manage" link leads. */
export const DEFAULT_WORKS_APP_URL = 'https://app.ever.works';

/** The catalog id of this product: its tile reads "You're here". */
export const LAUNCHER_CURRENT = 'ever-gauzy';

/** The settings of the App Launcher, read once from the environment when the module is registered. */
export interface LauncherConfig {
	/**
	 * `EVER_APP_LAUNCHER_ENABLED=true` (exactly) with Ever ID sign-in loaded (`ZITADEL_ENABLED=true`) and the Ever
	 * Platform connection loaded (`EVER_CONNECT_ENABLED=true`): only then are the launcher's routes registered and its
	 * token encryption (`EVER_ID_TOKEN_VAULT`) offered to the sign-in. Otherwise they do not exist (404), nothing of
	 * the launcher runs, and sign-ins keep no Ever ID refresh token.
	 */
	enabled: boolean;
	/**
	 * `EVER_APP_LAUNCHER_ORIGINS`: the browser origins the routes answer (at most {@link MAX_LAUNCHER_ORIGINS}).
	 * Unset: the origin of the web app (`CLIENT_BASE_URL`).
	 */
	origins: string[];
	/** `EVER_PLATFORM_PROJECT_ID`: the audience of the token the organization's apps are read with, or `null`. */
	audience: string | null;
	/**
	 * `EVER_WORKS_API_URL` (default {@link DEFAULT_WORKS_API_URL}): where the public catalog of Ever apps is read,
	 * without credentials; `null` when it is set to an address that cannot be used (then the bundled list is shown and
	 * nothing is read).
	 */
	catalogUrl: string | null;
	/** `EVER_WORKS_APP_URL` (default {@link DEFAULT_WORKS_APP_URL}): where "Manage" leads. */
	worksAppUrl: string;
}

/** An https URL (plain http only on a loopback host) without credentials, query or fragment, or `null`. */
function usableBase(raw: string): string | null {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return null;
	}
	const secure = url.protocol === 'https:' || (url.protocol === 'http:' && isLoopbackHost(url.hostname));
	if (!secure || url.username || url.password || raw.includes('?') || raw.includes('#')) {
		return null;
	}
	return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

/** A browser origin (`scheme://host[:port]`), or `null`. */
export function originOf(raw: string | undefined): string | null {
	if (!raw) {
		return null;
	}
	try {
		const url = new URL(raw.trim());
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.origin : null;
	} catch {
		return null;
	}
}

/** A value without its trailing slashes, in one pass (`/\/+$/` is quadratic on a long run of slashes). */
function withoutTrailingSlashes(value: string): string {
	let end = value.length;
	while (end > 0 && value.charCodeAt(end - 1) === 47) end--;
	return value.slice(0, end);
}

/**
 * The origins of `EVER_APP_LAUNCHER_ORIGINS` (comma-separated), each once: a value that is not an origin is ignored,
 * and so are those past `MAX_LAUNCHER_ORIGINS`, each case with one warning. Unset or empty: the origin of
 * `CLIENT_BASE_URL` (`http://localhost:4200` by default).
 */
function parseOrigins(env: Env, warn: Warn): string[] {
	const raw = env['EVER_APP_LAUNCHER_ORIGINS'];
	if (raw === undefined || raw.trim() === '') {
		const own = originOf(env['CLIENT_BASE_URL']?.trim() || 'http://localhost:4200');
		return own ? [own] : [];
	}
	const origins: string[] = [];
	let refused = 0;
	for (const part of raw
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean)) {
		const origin = originOf(part);
		// An origin only: a path, query or fragment means the value was not meant as one.
		if (!origin || withoutTrailingSlashes(part) !== origin) {
			refused++;
		} else if (!origins.includes(origin)) {
			origins.push(origin);
		}
	}
	if (refused) {
		warn(`EVER_APP_LAUNCHER_ORIGINS: ${refused} value(s) are not origins (scheme://host[:port]) and are ignored.`);
	}
	if (origins.length > MAX_LAUNCHER_ORIGINS) {
		warn(`EVER_APP_LAUNCHER_ORIGINS: at most ${MAX_LAUNCHER_ORIGINS} origins are used; the rest are ignored.`);
		return origins.slice(0, MAX_LAUNCHER_ORIGINS);
	}
	return origins;
}

/**
 * `EVER_APP_LAUNCHER_ENABLED`: only the exact value `true` turns it on; unset, empty and `false` keep it off
 * silently, anything else keeps it off with one warning that never repeats the value.
 *
 * The switch is shared with the Ever ID sign-in plugin, which decides from it whether a sign-in keeps its refresh
 * token: both read it with that plugin's {@link isAppLauncherEnabled}, so they can never disagree on a value.
 */
export function isLauncherSwitchedOn(env: Env, warn: Warn = () => undefined): boolean {
	return isAppLauncherEnabled(env, warn);
}

/**
 * Reads the App Launcher settings. Pure: everything comes in through `env`, and every problem is reported through
 * `warn` (never with a value an operator typed in it, never a secret).
 */
export function readLauncherConfig(env: Env, warn: Warn = () => undefined): LauncherConfig {
	const switchedOn = isLauncherSwitchedOn(env, warn);
	const signInLoaded = env['ZITADEL_ENABLED'] === 'true';
	if (switchedOn && !signInLoaded) {
		warn('EVER_APP_LAUNCHER_ENABLED=true has no effect without Ever ID sign-in (ZITADEL_ENABLED=true).');
	}
	// The launcher is part of the Ever Platform connection: without it, nothing of the launcher is registered, not
	// even its token encryption, so a sign-in never asks for `offline_access` (the Ever ID sign-in plugin says so).
	const enabled = switchedOn && signInLoaded && isEverConnectEnabled(env);
	const configuredCatalog = env['EVER_WORKS_API_URL']?.trim();
	const catalogUrl = usableBase(configuredCatalog || DEFAULT_WORKS_API_URL);
	if (enabled && configuredCatalog && !catalogUrl) {
		warn(
			'EVER_WORKS_API_URL cannot be used by the App Launcher (https only, no credential, query or fragment); it shows the bundled list of Ever apps.'
		);
	}
	const audience = env['EVER_PLATFORM_PROJECT_ID']?.trim() || null;
	if (enabled && !audience) {
		warn(
			'The App Launcher shows no organization apps without EVER_PLATFORM_PROJECT_ID (the Ever Platform audience).'
		);
	}
	return {
		enabled,
		origins: enabled ? parseOrigins(env, warn) : [],
		audience,
		catalogUrl,
		worksAppUrl: usableBase(env['EVER_WORKS_APP_URL']?.trim() || DEFAULT_WORKS_APP_URL) ?? DEFAULT_WORKS_APP_URL
	};
}
