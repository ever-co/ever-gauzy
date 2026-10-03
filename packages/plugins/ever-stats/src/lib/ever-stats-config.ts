import { InstallSource, parseInstallSource } from '@gauzy/plugin-ever-instance';
import { DEFAULT_STATS_API_URL } from './ever-stats.constants';

export { isEverStatsEnabled } from './ever-stats-enabled';

type Env = Record<string, string | undefined>;
type Warn = (message: string) => void;

/** The products a Gauzy API can report for (`EVER_STATS_SERVES`). */
export type StatsServes = Array<'gauzy' | 'teams'>;

/** The settings of the anonymous usage statistics, read once from the environment. */
export interface EverStatsConfig {
	/**
	 * `POST {apiUrl}/v1/stats/reports`, or `null` when `EVER_STATS_API_URL` (or
	 * `EVER_PLATFORM_API_URL`) is set to something that cannot be used: then nothing is sent at all,
	 * never to another address than the one the operator chose.
	 */
	apiUrl: string | null;
	/** ISO 3166-1 alpha-2 declared by the operator, or `ZZ`. Never derived from data or addresses. */
	country: string;
	/** The products this API serves, in the report and for the paired-instance state route. */
	serves: StatsServes;
	/** Seconds between two reports (one a day unless a test overrides it). */
	intervalS: number;
	/** Declared by `EVER_INSTALL_SOURCE`, never inferred. */
	installSource: InstallSource;
}

/** Whether this Gauzy API serves an Ever Teams web app (`EVER_STATS_SERVES` names `teams`). */
export function servesTeams(env: Env = process.env): boolean {
	return parseServes(env['EVER_STATS_SERVES']).includes('teams');
}

function parseServes(raw: string | undefined, warn: Warn = () => undefined): StatsServes {
	if (raw === undefined || raw.trim() === '') {
		return ['gauzy'];
	}
	const parts = raw.split(',').map((part) => part.trim());
	const known = parts.every((part) => part === 'gauzy' || part === 'teams') && new Set(parts).size === parts.length;
	if (!known) {
		warn('EVER_STATS_SERVES is not gauzy, teams or gauzy,teams; using gauzy.');
		return ['gauzy'];
	}
	return (['gauzy', 'teams'] as const).filter((product) => parts.includes(product));
}

const PRIVATE_V4 = [/^10\./, /^127\./, /^192\.168\./, /^172\.(1[6-9]|2[0-9]|3[01])\./];

/** Single-label names that are never a local service: `metadata` is the cloud metadata service on some clouds. */
const NOT_LOCAL_NAMES = new Set(['metadata']);

/** A host that plain http may reach: loopback, a private address, or a single-label name (a container). */
function isLocalHost(hostname: string): boolean {
	const host = hostname.replace(/^\[|\]$/g, '').toLowerCase();
	if (host === 'localhost' || host.endsWith('.localhost') || host === '::1') return true;
	if (PRIVATE_V4.some((re) => re.test(host))) return true;
	return /^[a-z\d-]+$/.test(host) && !/^\d+$/.test(host) && !NOT_LOCAL_NAMES.has(host);
}

/** Whether `apiUrl` points at a local service (a mock or a mirror on this host, a private address or a container). */
function isLocalDestination(apiUrl: string | null): boolean {
	if (!apiUrl) return false;
	try {
		return isLocalHost(new URL(apiUrl).hostname);
	} catch {
		return false;
	}
}

/**
 * The report destination. Unset: `https://api.ever.co`. Set but unusable (not a URL, plain http to
 * a public host, a credential, a query or a fragment): `null`, so nothing is sent; the operator's
 * choice is never replaced by another address.
 */
function parseApiUrl(env: Env, warn: Warn): string | null {
	const configured = env['EVER_STATS_API_URL']?.trim() || env['EVER_PLATFORM_API_URL']?.trim();
	if (!configured) {
		return DEFAULT_STATS_API_URL;
	}
	let url: URL;
	try {
		url = new URL(configured);
	} catch {
		warn('EVER_STATS_API_URL is not a URL; no anonymous usage statistics report will be sent until it is corrected.');
		return null;
	}
	const okProtocol = url.protocol === 'https:' || (url.protocol === 'http:' && isLocalHost(url.hostname));
	if (!okProtocol || url.username || url.password || url.search || url.hash) {
		warn(
			'EVER_STATS_API_URL must be https (plain http only for localhost, a private address or a container name) and carry no credential, query or fragment; no anonymous usage statistics report will be sent until it is corrected.'
		);
		return null;
	}
	return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

function parseCountry(raw: string | undefined, warn: Warn): string {
	if (raw === undefined || raw.trim() === '') {
		return 'ZZ';
	}
	const value = raw.trim().toUpperCase();
	if (/^[A-Z]{2}$/.test(value)) {
		return value;
	}
	warn('EVER_STATS_COUNTRY is not a two-letter country code; using ZZ (undeclared).');
	return 'ZZ';
}

/** The shortest interval for a public destination: an hour. Shorter ones are for tests against a local mock. */
const MIN_PUBLIC_INTERVAL_S = 3_600;

function parseInterval(raw: string | undefined, shortAllowed: boolean, warn: Warn): number {
	if (raw === undefined || raw.trim() === '') {
		return 86_400;
	}
	const value = Number(raw.trim());
	if (!Number.isInteger(value) || value < 1 || value > 604_800) {
		warn('EVER_STATS_SEND_INTERVAL_S is not a whole number of seconds between 1 and 604800; using 86400.');
		return 86_400;
	}
	if (value < MIN_PUBLIC_INTERVAL_S && !shortAllowed) {
		warn('EVER_STATS_SEND_INTERVAL_S below 3600 is accepted only for a local EVER_STATS_API_URL (tests); using 86400.');
		return 86_400;
	}
	return value;
}

/**
 * Reads the settings once. A malformed value falls back to its default with one `warn` line, except an
 * unusable destination, which sends nothing (see {@link EverStatsConfig.apiUrl}).
 */
export function readEverStatsConfig(env: Env = process.env, warn: Warn = () => undefined): EverStatsConfig {
	const apiUrl = parseApiUrl(env, warn);
	return {
		apiUrl,
		country: parseCountry(env['EVER_STATS_COUNTRY'], warn),
		serves: parseServes(env['EVER_STATS_SERVES'], warn),
		intervalS: parseInterval(env['EVER_STATS_SEND_INTERVAL_S'], env['NODE_ENV'] === 'test' || isLocalDestination(apiUrl), warn),
		installSource: parseInstallSource(env, warn)
	};
}
