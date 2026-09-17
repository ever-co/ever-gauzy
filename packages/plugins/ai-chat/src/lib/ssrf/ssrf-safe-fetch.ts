/**
 * SSRF guard for AI-provider endpoints — the NODE half.
 *
 * A URL-literal check cannot see through DNS: `https://evil.example.com` is a perfectly public
 * string that can resolve to `169.254.169.254`. The Make.com and Zapier fixes close that with an
 * `https.Agent` whose `lookup` re-checks the RESOLVED address (`createSsrfSafeHttpsAgent` in
 * `@gauzy/core`). The same rule is applied here, at two points:
 *
 * 1. A pre-flight: the URL-literal check, then resolve-then-check of the host, before any socket is
 *    opened. It refuses early and names nothing in its error.
 * 2. The connection itself. Requests are NOT made with the global `fetch`, which resolves the host a
 *    second time on its own when it connects; a hostname whose answer flips between two lookups (TTL
 *    0, alternating public and private answers) could pass the pre-flight and still reach loopback,
 *    RFC 1918, link-local or cloud-metadata addresses. They go through `fetchOverNodeHttp`, which
 *    connects with `node:http`/`node:https` and the {@link createSsrfSafeLookup} `lookup`. Node
 *    connects to exactly the addresses that `lookup` returns, and it returns none unless every
 *    resolved address is public, so the address judged IS the address used. Every redirect hop
 *    repeats both checks, connections are never pooled (a reused socket would skip the `lookup`), and
 *    nothing is cached that an attacker could outlive.
 *
 * That closes the rebinding residual the pre-flight alone left open. `allowPrivateHost` switches both
 * checks off together, and only server-side provenance may set it.
 *
 * Node's `dns`, `http` and `https` live in THIS plugin, never in `@gauzy/utils` — that package is
 * reachable from browser bundles and those imports would break them. The pure predicates stay next
 * door in `outbound-url-guard.ts`.
 */

import { lookup as dnsLookup } from 'dns';
import type { LookupAddress, LookupOptions } from 'dns';
import { isIP } from 'net';
import type { LookupFunction } from 'net';
import { isPrivateOrLoopbackHost } from '@gauzy/utils';
import type { IAiProviderCredentials } from '../provider.types';
import { fetchOverNodeHttp } from './fetch-over-node-http';
import { getUnsafeAiOutboundUrlReason, isPrivateAiProviderBaseUrlAllowed } from './outbound-url-guard';

/** Thrown instead of performing a request the egress guard refuses. */
export class SsrfBlockedError extends Error {
	readonly code = 'ESSRFBLOCKED';

	constructor(message: string) {
		super(message);
		this.name = 'SsrfBlockedError';
	}
}

/** Resolve a hostname to its addresses. Seam so specs need no network. */
export type HostnameResolver = (hostname: string) => Promise<string[]>;

export interface ISsrfSafeFetchOptions {
	/**
	 * Permit loopback/private/link-local targets. Defaults to the deployment flag.
	 *
	 * Set it only from server-side provenance (see `isPrivateAiProviderEndpointAllowed`), never from
	 * anything a tenant supplied: `true` skips the host-class rule, the DNS pre-flight and the
	 * connection-time address check.
	 */
	allowPrivateHost?: boolean;
	/**
	 * Override the DNS resolver (tests). Defaults to `dns.lookup`. Used by the pre-flight AND by every
	 * connection, so a spec can hand the two different answers.
	 */
	resolver?: HostnameResolver;
}

/** Promisified `dns.lookup` returning every address for the host. */
const defaultResolver: HostnameResolver = (hostname: string) =>
	new Promise<string[]>((resolve, reject) => {
		dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
			if (error) return reject(error);
			resolve((addresses ?? []).map((entry) => entry.address));
		});
	});

/**
 * Resolver error codes that are a DEFINITIVE "this name does not exist / has no address".
 *
 * `dns.lookup` reports both `EAI_NONAME` and `EAI_NODATA` as `ENOTFOUND`; the others are the spellings
 * `dns.promises.Resolver` and raw `getaddrinfo` wrappers use for the same verdict.
 */
const NON_EXISTENT_HOST_CODES = new Set(['ENOTFOUND', 'ENODATA', 'NOTFOUND', 'EAI_NONAME', 'EAI_NODATA']);

/**
 * Wait for `promise`, but give up as soon as `signal` aborts.
 *
 * The caller's `AbortSignal` is its whole request budget (`AbortSignal.timeout(...)` on the dictation
 * and catalogue paths). Without this a resolver that stalls holds the request past that budget,
 * because `fetch` — the only thing that would have honoured the signal — has not been called yet.
 * Rejects with the signal's own reason, so a timeout still reads as a `TimeoutError` upstream.
 */
function raceAbort<T>(promise: Promise<T>, signal?: AbortSignal | null): Promise<T> {
	if (!signal) return promise;
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

/**
 * Refuse the request when the host resolves to a non-public address, or cannot be checked at all.
 *
 * Fails CLOSED: only a definitive "no such host" ({@link NON_EXISTENT_HOST_CODES}, or an empty answer)
 * is let through, since there is then nothing to connect to and `fetch` fails on its own lookup with a
 * message a self-hoster can act on. Any other resolver failure — a timeout, `EAI_AGAIN`, a refused or
 * broken resolver — is not a verdict, and a check that cannot reach a verdict must not return the
 * permissive one.
 *
 * @param hostname - The URL hostname about to be requested.
 * @param resolver - Resolver override (tests); `dns.lookup` otherwise.
 * @param signal - The request's abort signal; honoured while resolving.
 * @throws SsrfBlockedError when any resolved address is non-public or the lookup failed inconclusively.
 */
async function assertResolvedHostIsPublic(
	hostname: string,
	resolver?: HostnameResolver,
	signal?: AbortSignal | null
): Promise<void> {
	let addresses: string[];
	try {
		addresses = await raceAbort((resolver ?? defaultResolver)(hostname), signal);
	} catch (error) {
		// The request's own budget ran out: surface that, not a security-shaped refusal.
		if (signal?.aborted && error === signal.reason) throw error;
		if (isNonExistentHostError(error)) return;
		throw unverifiableError();
	}

	// ANY private address disqualifies the host, not just the first: a resolver under the caller's
	// control can answer with a public address alongside an internal one and let the connection pick.
	if (addresses.some((address) => isPrivateOrLoopbackHost(address))) {
		throw blockedError();
	}
}

/** Whether a resolver error is the definitive "no such host" verdict ({@link NON_EXISTENT_HOST_CODES}). */
function isNonExistentHostError(error: unknown): boolean {
	const code = (error as { code?: unknown } | null)?.code;
	return typeof code === 'string' && NON_EXISTENT_HOST_CODES.has(code);
}

/**
 * The refusal, worded so it names neither the host nor the resolved address: this string reaches the
 * user on the dictation path, and a resolve-or-not oracle is half of what the advisory is about.
 */
const blockedError = () =>
	new SsrfBlockedError('The configured AI provider endpoint resolves to a non-public address.');

/** The fail-closed refusal for a lookup that failed without a verdict. Names nothing, like {@link blockedError}. */
const unverifiableError = () =>
	new SsrfBlockedError('The configured AI provider endpoint could not be verified as a public address.');

/** Address family a `lookup` caller asked for; `0` for any. */
function requestedFamily(family: LookupOptions['family']): 0 | 4 | 6 {
	if (family === 4 || family === 'IPv4') return 4;
	if (family === 6 || family === 'IPv6') return 6;
	return 0;
}

/** Resolve every address of a host for a connection, through the injected resolver or `dns.lookup`. */
function resolveForConnection(
	hostname: string,
	options: LookupOptions,
	resolver: HostnameResolver | undefined
): Promise<LookupAddress[]> {
	if (resolver) {
		return resolver(hostname).then((addresses) =>
			(addresses ?? []).map((address) => ({ address, family: isIP(address) }))
		);
	}
	return new Promise<LookupAddress[]>((resolve, reject) => {
		dnsLookup(hostname, { hints: options.hints, all: true }, (error, addresses) => {
			if (error) return reject(error);
			resolve(addresses ?? []);
		});
	});
}

/**
 * The `lookup` every guarded connection resolves its host through, redirect hops included.
 *
 * This is what binds the verdict to the connection. Node connects only to addresses a `lookup` hands
 * back, and this one hands back nothing unless EVERY address the host resolved to is public — so a
 * name that answered public to the pre-flight and private a moment later is refused at the socket,
 * on the answer the socket would have used. Fails closed like the pre-flight: only a definitive "no
 * such host" is passed through as a lookup failure (the request then fails as fetch would); any other
 * resolver error is refused. With `allowPrivateHost` it resolves and checks nothing.
 *
 * An IP-literal host never reaches a `lookup` (Node connects to it directly), which is why every hop
 * also passes the URL-literal check first.
 *
 * @param allowPrivateHost - Server-side provenance only; see {@link ISsrfSafeFetchOptions}.
 * @param resolver - Resolver override (tests); `dns.lookup` otherwise.
 */
export function createSsrfSafeLookup(allowPrivateHost: boolean, resolver?: HostnameResolver): LookupFunction {
	return (hostname, options, callback) => {
		const done = callback as (
			error: NodeJS.ErrnoException | null,
			address?: string | LookupAddress[],
			family?: number
		) => void;
		resolveForConnection(hostname, options, resolver).then(
			(entries) => {
				if (!allowPrivateHost && entries.some((entry) => isPrivateOrLoopbackHost(entry.address))) {
					return done(blockedError());
				}
				const family = requestedFamily(options.family);
				const usable = family ? entries.filter((entry) => entry.family === family) : entries;
				if (usable.length === 0) {
					return done(
						Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), {
							code: 'ENOTFOUND',
							syscall: 'getaddrinfo',
							hostname
						})
					);
				}
				if (options.all) return done(null, usable);
				return done(null, usable[0].address, usable[0].family);
			},
			(error) => {
				if (allowPrivateHost || isNonExistentHostError(error)) return done(error);
				return done(unverifiableError());
			}
		);
	};
}

/**
 * `fetch` with an SSRF egress guard: URL-literal check, resolve-then-check of the host, the same
 * check again on the address each connection actually uses, and redirects refused.
 *
 * Redirects matter as much as the host: `redirect: 'follow'` is fetch's default, so a public host
 * answering `302 http://169.254.169.254/` would be followed with no second check. The transport
 * re-checks every hop it follows, but this helper still refuses them outright — the same
 * `maxRedirects: 0` rule the Make.com and Zapier guards apply, spelled the way the fetch API spells it.
 *
 * @param url - Absolute URL to request.
 * @param init - Standard `fetch` init; `redirect` is forced to `'error'`, and `signal` also bounds
 *        the DNS pre-flight.
 * @param options - Egress-guard options.
 * @throws SsrfBlockedError when the target is refused, before any request reaches it.
 */
export async function ssrfSafeFetch(
	url: string,
	init?: RequestInit,
	options?: ISsrfSafeFetchOptions
): Promise<Response> {
	return await guardedFetch(url, { ...(init ?? {}), redirect: 'error' }, options);
}

/**
 * The request both public entry points make: the pre-flight, then the request itself over a transport
 * whose every connection — and every redirect hop, when the caller follows them — is checked again.
 *
 * @throws SsrfBlockedError when the target is refused, whether by the pre-flight or at connection time.
 */
async function guardedFetch(
	input: string | URL | Request,
	init: RequestInit,
	options?: ISsrfSafeFetchOptions
): Promise<Response> {
	// Decided once, so the pre-flight and the connection can never disagree about the policy.
	const allowPrivateHost = options?.allowPrivateHost ?? isPrivateAiProviderBaseUrlAllowed();
	const resolver = options?.resolver;

	// A `Request` is judged by its own URL and signal.
	const request = typeof input === 'object' && !(input instanceof URL) ? input : undefined;
	const url = request ? request.url : String(input);
	await assertOutboundTargetAllowed(url, init.signal ?? request?.signal, allowPrivateHost, resolver);

	try {
		return await fetchOverNodeHttp(input, init, {
			lookup: createSsrfSafeLookup(allowPrivateHost, resolver),
			beforeRedirect: (hop, signal) => assertOutboundTargetAllowed(hop, signal, allowPrivateHost, resolver)
		});
	} catch (error) {
		// A refusal from the connection's `lookup` arrives the way fetch reports any failed connection,
		// as the cause of `TypeError: fetch failed`. Surface the refusal itself, so callers that test
		// `isSsrfBlockedError` see it exactly as they see a pre-flight refusal.
		const cause = (error as { cause?: unknown } | null)?.cause;
		throw isSsrfBlockedError(cause) ? cause : error;
	}
}

/**
 * The egress checks run before each request and each redirect hop: URL-literal check, then (unless
 * private targets are permitted) resolve-then-check of a hostname.
 *
 * @param url - Absolute URL about to be requested.
 * @param signal - The request's abort signal; bounds the DNS pre-flight.
 * @param allowPrivate - Whether private targets are permitted for this request.
 * @param resolver - Resolver override (tests); `dns.lookup` otherwise.
 * @throws SsrfBlockedError when the target is refused.
 */
async function assertOutboundTargetAllowed(
	url: string,
	signal: AbortSignal | null | undefined,
	allowPrivate: boolean,
	resolver: HostnameResolver | undefined
): Promise<void> {
	const reason = getUnsafeAiOutboundUrlReason(url, { allowPrivate });
	if (reason) {
		throw new SsrfBlockedError(`The configured AI provider endpoint is not allowed: ${reason}.`);
	}

	if (!allowPrivate) {
		// An IP literal has nothing to resolve and was already judged by the literal check above.
		const hostname = new URL(url).hostname.replace(/^\[|\]$/g, '');
		if (!isIP(hostname)) {
			await assertResolvedHostIsPublic(hostname, resolver, signal);
		}
	}
}

/**
 * The `fetch` to hand an AI SDK provider factory (`create*({ baseURL, fetch })`) so chat completions
 * and embeddings get the same egress guard as the catalogue and dictation requests.
 *
 * Those sinks send their request to the SAME stored base URL, but through the SDK's own `fetch`: a
 * tenant base URL whose host is a public-looking name resolving to an internal address (a wildcard
 * DNS service is enough — no rebinding needed) passed the store-time and read-time LITERAL checks and
 * was then requested, redirects followed, by every chat turn (GHSA-w3mx-m5cr-3gxp).
 *
 * Only a TENANT-supplied base URL is guarded. For anything else — the operator's own `*_BASE_URL`, a
 * platform key, or a tenant key with no base URL, which the SDK sends to the vendor's built-in host —
 * this returns `undefined`, so the factory keeps its default transport and operator traffic is
 * unchanged. For a tenant URL, private targets follow the `GAUZY_AI_CHAT_ALLOW_PRIVATE_BASE_URLS` deployment
 * flag, exactly as `isPrivateAiProviderEndpointAllowed` decides for the catalogue and speech paths.
 *
 * The guard is the one {@link ssrfSafeFetch} applies, connection-time check included, so a name
 * that rebinds between the pre-flight and the connection is refused here too. Streaming responses
 * (server-sent events) stream through it unchanged.
 *
 * @param credentials - The credentials the provider model is being created with.
 * @param options.resolver - DNS resolver override (tests); `dns.lookup` otherwise.
 * @returns A guarded `fetch`, or `undefined` when the address was not chosen by a tenant.
 */
export function createAiProviderSdkFetch(
	credentials: IAiProviderCredentials | null | undefined,
	options?: Pick<ISsrfSafeFetchOptions, 'resolver'>
): typeof fetch | undefined {
	if (credentials?.source !== 'tenant' || !credentials.baseUrl?.trim()) {
		return undefined;
	}
	const guardOptions: ISsrfSafeFetchOptions = {
		allowPrivateHost: isPrivateAiProviderBaseUrlAllowed(),
		resolver: options?.resolver
	};
	// The SDK passes a string today; a `Request` is judged by its own URL and signal all the same.
	return async (input: string | URL | Request, init?: RequestInit): Promise<Response> =>
		await guardedFetch(input, { ...(init ?? {}), redirect: 'error' }, guardOptions);
}

/** Whether an error came from the egress guard (duck-typed, so it survives bundle boundaries). */
export function isSsrfBlockedError(error: unknown): boolean {
	return !!error && typeof error === 'object' && (error as { code?: string }).code === 'ESSRFBLOCKED';
}
