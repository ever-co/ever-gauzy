import type { AddressInfo } from 'node:net';

/**
 * Environment variable that sets the Gauzy API the embedded Plane proxy calls, in the same form as
 * API_BASE_URL (e.g. `http://gauzy-api.gauzy.svc.cluster.local:3000`); an `/api` suffix is optional.
 * Unset, the proxy calls this API process over loopback.
 */
export const PLANE_PROXY_UPSTREAM_URL_ENV = 'PLANE_PROXY_UPSTREAM_URL';

/**
 * Resolve the Gauzy API base URL (with the `/api` prefix) the Plane proxy sends its calls to.
 *
 * The proxy is mounted on this API's own HTTP server, so by default it calls Gauzy over loopback on
 * the address that server listens on. Calling the public API_BASE_URL instead sends every proxied
 * call out of the host, through the CDN and back in: a public round trip per call, and a failure
 * whenever that egress path is down.
 *
 * @param address      `address()` of the HTTP server the proxy is mounted on.
 * @param override     The PLANE_PROXY_UPSTREAM_URL value; wins when set.
 * @param fallbackPort Port to dial when the server address is unknown (not listening yet, or a pipe).
 */
export function resolvePlaneProxyUpstreamUrl(
	address: AddressInfo | string | null,
	override: string | undefined,
	fallbackPort: number | string
): string {
	const explicit = override?.trim().replace(/\/+$/, '');
	if (explicit) {
		return explicit.endsWith('/api') ? explicit : `${explicit}/api`;
	}

	if (address && typeof address === 'object') {
		return `http://${dialHost(address.address)}:${address.port}/api`;
	}

	return `http://127.0.0.1:${fallbackPort}/api`;
}

/**
 * The host to dial for a server bound to `address`: a wildcard bind is reached on loopback.
 */
function dialHost(address: string): string {
	if (!address || address === '0.0.0.0') {
		return '127.0.0.1';
	}
	if (address === '::') {
		return '[::1]';
	}
	return address.includes(':') ? `[${address}]` : address;
}
