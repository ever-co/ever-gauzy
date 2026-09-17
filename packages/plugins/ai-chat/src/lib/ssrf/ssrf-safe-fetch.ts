/**
 * SSRF guard for AI-provider endpoints — the NODE half.
 *
 * A URL-literal check cannot see through DNS: `https://evil.example.com` is a perfectly public
 * string that can resolve to `169.254.169.254`. The Make.com and Zapier fixes close that with an
 * `https.Agent` whose `lookup` re-checks the RESOLVED address (`createSsrfSafeHttpsAgent` in
 * `@gauzy/core`), but that agent is an `http(s)` agent for axios and cannot be handed to the global
 * `fetch` these sinks use, so the same resolve-then-check rule is applied here as a pre-flight.
 *
 * Known residual: a pre-flight is not the connection. `fetch` resolves the host again when it
 * connects, so a hostname whose answer flips between the two lookups is not caught here. Closing that
 * needs a connection-level `lookup` (an undici `Dispatcher`), which is tracked separately. Every
 * verdict is therefore computed fresh — nothing is cached that an attacker could outlive.
 *
 * Node's `dns` lives in THIS module, never in `@gauzy/utils` — that package is reachable from
 * browser bundles and a `dns` import would break them. The pure predicates stay next door in
 * `outbound-url-guard.ts`.
 */

import { lookup as dnsLookup } from 'dns';
import { isIP } from 'net';
import { isPrivateOrLoopbackHost } from '@gauzy/utils';
import type { IAiProviderCredentials } from '../provider.types';
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
	 * anything a tenant supplied: `true` skips both the host-class rule and the DNS pre-flight.
	 */
	allowPrivateHost?: boolean;
	/** Override the DNS resolver (tests). Defaults to `dns.lookup`. */
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
		const code = (error as { code?: unknown } | null)?.code;
		if (typeof code === 'string' && NON_EXISTENT_HOST_CODES.has(code)) return;
		throw new SsrfBlockedError('The configured AI provider endpoint could not be verified as a public address.');
	}

	// ANY private address disqualifies the host, not just the first: a resolver under the caller's
	// control can answer with a public address alongside an internal one and let the connection pick.
	if (addresses.some((address) => isPrivateOrLoopbackHost(address))) {
		throw blockedError();
	}
}

/**
 * The refusal, worded so it names neither the host nor the resolved address: this string reaches the
 * user on the dictation path, and a resolve-or-not oracle is half of what the advisory is about.
 */
const blockedError = () =>
	new SsrfBlockedError('The configured AI provider endpoint resolves to a non-public address.');

/**
 * `fetch` with an SSRF egress guard: URL-literal check, resolve-then-check of the host, and
 * redirects refused.
 *
 * Redirects matter as much as the host: `redirect: 'follow'` is undici's default, so a public host
 * answering `302 http://169.254.169.254/` would be followed by the plain `fetch` with no second
 * check. The same `maxRedirects: 0` rule the Make.com and Zapier guards apply, spelled the way the
 * fetch API spells it.
 *
 * @param url - Absolute URL to request.
 * @param init - Standard `fetch` init; `redirect` is forced to `'error'`, and `signal` also bounds
 *        the DNS pre-flight.
 * @param options - Egress-guard options.
 * @throws SsrfBlockedError before any request is made when the target is refused.
 */
export async function ssrfSafeFetch(
	url: string,
	init?: RequestInit,
	options?: ISsrfSafeFetchOptions
): Promise<Response> {
	await assertOutboundTargetAllowed(url, init?.signal, options);
	return await fetch(url, { ...(init ?? {}), redirect: 'error' });
}

/**
 * The egress checks {@link ssrfSafeFetch} runs before a request: URL-literal check, then (unless
 * private targets are permitted) resolve-then-check of a hostname.
 *
 * @param url - Absolute URL about to be requested.
 * @param signal - The request's abort signal; bounds the DNS pre-flight.
 * @param options - Egress-guard options.
 * @throws SsrfBlockedError when the target is refused.
 */
async function assertOutboundTargetAllowed(
	url: string,
	signal: AbortSignal | null | undefined,
	options?: ISsrfSafeFetchOptions
): Promise<void> {
	const allowPrivate = options?.allowPrivateHost ?? isPrivateAiProviderBaseUrlAllowed();

	const reason = getUnsafeAiOutboundUrlReason(url, { allowPrivate });
	if (reason) {
		throw new SsrfBlockedError(`The configured AI provider endpoint is not allowed: ${reason}.`);
	}

	if (!allowPrivate) {
		// An IP literal has nothing to resolve and was already judged by the literal check above.
		const hostname = new URL(url).hostname.replace(/^\[|\]$/g, '');
		if (!isIP(hostname)) {
			await assertResolvedHostIsPublic(hostname, options?.resolver, signal);
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
 * Carries the same residual as {@link ssrfSafeFetch}: the check is a pre-flight, not the connection.
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
	return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
		// The SDK passes a string today; a `Request` is judged by its own URL and signal all the same.
		const request = typeof input === 'object' && !(input instanceof URL) ? input : undefined;
		const url = request ? request.url : String(input);
		await assertOutboundTargetAllowed(url, init?.signal ?? request?.signal, guardOptions);
		return await fetch(input, { ...(init ?? {}), redirect: 'error' });
	};
}

/** Whether an error came from the egress guard (duck-typed, so it survives bundle boundaries). */
export function isSsrfBlockedError(error: unknown): boolean {
	return !!error && typeof error === 'object' && (error as { code?: string }).code === 'ESSRFBLOCKED';
}
