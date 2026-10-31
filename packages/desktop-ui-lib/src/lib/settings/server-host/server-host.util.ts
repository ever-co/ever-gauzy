import { IDesktopNetworkAddress } from '@gauzy/contracts';

/**
 * What the "Server Hostname / IP Address" setting of Gauzy Server and Gauzy API Server holds.
 *
 * - `empty`: nothing typed; the server uses its default, `0.0.0.0`.
 * - `ipv4`, `ipv6`, `hostname`: a usable host, such as `192.168.1.20`, `[fd00::20]`, `localhost` or
 *   `gauzy.example.com`, optionally with `http://` / `https://`.
 * - `invalid`: not an IP address or a host name (`999.1.1.1`, `bad host!`); the setting cannot be saved.
 */
export type ServerHostKind = 'empty' | 'ipv4' | 'ipv6' | 'hostname' | 'invalid';

/** The parts of a host setting, as {@link parseServerHost} reads them. */
export interface IParsedServerHost {
	kind: ServerHostKind;
	/** `http` or `https` when the value starts with one, else null. */
	scheme: string | null;
	/** The IPv4 address, the IPv6 address (without brackets) or the name. Null when empty or invalid. */
	hostname: string | null;
	/** Whether an IPv6 address is written in square brackets, as a URL needs. */
	bracketed: boolean;
	/** A port written after the host (`:8080`), else null. */
	port: string | null;
	/** Anything written after the host and port (`/`, `/gauzy`, `?x`), else null. */
	path: string | null;
}

/** Where a host is used: the rules that only matter in some setups read it. */
export interface IServerHostContext {
	/** The server's "Use SSL" setting is on. */
	sslEnabled?: boolean;
}

/**
 * A warning about a host that is saved as typed but may not work as expected. Add one to
 * {@link SERVER_HOST_WARNING_RULES} to check something new; the field shows every rule that applies.
 */
export interface IServerHostRule {
	/** i18n key of the message shown under the field. */
	message: string;
	applies(host: IParsedServerHost, context: IServerHostContext): boolean;
}

/** The result of {@link checkServerHost}. */
export interface IServerHostCheck {
	host: IParsedServerHost;
	/** False when the value cannot be saved. */
	valid: boolean;
	/** i18n key of the error shown when the value is not valid, else null. */
	error: string | null;
	/** i18n keys of the warnings that apply to a valid value. */
	warnings: string[];
}

const MESSAGES = 'TIMER_TRACKER.SETTINGS.SERVER_HOST';

/** i18n key of the error shown for a value that is neither an IP address nor a host name. */
export const SERVER_HOST_INVALID_MESSAGE = `${MESSAGES}.INVALID`;

/**
 * The warnings a valid host can get. None of them blocks saving: each describes a value that
 * works in some setups or that the server turns into a broken address.
 */
export const SERVER_HOST_WARNING_RULES: readonly IServerHostRule[] = [
	{
		// Certificates are normally issued for a name; one that lists the IP address (an IP SAN) still
		// works, so this is a hint, not an error (#7549). An empty host means the default, 0.0.0.0.
		message: `${MESSAGES}.SSL_WITH_IP`,
		applies: ({ kind }, { sslEnabled }) => !!sslEnabled && (kind === 'ipv4' || kind === 'ipv6' || kind === 'empty')
	},
	{
		// With LAN access on, the API and the web UI listen on 0.0.0.0, which accepts IPv4 connections
		// only (see REACHABLE_SERVER_ADDRESS_FAMILIES): other computers cannot use an IPv6 address.
		message: `${MESSAGES}.IPV6`,
		applies: ({ kind }) => kind === 'ipv6'
	},
	{
		// The API and web UI ports are separate settings, added after the host.
		message: `${MESSAGES}.PORT`,
		applies: ({ port }) => port !== null
	},
	{
		// The port is added after the whole value, so a path ends up before it.
		message: `${MESSAGES}.PATH`,
		applies: ({ path }) => path !== null
	}
];

const SCHEME_PATTERN = /^([a-z][a-z\d+.-]*):\/\//i;
const HTTP_SCHEME_PATTERN = /^https?:\/\//i;
/** A decimal IPv4 octet without a leading zero, which would make it octal to browsers (`020` is 16). */
const IPV4_OCTET_PATTERN = /^(?:0|[1-9]\d{0,2})$/;
/** An IPv4 octet with a leading zero (`07`, `020`, `099`). */
const IPV4_ZERO_PADDED_OCTET_PATTERN = /^0\d{1,2}$/;
const IPV6_GROUP_PATTERN = /^[\da-f]{1,4}$/i;
const IPV6_ZONE_PATTERN = /^[\w.-]+$/;
/** Printable ASCII: a name made of it needs no conversion to be used as a URL host. */
const ASCII_PATTERN = /^[!-~]*$/;
/** A DNS label in its ASCII form: letters, digits, `_` and inner `-` (`xn--` for internationalised names). */
const HOSTNAME_LABEL_PATTERN = /^[a-z\d_](?:[a-z\d_-]{0,61}[a-z\d_])?$/i;

/**
 * Reads a "Server Hostname / IP Address" value: an optional `http://` or `https://`, a host (IPv4,
 * IPv6 with or without brackets, or a name), an optional port and anything after it. Spaces around
 * the value are ignored, as {@link normalizeServerHost} removes them before saving.
 */
export function parseServerHost(value: unknown): IParsedServerHost {
	const text = typeof value === 'string' ? value.trim() : '';
	const parsed: IParsedServerHost = {
		kind: 'invalid',
		scheme: null,
		hostname: null,
		bracketed: false,
		port: null,
		path: null
	};
	if (!text) {
		return { ...parsed, kind: 'empty' };
	}
	if (/\s/.test(text)) {
		return parsed;
	}

	let rest = text;
	const scheme = SCHEME_PATTERN.exec(text);
	if (scheme) {
		parsed.scheme = scheme[1].toLowerCase();
		if (parsed.scheme !== 'http' && parsed.scheme !== 'https') {
			return parsed;
		}
		rest = text.slice(scheme[0].length);
	}

	const pathStart = rest.search(/[/?#]/);
	const authority = pathStart < 0 ? rest : rest.slice(0, pathStart);
	parsed.path = pathStart < 0 ? null : rest.slice(pathStart);
	// Credentials (`user:pass@host`) are not a host, and browsers refuse URLs that carry them.
	if (!authority || authority.includes('@')) {
		return parsed;
	}

	const host = splitHostAndPort(authority);
	if (!host || (host.port !== null && !isPort(host.port))) {
		return parsed;
	}
	parsed.port = host.port;
	parsed.bracketed = host.bracketed;

	const kind = host.ipv6 ? (isIPv6(host.hostname) ? 'ipv6' : 'invalid') : classifyName(host.hostname);
	if (kind === 'invalid') {
		return parsed;
	}
	return { ...parsed, kind, hostname: host.hostname };
}

/**
 * Checks a "Server Hostname / IP Address" value: whether it can be saved, the error to show when not,
 * and the warnings ({@link SERVER_HOST_WARNING_RULES}) that apply when it can.
 */
export function checkServerHost(
	value: unknown,
	context: IServerHostContext = {},
	rules: readonly IServerHostRule[] = SERVER_HOST_WARNING_RULES
): IServerHostCheck {
	const host = parseServerHost(value);
	if (host.kind === 'invalid') {
		return { host, valid: false, error: SERVER_HOST_INVALID_MESSAGE, warnings: [] };
	}
	return {
		host,
		valid: true,
		error: null,
		warnings: rules.filter((rule) => rule.applies(host, context)).map(({ message }) => message)
	};
}

/**
 * Whether a host setting can be saved. Every value the server can use is accepted, including an empty
 * one (the default, `0.0.0.0`), `127.0.0.1`, LAN and IPv6 addresses, `localhost` and names, with or
 * without `http(s)://` and a port.
 */
export function isValidServerHost(value: unknown): boolean {
	return parseServerHost(value).kind !== 'invalid';
}

/** The value to save: spaces around a host would end up in the server's URLs. */
export function normalizeServerHost(value: string | null | undefined): string | null | undefined {
	return typeof value === 'string' ? value.trim() : value;
}

/**
 * The address families other computers can reach Gauzy Server and Gauzy API Server on. With LAN access
 * on, the API and the web UI listen on `0.0.0.0` (`resolveDesktopListenHost` in desktop-lib), which
 * accepts IPv4 connections only, so an IPv6 address is not offered for the host field.
 */
export const REACHABLE_SERVER_ADDRESS_FAMILIES: readonly IDesktopNetworkAddress['family'][] = ['IPv4'];

/** The detected addresses worth offering for the host field, best first. */
export function reachableServerAddresses<T extends Pick<IDesktopNetworkAddress, 'family'>>(
	addresses: readonly T[],
	families: readonly IDesktopNetworkAddress['family'][] = REACHABLE_SERVER_ADDRESS_FAMILIES
): T[] {
	return addresses.filter(({ family }) => families.includes(family));
}

/** How a detected address is written in the host field: an IPv6 address in square brackets. */
export function toServerHostAddress({ address, family }: Pick<IDesktopNetworkAddress, 'address' | 'family'>): string {
	return family === 'IPv6' ? `[${address}]` : address;
}

/**
 * The host field after picking a detected address: the address, keeping an `http://` or `https://`
 * the field started with. A port or path that was typed is dropped (see {@link SERVER_HOST_WARNING_RULES}).
 */
export function withDetectedAddress(
	current: unknown,
	address: Pick<IDesktopNetworkAddress, 'address' | 'family'>
): string {
	const scheme = typeof current === 'string' ? (HTTP_SCHEME_PATTERN.exec(current.trim())?.[0] ?? '') : '';
	return `${scheme.toLowerCase()}${toServerHostAddress(address)}`;
}

/** Splits `host`, `host:port`, `[v6]`, `[v6]:port` or a bare IPv6 address. Null when malformed. */
function splitHostAndPort(
	authority: string
): { hostname: string; port: string | null; bracketed: boolean; ipv6: boolean } | null {
	if (authority.startsWith('[')) {
		const end = authority.indexOf(']');
		const after = authority.slice(end + 1);
		if (end < 0 || (after && !after.startsWith(':'))) {
			return null;
		}
		return { hostname: authority.slice(1, end), port: after ? after.slice(1) : null, bracketed: true, ipv6: true };
	}
	const colons = authority.split(':').length - 1;
	if (colons > 1) {
		// More than one colon without brackets can only be an IPv6 address (which then has no port).
		return { hostname: authority, port: null, bracketed: false, ipv6: true };
	}
	const [hostname, port = null] = authority.split(':');
	return { hostname, port, bracketed: false, ipv6: false };
}

function isPort(port: string): boolean {
	return /^\d{1,5}$/.test(port) && Number(port) >= 1 && Number(port) <= 65535;
}

function classifyName(hostname: string): 'ipv4' | 'hostname' | 'invalid' {
	const ascii = toAsciiName(hostname);
	if (ascii === null) {
		return 'invalid';
	}
	if (isIPv4(ascii)) {
		return 'ipv4';
	}
	return isHostName(ascii) ? 'hostname' : 'invalid';
}

/**
 * A name as a URL host holds it. An internationalised name (`bücher.example`) becomes its punycode
 * form (`xn--bcher-kva.example`), with the mappings browsers apply (fullwidth letters, digits, dots).
 * Null when browsers refuse it as a host, such as `bad／host`, whose fullwidth slash maps to `/`.
 * An ASCII name is returned as it is: the URL parser would also turn `192.168.1` into an address.
 */
function toAsciiName(name: string): string | null {
	if (ASCII_PATTERN.test(name)) {
		return name;
	}
	try {
		return new URL(`http://${name}`).hostname;
	} catch {
		return null;
	}
}

/**
 * Four octets of 0 to 255. Browsers read an octet with a leading zero as octal (`192.168.1.020` is
 * `192.168.1.16`, `192.168.1.099` is refused), so one is only accepted where both readings agree
 * (`192.168.001.001`), and never in the IPv4 tail of an IPv6 address, which browsers refuse.
 */
function isIPv4(value: string, { zeroPadded = true }: { zeroPadded?: boolean } = {}): boolean {
	const octets = value.split('.');
	return (
		octets.length === 4 &&
		octets.every((octet) =>
			IPV4_OCTET_PATTERN.test(octet)
				? Number(octet) <= 255
				: zeroPadded && IPV4_ZERO_PADDED_OCTET_PATTERN.test(octet) && Number(octet) < 8
		)
	);
}

/** An IPv6 address, `::` shorthand, an IPv4 tail (`::ffff:192.168.1.20`) and a zone (`%eth0`) allowed. */
function isIPv6(value: string): boolean {
	const [address, zone, ...extra] = value.split('%');
	if (extra.length || (zone !== undefined && !IPV6_ZONE_PATTERN.test(zone))) {
		return false;
	}
	let groups = address;
	const lastColon = address.lastIndexOf(':');
	const tail = address.slice(lastColon + 1);
	if (lastColon >= 0 && tail.includes('.')) {
		if (!isIPv4(tail, { zeroPadded: false })) {
			return false;
		}
		// An IPv4 tail takes the place of the last two 16-bit groups.
		groups = `${address.slice(0, lastColon + 1)}0:0`;
	}

	const halves = groups.split('::');
	if (halves.length > 2) {
		return false;
	}
	const toGroups = (part: string): string[] => (part === '' ? [] : part.split(':'));
	const all = halves.flatMap(toGroups);
	if (!all.every((group) => IPV6_GROUP_PATTERN.test(group))) {
		return false;
	}
	return halves.length === 2 ? all.length <= 7 : all.length === 8;
}

/**
 * A host name in its ASCII form ({@link toAsciiName}): labels of letters, digits, `_` and inner `-`
 * (underscores are accepted, as internal names use them). A name whose last label is a number is not
 * one: browsers read it as an IPv4 address (`192.168.1`, `999.1.1.1`, `192.168.1.020`).
 */
function isHostName(value: string): boolean {
	const name = value.endsWith('.') ? value.slice(0, -1) : value;
	if (!name || name.length > 253) {
		return false;
	}
	const labels = name.split('.');
	if (/^\d+$/.test(labels[labels.length - 1])) {
		return false;
	}
	return labels.every((label) => HOSTNAME_LABEL_PATTERN.test(label));
}
