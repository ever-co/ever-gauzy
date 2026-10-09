/**
 * A `fetch` over `node:http`/`node:https` whose every connection resolves its host through a
 * caller-supplied `lookup` — the transport half of the AI-provider SSRF guard.
 *
 * Why not the global `fetch`: undici resolves the host again, on its own, when it connects. The only
 * way to hand it a different resolver is a `Dispatcher` built from the `undici` package, which is not
 * a declared dependency of this plugin. `http.request` accepts a `lookup` directly, and Node connects
 * to exactly the addresses that callback returns — so a guard placed in the `lookup` judges the
 * answer the socket really uses, with no second resolution left to race.
 *
 * It is a faithful `fetch` for the requests this plugin makes (catalogue, speech, and the AI SDK's
 * chat and embedding calls), not a general-purpose replacement:
 *
 * - `(input: string | URL | Request, init?: RequestInit)`. The body is normalized by `new Request`,
 *   which also supplies the `content-type` fetch would send (a multipart boundary for `FormData`).
 *   Bodies of known length are buffered and sent with `content-length`; a caller's own
 *   `ReadableStream` is streamed chunked.
 * - `signal`: aborting destroys the connection and rejects with the signal's reason, as fetch does;
 *   an abort after the headers errors the body stream instead.
 * - The result is a real global `Response` whose body streams as bytes arrive, so server-sent events
 *   reach the AI SDK chunk by chunk. Status, status text and repeated headers are kept.
 * - `accept-encoding` is advertised as fetch advertises it, and gzip, zlib-format deflate and brotli
 *   bodies are decoded. Decoding is needed whatever is advertised (a proxy may compress anyway), so
 *   sending `identity` would buy nothing.
 * - Redirects: `follow` (at most 20; a 301/302 POST and a 303 become GET without the body; credentials
 *   are dropped on a cross-origin hop), `manual` (the 3xx is returned) and `error`. Every hop connects
 *   through the same `lookup` and is first passed to `beforeRedirect`.
 * - A connection that fails rejects with `TypeError('fetch failed')` carrying the cause, as fetch does.
 *
 * Connections are never pooled. A reused keep-alive socket skips the `lookup`, and a shared agent (Node's
 * global one) can hold a socket that unguarded code opened to the same host and port.
 */

import * as http from 'http';
import * as https from 'https';
import type { LookupFunction } from 'net';
import { Readable, Transform, pipeline } from 'stream';
import type { ReadableStream as NodeReadableStream } from 'stream/web';
import * as zlib from 'zlib';

// cspell:ignore brotli

export interface IFetchOverNodeHttpOptions {
	/** Resolves the host of EVERY connection the request opens, redirect hops included. */
	lookup: LookupFunction;
	/**
	 * Called with the absolute URL of each redirect hop before it is requested. Throw (or reject) to
	 * refuse the hop; the error is what the fetch rejects with.
	 */
	beforeRedirect?: (url: string, signal: AbortSignal) => Promise<void>;
}

/** Statuses fetch treats as redirects. */
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Statuses whose response never has a body (the `Response` constructor refuses one). */
const NULL_BODY_STATUSES = new Set([101, 103, 204, 205, 304]);

/** fetch's redirect limit. */
const MAX_REDIRECTS = 20;

/** More stacked content codings than this is a hostile response, not a real one. */
const MAX_CONTENT_CODINGS = 5;

/**
 * How long a connection may sit with no bytes moving before it is abandoned: undici's default
 * `headersTimeout` and `bodyTimeout`, so a stalled upstream is dropped exactly when fetch would drop it.
 */
const IDLE_TIMEOUT_MS = 300_000;

/** Headers describing a request body, removed when a redirect turns the request into a body-less GET. */
const REQUEST_BODY_HEADERS = [
	'content-encoding',
	'content-language',
	'content-location',
	'content-type',
	'content-length'
];

/** Credentials fetch removes when a redirect crosses to another origin. */
const CROSS_ORIGIN_STRIPPED_HEADERS = ['authorization', 'proxy-authorization', 'cookie', 'host'];

/** Flush settings undici decodes with, so a body is released as it arrives and a truncated one is not an error. */
const ZLIB_OPTIONS: zlib.ZlibOptions = { flush: zlib.constants.Z_SYNC_FLUSH, finishFlush: zlib.constants.Z_SYNC_FLUSH };
const BROTLI_OPTIONS: zlib.BrotliOptions = {
	flush: zlib.constants.BROTLI_OPERATION_FLUSH,
	finishFlush: zlib.constants.BROTLI_OPERATION_FLUSH
};

/** A request body as it goes over the wire. */
type OutgoingBody = { kind: 'bytes'; bytes: Buffer } | { kind: 'stream'; stream: ReadableStream<Uint8Array> };

/** `TypeError: fetch failed` with its cause, the shape fetch rejects with when no response arrives. */
function networkError(cause: unknown): TypeError {
	return new TypeError('fetch failed', { cause: typeof cause === 'string' ? new Error(cause) : cause });
}

/**
 * Whether a `RequestInit.body` is a stream fetch sends as it is produced (length unknown), rather than
 * a value of known length.
 */
function isStreamingBody(body: unknown): boolean {
	if (!body || typeof body !== 'object') return false;
	return (
		typeof (body as { getReader?: unknown }).getReader === 'function' ||
		typeof (body as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === 'function'
	);
}

/**
 * `fetch`, performed with `node:http`/`node:https` and a connection-time `lookup`.
 *
 * @param input - URL or `Request`, as for fetch.
 * @param init - Standard `RequestInit`, as for fetch.
 * @param options - The `lookup` every connection uses, and the per-hop redirect check.
 * @returns A global `Response` with a streaming body.
 */
export async function fetchOverNodeHttp(
	input: string | URL | Request,
	init: RequestInit | undefined,
	options: IFetchOverNodeHttpOptions
): Promise<Response> {
	const request = new Request(input, init);
	const signal = request.signal;
	signal.throwIfAborted();

	let method = request.method;
	const headers = new Headers(request.headers);
	let body: OutgoingBody | null = null;
	if (request.body) {
		body = isStreamingBody(init?.body)
			? { kind: 'stream', stream: request.body }
			: { kind: 'bytes', bytes: Buffer.from(await request.arrayBuffer()) };
	}

	let url = new URL(request.url);
	let redirectCount = 0;
	for (;;) {
		signal.throwIfAborted();
		const incoming = await send(url, method, headers, body, signal, options.lookup);
		if (signal.aborted) {
			incoming.destroy();
			throw signal.reason;
		}
		const status = incoming.statusCode ?? 0;

		if (REDIRECT_STATUSES.has(status) && request.redirect !== 'manual') {
			if (request.redirect === 'error') {
				incoming.destroy();
				throw networkError('unexpected redirect');
			}
			const location = incoming.headers.location;
			if (location !== undefined) {
				incoming.destroy();
				let next: URL;
				try {
					next = new URL(location, url);
				} catch (error) {
					throw networkError(error);
				}
				if (next.protocol !== 'http:' && next.protocol !== 'https:') {
					throw networkError('URL scheme must be a HTTP(S) scheme');
				}
				if (++redirectCount > MAX_REDIRECTS) {
					throw networkError('redirect count exceeded');
				}
				if (status !== 303 && body?.kind === 'stream') {
					// A stream has been consumed and cannot be sent again.
					throw networkError('cannot follow a redirect with a streamed request body');
				}
				if (
					((status === 301 || status === 302) && method === 'POST') ||
					(status === 303 && method !== 'GET' && method !== 'HEAD')
				) {
					method = 'GET';
					body = null;
					for (const name of REQUEST_BODY_HEADERS) headers.delete(name);
				}
				if (next.origin !== url.origin) {
					for (const name of CROSS_ORIGIN_STRIPPED_HEADERS) headers.delete(name);
				}
				signal.throwIfAborted();
				await options.beforeRedirect?.(next.href, signal);
				url = next;
				continue;
			}
		}

		return toResponse(incoming, method, url, redirectCount > 0, signal);
	}
}

/** Open one connection, send one request, and resolve with the response head. */
function send(
	url: URL,
	method: string,
	headers: Headers,
	body: OutgoingBody | null,
	signal: AbortSignal,
	lookup: LookupFunction
): Promise<http.IncomingMessage> {
	return new Promise<http.IncomingMessage>((resolve, reject) => {
		const client = url.protocol === 'https:' ? https : http;
		const req = client.request({
			protocol: url.protocol,
			hostname: url.hostname.replace(/^\[|\]$/g, ''),
			port: url.port || undefined,
			path: `${url.pathname}${url.search}`,
			method,
			headers: outgoingHeaders(headers, url, method, body),
			lookup,
			// Never a pooled socket: a reused connection would skip `lookup` (see the module comment).
			agent: false
		});

		let response: http.IncomingMessage | undefined;
		let settled = false;
		const settle = (error: unknown) => {
			if (settled) return;
			settled = true;
			signal.removeEventListener('abort', onAbort);
			reject(error);
		};
		const onAbort = () => {
			req.destroy();
			settle(signal.reason);
		};
		signal.addEventListener('abort', onAbort, { once: true });

		req.setTimeout(IDLE_TIMEOUT_MS, () => {
			const error = new Error(`no data received for ${IDLE_TIMEOUT_MS / 1000}s`);
			// Before the headers this fails the request; after them it errors the body stream.
			if (response) response.destroy(error);
			else req.destroy(error);
		});
		req.on('error', (error) => settle(signal.aborted ? signal.reason : networkError(error)));
		req.on('response', (incoming) => {
			if (settled) {
				incoming.destroy();
				return;
			}
			settled = true;
			response = incoming;
			signal.removeEventListener('abort', onAbort);
			resolve(incoming);
		});

		if (!body) {
			req.end();
		} else if (body.kind === 'bytes') {
			req.end(body.bytes);
		} else {
			pipeline(Readable.fromWeb(body.stream as unknown as NodeReadableStream<Uint8Array>), req, (error) => {
				if (error) req.destroy(error);
			});
		}
	});
}

/** The header block fetch would send for this request. */
function outgoingHeaders(
	headers: Headers,
	url: URL,
	method: string,
	body: OutgoingBody | null
): http.OutgoingHttpHeaders {
	const outgoing: http.OutgoingHttpHeaders = {};
	headers.forEach((value, name) => {
		outgoing[name] = value;
	});
	// The defaults fetch adds when the caller did not set them.
	outgoing['accept'] ??= '*/*';
	outgoing['accept-language'] ??= '*';
	outgoing['user-agent'] ??= 'node';
	outgoing['accept-encoding'] ??= url.protocol === 'https:' ? 'br, gzip, deflate' : 'gzip, deflate';

	if (body?.kind === 'bytes') {
		outgoing['content-length'] = String(body.bytes.byteLength);
	} else if (!body) {
		delete outgoing['content-length'];
		if (method === 'POST' || method === 'PUT') outgoing['content-length'] = '0';
	}
	return outgoing;
}

/** Decoders for a `content-encoding` header, outermost coding first; empty when the body is passed on as-is. */
function contentDecoders(header: string | undefined): Transform[] {
	const codings = (header ?? '')
		.toLowerCase()
		.split(',')
		.map((coding) => coding.trim())
		.filter(Boolean);
	if (codings.length > MAX_CONTENT_CODINGS) {
		throw networkError(`too many content-encodings: ${codings.length}`);
	}
	const decoders: Transform[] = [];
	for (let i = codings.length - 1; i >= 0; i--) {
		const coding = codings[i];
		if (coding === 'gzip' || coding === 'x-gzip') decoders.push(zlib.createGunzip(ZLIB_OPTIONS));
		else if (coding === 'deflate') decoders.push(zlib.createInflate(ZLIB_OPTIONS));
		else if (coding === 'br') decoders.push(zlib.createBrotliDecompress(BROTLI_OPTIONS));
		// A coding fetch does not know: it hands the bytes over undecoded, and so does this.
		else return [];
	}
	return decoders;
}

/** Wrap a response head in a global `Response` whose body streams from the socket. */
function toResponse(
	incoming: http.IncomingMessage,
	method: string,
	url: URL,
	redirected: boolean,
	signal: AbortSignal
): Response {
	const status = incoming.statusCode ?? 0;
	const headers = new Headers();
	const raw = incoming.rawHeaders;
	for (let i = 0; i + 1 < raw.length; i += 2) {
		try {
			headers.append(raw[i], raw[i + 1]);
		} catch {
			// A header value the Fetch API cannot represent; fetch does not surface it either.
		}
	}

	let body: Readable | null = null;
	if (method !== 'HEAD' && !NULL_BODY_STATUSES.has(status)) {
		let decoders: Transform[];
		try {
			decoders = contentDecoders(incoming.headers['content-encoding']);
		} catch (error) {
			incoming.destroy();
			throw error;
		}
		body = incoming;
		for (const decoder of decoders) {
			// `pipeline` destroys every stage when any stage fails or the reader cancels.
			body = pipeline(body, decoder, () => undefined);
		}
	} else {
		incoming.resume();
	}

	let response: Response;
	try {
		response = new Response(body ? (Readable.toWeb(body) as unknown as ReadableStream<Uint8Array>) : null, {
			status,
			statusText: incoming.statusMessage ?? '',
			headers
		});
	} catch (error) {
		incoming.destroy();
		throw networkError(error);
	}

	if (body) {
		// An abort while the body is being read errors the body, as it does for fetch.
		const stream = body;
		const onAbort = () => stream.destroy(signal.reason);
		signal.addEventListener('abort', onAbort, { once: true });
		stream.once('close', () => signal.removeEventListener('abort', onAbort));
	}

	const finalUrl = new URL(url);
	finalUrl.hash = '';
	Object.defineProperties(response, {
		url: { value: finalUrl.href, enumerable: true },
		redirected: { value: redirected, enumerable: true }
	});
	return response;
}
