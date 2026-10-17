// cspell:ignore EINSECURE
import axios, { AxiosInstance } from 'axios';
import { createSsrfSafeHttpsAgent } from '@gauzy/core';

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

/** The largest response body read from Ever Works (plan 02 §4). */
export const EVER_WORKS_MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

/**
 * The production transport: HTTPS only through the SSRF-safe agent (every resolved address must be
 * public, checked at connect time, so DNS rebinding cannot reach an internal host), no redirects, no
 * proxy, a timeout and a 10 MiB response cap.
 */
export class AxiosEverWorksTransport implements EverWorksTransport {
	private readonly http: AxiosInstance;

	constructor() {
		this.http = axios.create({
			httpsAgent: createSsrfSafeHttpsAgent(),
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
		if (!request.url.startsWith('https://')) {
			// The URL was validated when it was stored; this is the last line, never reached in practice.
			throw Object.assign(new Error('Ever Works is reached over HTTPS only.'), { code: 'EINSECURE' });
		}
		const response = await this.http.request({
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
