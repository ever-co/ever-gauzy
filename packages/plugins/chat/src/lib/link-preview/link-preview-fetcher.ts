import { lookup as dnsLookup } from 'node:dns';
import type { LookupAddress } from 'node:dns';
import * as http from 'node:http';
import * as https from 'node:https';
import { isIP } from 'node:net';
import type { LookupFunction } from 'node:net';
import type { Readable } from 'node:stream';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import {
	CHAT_LINK_PREVIEW_MAX_BYTES,
	CHAT_LINK_PREVIEW_MAX_REDIRECTS,
	CHAT_LINK_PREVIEW_TIMEOUT_MS,
	CHAT_LINK_PREVIEW_USER_AGENT
} from './chat-link-preview.constants';
import { bareHostname, DEFAULT_LINK_PREVIEW_POLICY, ILinkPreviewTargetPolicy, portOf, previewTargetRefusal } from './link-preview-url';

/**
 * The fetch of a page to preview, with the egress guard every hop goes through.
 *
 * - **Per hop, before any socket**: the URL alone is judged (`previewTargetRefusal`: http(s), no credentials, the web's
 *   ports, no internal host name, no address literal that is not public); then the host name is resolved and EVERY
 *   address it resolves to must be public — one private answer among public ones refuses the host.
 * - **The connection uses exactly the addresses judged.** The request resolves through a `lookup` that answers the
 *   addresses of that check and nothing else, so a name that answers public to the check and private a moment later
 *   (DNS rebinding) is never looked up a second time. No connection is pooled (a reused socket would skip the check).
 * - **Redirects are followed by hand**, at most `maxRedirects`, each target judged like the first: a redirect to a
 *   private address, an internal name or a name that resolves privately is refused before it is connected to.
 * - **Bounded**: one deadline for the whole fetch (every hop), and at most `maxBytes` of the page read — compressed and
 *   decompressed both counted, so a small compressed answer cannot grow without limit — and the read stops at the end
 *   of the `<head>`, which is all a preview needs. Only an HTML answer is read.
 *
 * Nothing about the person asking goes out: no cookie, no credential, no referrer; a generic user agent.
 */

/** Why a fetch gave no page. The caller stores all of them as "no preview" and tells the asker nothing more. */
export type LinkPreviewFetchFailure = 'blocked' | 'redirects' | 'timeout' | 'status' | 'type' | 'error';

export type LinkPreviewFetchOutcome =
	| {
			ok: true;
			/** The URL the page was read from (the last hop). */
			url: string;
			/** The answer's media type (lower case), when it named one. */
			contentType: string | null;
			/** The charset the answer's `Content-Type` named, when it named one. */
			charset: string | null;
			/** The start of the page, at most `maxBytes`, up to the end of its `<head>`. */
			body: Buffer;
	  }
	| { ok: false; reason: LinkPreviewFetchFailure };

/** Resolves a host name to its addresses. A seam: specs answer without a network. */
export type LinkPreviewResolver = (hostname: string) => Promise<string[]>;

export interface ILinkPreviewFetchOptions {
	timeoutMs: number;
	maxRedirects: number;
	maxBytes: number;
	userAgent: string;
	resolver: LinkPreviewResolver;
	/** What a hop may reach. The server always uses the default; specs narrow it to reach their own local server. */
	policy: ILinkPreviewTargetPolicy;
}

/** Every address of a host, as the operating system's resolver answers (`dns.lookup`). */
export const systemResolver: LinkPreviewResolver = (hostname) =>
	new Promise<string[]>((resolve, reject) => {
		dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
			if (error) return reject(error);
			resolve((addresses ?? []).map((entry) => entry.address));
		});
	});

export const DEFAULT_LINK_PREVIEW_FETCH_OPTIONS: ILinkPreviewFetchOptions = {
	timeoutMs: CHAT_LINK_PREVIEW_TIMEOUT_MS,
	maxRedirects: CHAT_LINK_PREVIEW_MAX_REDIRECTS,
	maxBytes: CHAT_LINK_PREVIEW_MAX_BYTES,
	userAgent: CHAT_LINK_PREVIEW_USER_AGENT,
	resolver: systemResolver,
	policy: DEFAULT_LINK_PREVIEW_POLICY
};

/** A hop the guard refused. */
class LinkPreviewBlockedError extends Error {
	readonly code = 'ELINKPREVIEWBLOCKED';
}

/** An answer of a type (or an encoding) that is not an HTML page. */
class LinkPreviewTypeError extends Error {}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const HTML_TYPES = new Set(['text/html', 'application/xhtml+xml']);
/** Where the `<head>` of a page has ended: its closing tag, or the start of the body. */
const HEAD_END = /<\/head\s*>|<body[\s>/]/i;

/**
 * Fetches the start of a page to preview, through the guard above.
 *
 * @param link An absolute http(s) URL (the caller normalized it).
 * @param overrides Bounds and seams; the server passes none.
 * @returns The page's start, or why there is none. Never throws.
 */
export async function fetchPreviewPage(link: string | URL, overrides: Partial<ILinkPreviewFetchOptions> = {}): Promise<LinkPreviewFetchOutcome> {
	const options: ILinkPreviewFetchOptions = { ...DEFAULT_LINK_PREVIEW_FETCH_OPTIONS, ...overrides };
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), options.timeoutMs);
	timer.unref?.();
	try {
		let current = new URL(String(link));
		current.hash = '';
		for (let hop = 0; ; hop++) {
			if (previewTargetRefusal(current, options.policy)) return { ok: false, reason: 'blocked' };
			const addresses = await resolveAllowed(current, options, controller.signal);
			const response = await send(current, addresses, options, controller.signal);
			const status = response.statusCode ?? 0;
			if (REDIRECT_STATUSES.has(status)) {
				const location = single(response.headers.location);
				response.destroy();
				if (!location) return { ok: false, reason: 'status' };
				if (hop >= options.maxRedirects) return { ok: false, reason: 'redirects' };
				const next = new URL(location, current);
				next.hash = '';
				current = next;
				continue;
			}
			if (status < 200 || status >= 300) {
				response.destroy();
				return { ok: false, reason: 'status' };
			}
			const contentType = single(response.headers['content-type']);
			const mediaType = contentType ? contentType.split(';')[0].trim().toLowerCase() : null;
			if (mediaType && !HTML_TYPES.has(mediaType)) {
				response.destroy();
				return { ok: false, reason: 'type' };
			}
			const body = await readHead(response, options.maxBytes, controller.signal);
			return { ok: true, url: current.href, contentType: mediaType, charset: charsetOf(contentType), body };
		}
	} catch (error) {
		if (controller.signal.aborted) return { ok: false, reason: 'timeout' };
		if (error instanceof LinkPreviewBlockedError) return { ok: false, reason: 'blocked' };
		if (error instanceof LinkPreviewTypeError) return { ok: false, reason: 'type' };
		return { ok: false, reason: 'error' };
	} finally {
		clearTimeout(timer);
		// Tears down whatever is still open (nothing, on every path that returns normally).
		controller.abort();
	}
}

/**
 * The addresses a hop connects to: an address literal as it is (the URL check judged it), a host name's every address
 * when every one of them is allowed.
 *
 * @throws LinkPreviewBlockedError when any address is not allowed (or not an address at all).
 */
async function resolveAllowed(url: URL, options: ILinkPreviewFetchOptions, signal: AbortSignal): Promise<LookupAddress[]> {
	const host = bareHostname(url);
	const literal = isIP(host);
	if (literal) return [{ address: host, family: literal }];
	const answers = await abortable(options.resolver(host), signal);
	if (!answers?.length) throw new Error(`No address for the host of a link preview.`);
	const entries = answers.map((address) => ({ address, family: isIP(address) }));
	if (entries.some((entry) => entry.family === 0 || !options.policy.isAllowedAddress(entry.address))) {
		throw new LinkPreviewBlockedError('A link preview host resolves to an address that is not public.');
	}
	return entries;
}

/** One GET of a hop, connected to the judged addresses only; answers the response once its headers arrived. */
function send(url: URL, addresses: LookupAddress[], options: ILinkPreviewFetchOptions, signal: AbortSignal): Promise<http.IncomingMessage> {
	return new Promise<http.IncomingMessage>((resolve, reject) => {
		const client = url.protocol === 'https:' ? https : http;
		const request = client.request({
			protocol: url.protocol,
			hostname: bareHostname(url),
			port: portOf(url),
			path: `${url.pathname}${url.search}`,
			method: 'GET',
			headers: {
				'user-agent': options.userAgent,
				accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
				'accept-encoding': 'gzip, deflate, br'
			},
			// No pooled socket: each connection goes through the pinned lookup below.
			agent: false,
			lookup: pinnedLookup(addresses),
			signal,
			maxHeaderSize: 16 * 1024
		});
		request.on('response', (response) => {
			// A response torn down by the deadline emits an error nobody else listens to.
			response.on('error', () => undefined);
			resolve(response);
		});
		// Kept for the life of the request: an error after the promise settled is dropped here, never thrown.
		request.on('error', reject);
		request.end();
	});
}

/** A `lookup` that answers the addresses already judged, and never resolves anything itself. */
function pinnedLookup(addresses: LookupAddress[]): LookupFunction {
	return (_hostname, lookupOptions, callback) => {
		const done = callback as (error: NodeJS.ErrnoException | null, address?: string | LookupAddress[], family?: number) => void;
		const family = lookupOptions.family;
		const wanted = family === 4 || family === 'IPv4' ? 4 : family === 6 || family === 'IPv6' ? 6 : 0;
		const usable = wanted ? addresses.filter((entry) => entry.family === wanted) : addresses;
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

/**
 * The start of an HTML answer: decompressed when it is compressed, at most `maxBytes` (counted before and after
 * decompression), and no further than the end of its `<head>`. The connection is closed as soon as that is read. A
 * read that broke off after some bytes keeps them.
 *
 * @throws LinkPreviewTypeError for an encoding that is not gzip, deflate or brotli.
 */
function readHead(response: http.IncomingMessage, maxBytes: number, signal: AbortSignal): Promise<Buffer> {
	const encoding = (single(response.headers['content-encoding']) ?? '').trim().toLowerCase();
	let stream: Readable = response;
	if (encoding === 'gzip' || encoding === 'x-gzip') stream = response.pipe(createGunzip());
	else if (encoding === 'deflate') stream = response.pipe(createInflate());
	else if (encoding === 'br') stream = response.pipe(createBrotliDecompress());
	else if (encoding && encoding !== 'identity') {
		response.destroy();
		return Promise.reject(new LinkPreviewTypeError('An encoding a link preview does not read.'));
	}
	return new Promise<Buffer>((resolve, reject) => {
		const chunks: Buffer[] = [];
		let total = 0;
		let raw = 0;
		let tail = '';
		let settled = false;
		const close = () => {
			settled = true;
			signal.removeEventListener('abort', onAbort);
			if (stream !== response) stream.destroy();
			response.destroy();
		};
		const finish = () => {
			if (settled) return;
			close();
			resolve(Buffer.concat(chunks, total));
		};
		const fail = (error: unknown) => {
			if (settled) return;
			if (total > 0) return finish();
			close();
			reject(error);
		};
		const onAbort = () => {
			if (settled) return;
			close();
			reject(signal.reason);
		};
		signal.addEventListener('abort', onAbort, { once: true });
		if (stream !== response) {
			response.on('data', (chunk: Buffer) => {
				raw += chunk.length;
				if (raw >= maxBytes) finish();
			});
			response.on('error', fail);
		}
		stream.on('data', (chunk: Buffer) => {
			if (settled) return;
			const piece = chunk.length > maxBytes - total ? chunk.subarray(0, maxBytes - total) : chunk;
			chunks.push(piece);
			total += piece.length;
			const window = tail + piece.toString('latin1');
			tail = window.slice(-16);
			if (total >= maxBytes || HEAD_END.test(window)) finish();
		});
		stream.on('end', finish);
		stream.on('error', fail);
	});
}

/** Waits for a promise, giving up as soon as the signal aborts. */
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
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

/** The charset a `Content-Type` names, or null. */
export function charsetOf(contentType: string | null | undefined): string | null {
	const match = /;\s*charset\s*=\s*"?([^";\s]+)"?/i.exec(contentType ?? '');
	return match ? match[1].toLowerCase() : null;
}

/** A header's one value (the first, when it came more than once). */
function single(value: string | string[] | undefined): string | null {
	if (Array.isArray(value)) return value[0] ?? null;
	return value ?? null;
}
