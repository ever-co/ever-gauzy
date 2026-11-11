// cspell:ignore EEGRESSBLOCKED
import { lookup as dnsLookup } from 'node:dns';
import type { LookupAddress } from 'node:dns';
import * as http from 'node:http';
import * as https from 'node:https';
import { isIP } from 'node:net';
import type { LookupFunction } from 'node:net';
import type { Readable } from 'node:stream';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import { isPublicAddress, isRefusedHostname } from './egress-address';

/**
 * The SSRF guard of the chat plugin's outbound requests: link previews today, the incoming webhooks' interaction
 * callbacks next. Any request the server makes for someone else's input goes through it.
 *
 * - **The URL first**, before any lookup (`egressTargetRefusal`): an allowed scheme, no credentials, an allowed port,
 *   no host name that never names a public site (`isRefusedHostname`), and no address literal that is not public.
 * - **Then every address the host resolves to** must be allowed (`resolveAllowedAddresses`). One private answer among
 *   public ones refuses the host, since the connection could pick it.
 * - **The connection uses exactly those addresses** (`pinnedLookup`): the request resolves through a `lookup` that
 *   answers the judged addresses and nothing else. A name that answers public to the check and private a moment
 *   later (DNS rebinding) is never looked up a second time. No socket is pooled, since a reused one would skip the
 *   check.
 * - **One hop**: `guardedRequest` never follows a redirect. A caller that follows one calls it again for the new URL,
 *   which is judged the same way.
 * - **Bounded reads** (`readLimitedBody`): at most `maxBytes`, counted before and after decompression, so a small
 *   compressed answer cannot grow without limit.
 *
 * Node's `dns`, `http` and `https` live here, in a server plugin, never in `@gauzy/utils`, which browser bundles reach.
 */

/** What a request may reach. The defaults are the ones the server uses; specs narrow them to reach a local server. */
export interface IEgressPolicy {
	/** Whether an address the host is (or resolves to) may be connected to. */
	isAllowedAddress: (address: string) => boolean;
	/** The ports that may be connected to (the scheme's default when the URL names none). */
	allowedPorts: readonly number[];
	/** The schemes that may be requested, with their colon (`https:`). */
	allowedProtocols: readonly string[];
}

/** The web's ports: anything else is not a web page or a web callback. */
export const EGRESS_WEB_PORTS: readonly number[] = [80, 443, 8080, 8443];

export const DEFAULT_EGRESS_POLICY: IEgressPolicy = {
	isAllowedAddress: isPublicAddress,
	allowedPorts: EGRESS_WEB_PORTS,
	allowedProtocols: ['http:', 'https:']
};

/** A request the guard refused. Its message names neither the host nor an address (it can reach the asker). */
export class EgressBlockedError extends Error {
	readonly code = 'EEGRESSBLOCKED';

	constructor(readonly reason: EgressRefusal) {
		super('The outbound request was refused: its target is not a public address.');
		this.name = 'EgressBlockedError';
	}
}

/** An answer in a content encoding `readLimitedBody` does not read. */
export class EgressEncodingError extends Error {
	constructor() {
		super('The answer is in a content encoding that is not read.');
		this.name = 'EgressEncodingError';
	}
}

/** Why a target was refused. */
export type EgressRefusal = 'scheme' | 'credentials' | 'port' | 'hostname' | 'address';

/** Resolves a host name to its addresses. A seam: specs answer without a network. */
export type EgressResolver = (hostname: string) => Promise<string[]>;

/** Every address of a host, as the operating system's resolver answers (`dns.lookup`). */
export const systemResolver: EgressResolver = (hostname) =>
	new Promise<string[]>((resolve, reject) => {
		dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
			if (error) return reject(error);
			resolve((addresses ?? []).map((entry) => entry.address));
		});
	});

/** A URL's host as a connection names it: an IPv6 literal without its brackets. */
export function bareHostname(url: URL): string {
	return url.hostname.replace(/^\[|\]$/g, '');
}

/** The port a URL connects to (its scheme's default when it names none). */
export function portOf(url: URL): number {
	if (url.port) return Number(url.port);
	return url.protocol === 'https:' ? 443 : 80;
}

/**
 * Why a request may not go to this URL, judged on the URL alone (before any lookup), or null. A host name that passes
 * is still resolved, and every address it resolves to is judged (`resolveAllowedAddresses`).
 */
export function egressTargetRefusal(url: URL, policy: IEgressPolicy = DEFAULT_EGRESS_POLICY): EgressRefusal | null {
	if (!policy.allowedProtocols.includes(url.protocol)) return 'scheme';
	if (url.username || url.password) return 'credentials';
	if (!policy.allowedPorts.includes(portOf(url))) return 'port';
	const host = bareHostname(url);
	if (isIP(host)) return policy.isAllowedAddress(host) ? null : 'address';
	return isRefusedHostname(host) ? 'hostname' : null;
}

/**
 * The addresses a request to this URL connects to: an address literal as it is (after `egressTargetRefusal`), and for
 * a host name every address it resolves to, when every one of them is allowed.
 *
 * @throws EgressBlockedError when the URL is refused, or any address is not allowed (or not an address at all).
 */
export async function resolveAllowedAddresses(
	url: URL,
	options: { resolver?: EgressResolver; policy?: IEgressPolicy; signal?: AbortSignal } = {}
): Promise<LookupAddress[]> {
	const policy = options.policy ?? DEFAULT_EGRESS_POLICY;
	const refusal = egressTargetRefusal(url, policy);
	if (refusal) throw new EgressBlockedError(refusal);
	const host = bareHostname(url);
	const literal = isIP(host);
	if (literal) return [{ address: host, family: literal }];
	const resolution = (options.resolver ?? systemResolver)(host);
	const answers = options.signal ? await abortable(resolution, options.signal) : await resolution;
	if (!answers?.length) {
		throw Object.assign(new Error('The host of the outbound request has no address.'), { code: 'ENOTFOUND' });
	}
	const entries = answers.map((address) => ({ address, family: isIP(address) }));
	if (entries.some((entry) => entry.family === 0 || !policy.isAllowedAddress(entry.address))) {
		throw new EgressBlockedError('address');
	}
	return entries;
}

/** A `lookup` that answers the addresses already judged, and never resolves anything itself. */
export function pinnedLookup(addresses: readonly LookupAddress[]): LookupFunction {
	return (_hostname, lookupOptions, callback) => {
		const done = callback as (error: NodeJS.ErrnoException | null, address?: string | LookupAddress[], family?: number) => void;
		const family = lookupOptions.family;
		const wanted = family === 4 || family === 'IPv4' ? 4 : family === 6 || family === 'IPv6' ? 6 : 0;
		const usable = wanted ? addresses.filter((entry) => entry.family === wanted) : [...addresses];
		process.nextTick(() => {
			if (!usable.length) {
				done(Object.assign(new Error('getaddrinfo ENOTFOUND'), { code: 'ENOTFOUND' }));
			} else if (lookupOptions.all) {
				done(null, usable);
			} else {
				done(null, usable[0].address, usable[0].family);
			}
		});
	};
}

export interface IGuardedRequestOptions {
	method?: string;
	headers?: http.OutgoingHttpHeaders;
	/** Sent as the request body (set `content-type` in `headers`). */
	body?: string | Buffer;
	/** Aborts the request (and the lookup before it): the caller's deadline. */
	signal?: AbortSignal;
	resolver?: EgressResolver;
	policy?: IEgressPolicy;
	maxHeaderSize?: number;
}

/**
 * One request through the guard: the URL judged, its host's addresses judged, the connection pinned to them. No
 * redirect is followed, and no cookie, credential or referrer is added: only what the caller passes. Answers the
 * response once its headers arrived. The caller reads the body (`readLimitedBody`) or destroys it.
 *
 * @throws EgressBlockedError when the target is refused; the request's own error (an abort included) otherwise.
 */
export async function guardedRequest(url: URL, options: IGuardedRequestOptions = {}): Promise<http.IncomingMessage> {
	const addresses = await resolveAllowedAddresses(url, options);
	return new Promise<http.IncomingMessage>((resolve, reject) => {
		const client = url.protocol === 'https:' ? https : http;
		const request = client.request({
			protocol: url.protocol,
			hostname: bareHostname(url),
			port: portOf(url),
			path: `${url.pathname}${url.search}`,
			method: options.method ?? 'GET',
			headers: options.headers,
			// No pooled socket: each connection goes through the pinned lookup.
			agent: false,
			lookup: pinnedLookup(addresses),
			signal: options.signal,
			maxHeaderSize: options.maxHeaderSize ?? 16 * 1024
		});
		request.on('response', (response) => {
			// A response torn down by the caller's deadline emits an error nobody else listens to.
			response.on('error', () => undefined);
			resolve(response);
		});
		// Kept for the life of the request: an error after the promise settled is dropped here, never thrown.
		request.on('error', reject);
		request.end(options.body);
	});
}

/** How a body read ended: the answer's own end, the byte limit, the caller's `stop`, or a broken stream. */
export type BodyReadEnd = 'end' | 'limit' | 'stop' | 'error';

/**
 * The body of a response, decompressed when it is gzip, deflate or brotli, at most `maxBytes` (counted before and after
 * decompression), and no further than `stop` says (it is given each piece read, in order, once decompressed). The
 * connection is closed as soon as that is read. Answers the bytes and how the read ended: a read that broke off after
 * some bytes keeps them (`error`), so a caller that needs the whole body checks for `end`.
 *
 * @throws EgressEncodingError for another content encoding; the signal's reason when it aborts first; the stream's
 * error when it broke before any byte.
 */
export function readBody(
	response: http.IncomingMessage,
	options: { maxBytes: number; signal?: AbortSignal; stop?: (piece: Buffer) => boolean }
): Promise<{ body: Buffer; end: BodyReadEnd }> {
	const { maxBytes, signal, stop } = options;
	const encoding = String(firstHeaderValue(response.headers['content-encoding']) ?? '').trim().toLowerCase();
	let stream: Readable = response;
	if (encoding === 'gzip' || encoding === 'x-gzip') stream = response.pipe(createGunzip());
	else if (encoding === 'deflate') stream = response.pipe(createInflate());
	else if (encoding === 'br') stream = response.pipe(createBrotliDecompress());
	else if (encoding && encoding !== 'identity') {
		response.destroy();
		return Promise.reject(new EgressEncodingError());
	}
	return new Promise<{ body: Buffer; end: BodyReadEnd }>((resolve, reject) => {
		const chunks: Buffer[] = [];
		let total = 0;
		let raw = 0;
		let settled = false;
		const close = () => {
			settled = true;
			signal?.removeEventListener('abort', onAbort);
			if (stream !== response) stream.destroy();
			response.destroy();
		};
		const finish = (end: BodyReadEnd) => {
			if (settled) return;
			close();
			resolve({ body: Buffer.concat(chunks, total), end });
		};
		const fail = (error: unknown) => {
			if (settled) return;
			if (total > 0) return finish('error');
			close();
			reject(error);
		};
		const onAbort = () => {
			if (settled) return;
			close();
			reject(signal?.reason);
		};
		if (signal?.aborted) return onAbort();
		signal?.addEventListener('abort', onAbort, { once: true });
		if (stream !== response) {
			response.on('data', (chunk: Buffer) => {
				raw += chunk.length;
				if (raw >= maxBytes) finish('limit');
			});
			response.on('error', fail);
		}
		stream.on('data', (chunk: Buffer) => {
			if (settled) return;
			const piece = chunk.length > maxBytes - total ? chunk.subarray(0, maxBytes - total) : chunk;
			chunks.push(piece);
			total += piece.length;
			if (total >= maxBytes) finish('limit');
			else if (stop && stop(piece)) finish('stop');
		});
		stream.on('end', () => finish('end'));
		stream.on('error', fail);
	});
}

/** `readBody`, the bytes only: what a caller that may use the start of a body reads (a page's head). */
export async function readLimitedBody(
	response: http.IncomingMessage,
	options: { maxBytes: number; signal?: AbortSignal; stop?: (piece: Buffer) => boolean }
): Promise<Buffer> {
	return (await readBody(response, options)).body;
}

/** Waits for a promise, giving up as soon as the signal aborts (with its reason). */
export function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
	if (signal.aborted) return Promise.reject(signal.reason);
	return new Promise<T>((resolve, reject) => {
		const onAbort = () => reject(signal.reason);
		signal.addEventListener('abort', onAbort, { once: true });
		promise.then(
			(value) => {
				signal.removeEventListener('abort', onAbort);
				resolve(value);
			},
			(error) => {
				signal.removeEventListener('abort', onAbort);
				reject(error);
			}
		);
	});
}

/** A header's one value (the first, when it came more than once). */
export function firstHeaderValue(value: string | string[] | undefined): string | null {
	if (Array.isArray(value)) return value[0] ?? null;
	return value ?? null;
}
