import type { IncomingHttpHeaders } from 'node:http';

/**
 * Whether a request comes from this machine, and from nothing but this machine.
 *
 * The GAUZY_AUTO_LOGIN account is the login of whoever runs the server: a caller with no login of its own may act as
 * that account over HTTP and WebSocket only when it is that person, on the same machine. Anyone else who can reach the
 * port — another host on the network, a public deployment, a reverse proxy in front of it — logs in with their own
 * credentials (the `login` tool).
 *
 * All of these must hold:
 * - the connection comes from a loopback address (the socket's own address: forwarding headers can be forged);
 * - no proxy relayed it (a proxy on the same machine connects from loopback on behalf of a remote client);
 * - the Host header names a loopback host, so a page whose DNS name was rebound to 127.0.0.1 is refused;
 * - a browser page, when one sent it, was served from a loopback origin.
 *
 * @param remoteAddress The socket's remote address.
 * @param headers The request headers.
 * @param trustedProxies The proxies the transport is configured to trust: a request from one of them was relayed.
 */
export function isLocalCaller(
	remoteAddress: string | undefined,
	headers: IncomingHttpHeaders,
	trustedProxies: readonly string[] = []
): boolean {
	if (!isLoopbackAddress(remoteAddress)) {
		return false;
	}
	if (trustedProxies.some((proxy) => normalizeAddress(proxy) === normalizeAddress(remoteAddress))) {
		return false;
	}
	if (FORWARDING_HEADERS.some((name) => headers[name] !== undefined)) {
		return false;
	}
	if (!isLoopbackHost(headers.host)) {
		return false;
	}

	const origin = headers.origin;
	if (origin === undefined) {
		return true;
	}
	try {
		return isLoopbackHost(new URL(origin).host);
	} catch {
		// `null` (a sandboxed or file page) and anything unparsable is not a page of this machine
		return false;
	}
}

/** Headers a proxy adds when it relays a request */
const FORWARDING_HEADERS = ['forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-real-ip'] as const;

function normalizeAddress(address = ''): string {
	return address.startsWith('::ffff:') ? address.substring(7) : address;
}

/**
 * Whether an IP address is a loopback address (127.0.0.0/8 or ::1, IPv4-mapped included)
 */
export function isLoopbackAddress(address: string | undefined): boolean {
	const ip = normalizeAddress(address);
	return ip === '::1' || /^127(?:\.\d{1,3}){3}$/.test(ip);
}

/**
 * Whether a Host header (`name[:port]`) names this machine: `localhost` or a loopback address
 */
export function isLoopbackHost(host: string | undefined): boolean {
	// Only `name[:port]`: user info, a path or a query would let `new URL()` read a different host than the header names
	if (!host || /[@/\\?#]/.test(host)) {
		return false;
	}
	let hostname: string;
	try {
		hostname = new URL(`http://${host}`).hostname;
	} catch {
		return false;
	}
	if (hostname.startsWith('[') && hostname.endsWith(']')) {
		hostname = hostname.slice(1, -1);
	}
	return hostname === 'localhost' || isLoopbackAddress(hostname);
}
