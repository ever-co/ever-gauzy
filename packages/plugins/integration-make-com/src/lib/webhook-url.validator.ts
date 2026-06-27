import * as https from 'https';
import * as dns from 'dns';
import type { LookupFunction } from 'net';
import { BadRequestException } from '@nestjs/common';
import { getUnsafeOutboundUrlReason, isPrivateOrLoopbackHost } from '@gauzy/utils';

/**
 * Validates a tenant-supplied Make.com webhook URL against the SSRF egress guard.
 *
 * Throws a {@link BadRequestException} if the URL targets a loopback / private / link-local host
 * (incl. the cloud-metadata IP `169.254.169.254`), uses a non-HTTPS scheme, contains embedded
 * credentials, or is otherwise malformed. Applied both when the URL is stored and again before each
 * outbound request, so values stored before this guard existed are also rejected
 * (GHSA-534m-c6mh-mp98).
 *
 * @param url - The webhook URL to validate.
 */
export function assertSafeMakeWebhookUrl(url: string): void {
	const reason = getUnsafeOutboundUrlReason(url);
	if (reason) {
		throw new BadRequestException(`Invalid webhook URL: ${reason}`);
	}
}

/**
 * Creates an HTTPS agent whose DNS resolver rejects any hostname that resolves to a private,
 * loopback or link-local address.
 *
 * Validating the RESOLVED IP at connection time (not just the URL literal) closes DNS-rebinding /
 * hostname-based SSRF: a public-looking hostname that resolves to an internal IP is refused before
 * the socket connects, with no time-of-check/time-of-use gap (GHSA-534m-c6mh-mp98).
 *
 * @returns An `https.Agent` that blocks connections to non-public addresses.
 */
export function createSsrfSafeHttpsAgent(): https.Agent {
	const lookup: LookupFunction = (hostname, options, callback) => {
		dns.lookup(hostname, options as dns.LookupAllOptions, (err: NodeJS.ErrnoException | null, address: any, family: any) => {
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
		});
	};
	return new https.Agent({ lookup });
}
