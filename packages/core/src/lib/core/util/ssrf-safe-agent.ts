import * as https from 'https';
import * as dns from 'dns';
import type { LookupFunction } from 'net';
import { isPrivateOrLoopbackHost } from '@gauzy/utils';

/**
 * Creates an HTTPS agent whose DNS resolver rejects any hostname that resolves to a private,
 * loopback or link-local address.
 *
 * Validating the RESOLVED IP at connection time — not just the URL literal — is what closes
 * DNS-rebinding / hostname-based SSRF: a public-looking hostname that resolves to an internal
 * address is refused before the socket connects, with no time-of-check/time-of-use gap. Use it
 * alongside a URL-level check (see `getUnsafeOutboundUrlReason` in `@gauzy/utils`) and
 * `maxRedirects: 0`, since a 30x to an internal host would otherwise be followed by the default
 * agent (GHSA-534m-c6mh-mp98, GHSA-6gg6-vv4f-2x74).
 *
 * Lives in `@gauzy/core` rather than `@gauzy/utils` because it depends on the Node `https`/`dns`
 * built-ins: `@gauzy/utils` is reachable from browser bundles, which those imports would break.
 * The pure URL predicates stay in `@gauzy/utils` and are safe to share with the web app.
 *
 * @returns An `https.Agent` that blocks connections to non-public addresses.
 */
export function createSsrfSafeHttpsAgent(): https.Agent {
	const lookup: LookupFunction = (hostname, options, callback) => {
		dns.lookup(
			hostname,
			options as dns.LookupAllOptions,
			(err: NodeJS.ErrnoException | null, address: any, family: any) => {
				if (err) {
					return (callback as any)(err, address, family);
				}
				// `address` is a string when `options.all` is falsy, or an array of { address, family } otherwise.
				const candidates: string[] = Array.isArray(address) ? address.map((entry) => entry.address) : [address];
				const blocked = candidates.find((ip) => isPrivateOrLoopbackHost(ip));
				if (blocked) {
					const error = Object.assign(
						new Error(`SSRF blocked: ${hostname} resolved to a non-public address (${blocked})`),
						{ code: 'ESSRFBLOCKED' }
					);
					return (callback as any)(error, address, family);
				}
				return (callback as any)(null, address, family);
			}
		);
	};
	return new https.Agent({ lookup });
}
