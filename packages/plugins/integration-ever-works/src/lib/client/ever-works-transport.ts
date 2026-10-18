// cspell:ignore EINSECURE ESSRF
import { lookup as dnsLookup, LookupAddress } from 'node:dns';
import { Agent as HttpAgent } from 'node:http';
import type { LookupFunction } from 'node:net';
import axios, { AxiosInstance } from 'axios';
import { createSsrfSafeHttpsAgent } from '@gauzy/core';
import { isEverWorksLoopbackUrl } from './ever-works-loopback';

/** One HTTP exchange with Ever Works, independent of the HTTP library. */
export interface EverWorksHttpRequest {
	method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
	url: string;
	headers: Record<string, string>;
	body?: unknown;
	timeoutMs: number;
}

export interface EverWorksHttpResponse {
	status: number;
	headers: Record<string, string>;
	data: unknown;
}

/**
 * Sends a request and resolves with ANY status (the client maps errors itself). Rejects only when no
 * response arrived (DNS, connection, TLS, timeout, size cap, an SSRF block).
 */
export interface EverWorksTransport {
	send(request: EverWorksHttpRequest): Promise<EverWorksHttpResponse>;
}

/**
 * The loopback client's DNS lookup: `localhost` must resolve to a loopback address (`127.0.0.1` or `::1`), so the
 * development switch can never be pointed at another host through a hosts-file or resolver entry.
 */
const loopbackOnlyLookup: LookupFunction = (hostname, options, callback) => {
	dnsLookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
		if (error) return callback(error, '', 0);
		const allowed = addresses.filter(({ address }) => address === '127.0.0.1' || address === '::1');
		if (!allowed.length || allowed.length !== addresses.length) {
			return callback(
				Object.assign(new Error('Ever Works loopback host does not resolve to a loopback address.'), {
					code: 'ESSRF'
				}),
				'',
				0
			);
		}
		if ((options as { all?: boolean }).all)
			return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, allowed);
		return callback(null, allowed[0].address, allowed[0].family);
	});
};

/** The largest response body read from Ever Works (plan 02 §4). */
export const EVER_WORKS_MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

/**
 * The production transport: HTTPS only through the SSRF-safe agent (every resolved address must be
 * public, checked at connect time, so DNS rebinding cannot reach an internal host), no redirects, no
 * proxy, a timeout and a 10 MiB response cap.
 *
 * With `allowLoopback` (the development-only `EVER_WORKS_ALLOW_LOOPBACK` switch) a loopback URL
 * (`localhost`, `127.0.0.1`, `[::1]`) is sent as well, over plain HTTP or HTTPS, through a separate
 * client: every other address still goes through the SSRF-safe agent.
 */
export class AxiosEverWorksTransport implements EverWorksTransport {
	private readonly http: AxiosInstance;
	private readonly loopback: AxiosInstance | null;

	constructor(options: { allowLoopback?: boolean } = {}) {
		this.http = AxiosEverWorksTransport.client({ httpsAgent: createSsrfSafeHttpsAgent() });
		this.loopback =
			options.allowLoopback === true
				? AxiosEverWorksTransport.client({ httpAgent: new HttpAgent({ lookup: loopbackOnlyLookup } as object) })
				: null;
	}

	private static client(agents: {
		httpAgent?: HttpAgent;
		httpsAgent?: ReturnType<typeof createSsrfSafeHttpsAgent>;
	}): AxiosInstance {
		return axios.create({
			...agents,
			maxRedirects: 0,
			proxy: false,
			maxContentLength: EVER_WORKS_MAX_RESPONSE_BYTES,
			maxBodyLength: EVER_WORKS_MAX_RESPONSE_BYTES,
			// Every status is a response; the client decides what an error is.
			validateStatus: () => true,
			responseType: 'json',
			transitional: { silentJSONParsing: true, forcedJSONParsing: true, clarifyTimeoutError: true }
		});
	}

	async send(request: EverWorksHttpRequest): Promise<EverWorksHttpResponse> {
		const loopback = this.loopback !== null && isEverWorksLoopbackUrl(request.url);
		if (!loopback && !request.url.startsWith('https://')) {
			// The URL was validated when it was stored; this is the last line, never reached in practice.
			throw Object.assign(new Error('Ever Works is reached over HTTPS only.'), { code: 'EINSECURE' });
		}
		const response = await (loopback ? this.loopback : this.http).request({
			method: request.method,
			url: request.url,
			headers: request.headers,
			data: request.body === undefined ? undefined : JSON.stringify(request.body),
			timeout: request.timeoutMs
		});
		const headers: Record<string, string> = {};
		for (const [key, value] of Object.entries(response.headers ?? {})) {
			if (value !== undefined && value !== null) headers[key.toLowerCase()] = String(value);
		}
		return { status: response.status, headers, data: response.data };
	}
}
