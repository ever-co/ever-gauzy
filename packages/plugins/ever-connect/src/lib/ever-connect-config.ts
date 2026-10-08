import { InstallSource, parseInstallSource } from '@gauzy/plugin-ever-instance';
import { DEFAULT_PLATFORM_API_URL, isInstanceWideKey } from './ever-connect.constants';
import { CONSTANTS, isLocalHost } from './sdk';

export { isEverConnectEnabled } from './ever-connect-enabled';

type Env = Record<string, string | undefined>;
type Warn = (message: string) => void;

/** How the installation reads its Ever Platform events: a long poll, or one read every 15 minutes. */
export type FeedMode = 'longpoll' | 'interval';

/** The settings of the Ever Platform connection, read once from the environment. */
export interface EverConnectConfig {
	/**
	 * `EVER_PLATFORM_API_URL` (default `https://api.ever.co`), or `null` when it is set to something
	 * that cannot be used (not https, credentials, a query or a fragment): then nothing is sent at all,
	 * never to another address than the one the operator chose.
	 */
	apiUrl: string | null;
	/** Declared by `EVER_INSTALL_SOURCE`, never inferred. */
	installSource: InstallSource;
	/** `EVER_INSTALL_SOURCE=cloud`: Ever operates this installation; nobody here is its operator. */
	cloud: boolean;
	/** `EVER_CONNECT_FEED_MODE`. */
	feedMode: FeedMode;
	/** `EVER_CONNECT_INTEGRATIONS_DENY`: integration keys denied for every organization (`*`: all). */
	deny: string[];
	/** `EVER_CONNECT_CODE`: a connect code used once at start, or `null`. */
	connectCode: string | null;
	/** The products this API serves (`EVER_STATS_SERVES`: `gauzy`, `teams`). */
	serves: Array<'gauzy' | 'teams'>;
	/** The Gauzy release (`GAUZY_APP_VERSION`, `major.minor.patch`; `0.0.0` for a source build). */
	version: string;
	/**
	 * The origin of the web app (`CLIENT_BASE_URL`) that app.ever.co may send an administrator back
	 * to after a consent, or `null`: https only, or plain http on `localhost`, `127.0.0.1` or `[::1]`
	 * (as the contract allows). An address on a private network is never sent. Ever Platform keeps
	 * only a digest of it.
	 */
	returnOrigin: string | null;
	/** The web app address app.ever.co sends an administrator back to (no fragment), or `null`. */
	returnUrl: string | null;
	/** `CLIENT_BASE_URL` is set but is not one that may be sent (plain http on another host). */
	returnUnusable: boolean;
	/**
	 * `EVER_PLATFORM_ISSUER`: the issuer Ever Platform's documents name, when it differs from the
	 * origin of `EVER_PLATFORM_API_URL` (a mock platform in tests). Honoured only when
	 * `EVER_PLATFORM_API_URL` is a loopback address (`localhost`, `127.0.0.0/8`, `::1`).
	 */
	issuer: string | null;
	/**
	 * `EVER_PLATFORM_API_URL` is a loopback address: only then are `EVER_PLATFORM_ISSUER` and
	 * `EVER_PLATFORM_ROOT_KEYS_FILE` (test keys) honoured.
	 */
	loopback: boolean;
}

/** `localhost` (and `*.localhost`), `127.0.0.0/8` and `::1`. */
export function isLoopbackHost(hostname: string): boolean {
	const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
	return (
		host === 'localhost' ||
		host.endsWith('.localhost') ||
		host === '::1' ||
		/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)
	);
}

const KEY = /^[a-z0-9_]{2,64}$/;

/**
 * The Ever Platform address. Unset: `https://api.ever.co`. Set but unusable: `null`, so nothing is
 * sent; the operator's choice is never replaced by another address.
 */
function parseApiUrl(env: Env, warn: Warn): string | null {
	const configured = env['EVER_PLATFORM_API_URL']?.trim();
	if (!configured) {
		return DEFAULT_PLATFORM_API_URL;
	}
	let url: URL;
	try {
		url = new URL(configured);
	} catch {
		warn('EVER_PLATFORM_API_URL is not a URL; the Ever Platform connection sends nothing until it is corrected.');
		return null;
	}
	const okProtocol = url.protocol === 'https:' || (url.protocol === 'http:' && isLocalHost(url.hostname));
	if (!okProtocol || url.username || url.password || url.search || url.hash) {
		warn(
			'EVER_PLATFORM_API_URL must be https (plain http only for a local or private address) and carry no credential, query or fragment; the Ever Platform connection sends nothing until it is corrected.'
		);
		return null;
	}
	if (url.protocol === 'http:') {
		warn(
			'EVER_PLATFORM_API_URL is plain http: the connect code and the instance token cross the network in clear. Use it for a local test platform only.'
		);
	}
	return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

function parseFeedMode(raw: string | undefined, warn: Warn): FeedMode {
	if (raw === undefined || raw.trim() === '' || raw.trim() === 'longpoll') {
		return 'longpoll';
	}
	if (raw.trim() === 'interval') {
		return 'interval';
	}
	warn('EVER_CONNECT_FEED_MODE is neither "longpoll" nor "interval"; using longpoll.');
	return 'longpoll';
}

function parseDeny(raw: string | undefined, warn: Warn): string[] {
	if (raw === undefined || raw.trim() === '') {
		return [];
	}
	const parts = raw
		.split(',')
		.map((part) => part.trim().toLowerCase())
		.filter((part) => part.length > 0);
	const keys = parts.filter((part) => part === '*' || KEY.test(part));
	if (keys.length !== parts.length) {
		warn('EVER_CONNECT_INTEGRATIONS_DENY holds a value that is not an integration key; it is ignored.');
	}
	return [...new Set(keys)];
}

function parseCode(raw: string | undefined): string | null {
	const value = raw?.trim();
	return value ? value : null;
}

function parseServes(raw: string | undefined): Array<'gauzy' | 'teams'> {
	if (raw === undefined || raw.trim() === '') {
		return ['gauzy'];
	}
	const parts = raw.split(',').map((part) => part.trim());
	const known = parts.every((part) => part === 'gauzy' || part === 'teams') && new Set(parts).size === parts.length;
	return known ? (['gauzy', 'teams'] as const).filter((product) => parts.includes(product)) : ['gauzy'];
}

/** The release from `GAUZY_APP_VERSION` (`v111.47.0`, `v111.47.0-4-gbb20466`): `major.minor.patch` only. */
export function releaseVersion(raw: string | undefined): string {
	const match = /^(\d{1,4})\.(\d{1,4})\.(\d{1,4})/.exec((raw ?? '').trim().replace(/^v/i, ''));
	return match ? `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}` : '0.0.0';
}

/** The hosts plain http may return to (the contract's `return_origins`). */
const HTTP_RETURN_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * The web app origin a consent may return to: https, or plain http on `localhost`, `127.0.0.1` or
 * `[::1]`. Any other address (plain http on a private network) is never sent.
 */
function parseReturn(raw: string | undefined): { origin: string; url: string } | null {
	const value = raw?.trim();
	if (!value) {
		return null;
	}
	let url: URL;
	try {
		url = new URL(value);
	} catch {
		return null;
	}
	const httpOk = url.protocol === 'http:' && HTTP_RETURN_HOSTS.has(url.hostname.toLowerCase());
	if (!(url.protocol === 'https:' || httpOk) || url.username || url.password) {
		return null;
	}
	const base = `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
	// Ever Platform takes no fragment in a return address, and the web app routes in its fragment:
	// the consent screen returns to the web app itself; the Ever Platform page reads the result.
	return { origin: url.origin, url: `${base}/` };
}

/**
 * Reads the settings once. A malformed value falls back to its default with one `warn` line (which
 * never repeats the value), except an unusable Ever Platform address, which sends nothing.
 */
export function readEverConnectConfig(env: Env = process.env, warn: Warn = () => undefined): EverConnectConfig {
	const installSource = parseInstallSource(env, warn);
	const ret = parseReturn(env['CLIENT_BASE_URL']);
	const apiUrl = parseApiUrl(env, warn);
	const loopback = apiUrl !== null && isLoopbackHost(new URL(apiUrl).hostname);
	const issuer = env['EVER_PLATFORM_ISSUER']?.trim() || null;
	if (!loopback && (issuer || env['EVER_PLATFORM_ROOT_KEYS_FILE']?.trim())) {
		warn(
			'EVER_PLATFORM_ISSUER and EVER_PLATFORM_ROOT_KEYS_FILE are for a test platform on a loopback address only; they are ignored.'
		);
	}
	return {
		apiUrl,
		installSource,
		cloud: installSource === 'cloud',
		feedMode: parseFeedMode(env['EVER_CONNECT_FEED_MODE'], warn),
		deny: parseDeny(env['EVER_CONNECT_INTEGRATIONS_DENY'], warn),
		connectCode: parseCode(env['EVER_CONNECT_CODE']),
		serves: parseServes(env['EVER_STATS_SERVES']),
		version: releaseVersion(env['GAUZY_APP_VERSION']),
		returnOrigin: ret?.origin ?? null,
		returnUrl: ret?.url ?? null,
		returnUnusable: Boolean(env['CLIENT_BASE_URL']?.trim()) && !ret,
		issuer: loopback ? issuer : null,
		loopback
	};
}

/** Whether `EVER_CONNECT_INTEGRATIONS_DENY` denies `key` for every organization. */
export function deniedByEnv(config: Pick<EverConnectConfig, 'deny'>, key: string): boolean {
	return config.deny.includes('*') || config.deny.includes(key);
}

/** The integration keys of the contract, installation-wide ones first. */
export function integrationKeys(): string[] {
	const keys = [...CONSTANTS.integration_keys] as string[];
	return [...keys.filter(isInstanceWideKey), ...keys.filter((key) => !isInstanceWideKey(key))];
}
