/**
 * SSRF guard for AI-provider endpoints — the NODE half.
 *
 * A URL-literal check cannot see through DNS: `https://evil.example.com` is a perfectly public
 * string that can resolve to `169.254.169.254`. The Make.com and Zapier fixes close that with an
 * `https.Agent` whose `lookup` re-checks the RESOLVED address (`createSsrfSafeHttpsAgent` in
 * `@gauzy/core`), but that agent is an `http(s)` agent for axios and cannot be handed to the global
 * `fetch` these sinks use, so the same resolve-then-check rule is applied here as a pre-flight.
 *
 * Node's `dns` lives in THIS module, never in `@gauzy/utils` — that package is reachable from
 * browser bundles and a `dns` import would break them. The pure predicates stay next door in
 * `outbound-url-guard.ts`.
 */

import { lookup as dnsLookup } from 'dns';
import { isPrivateOrLoopbackHost } from '@gauzy/utils';
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
	/** Permit loopback/private/link-local targets. Defaults to the deployment flag. */
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
 * How long a per-host verdict is reused.
 *
 * A resolver round trip costs hundreds of milliseconds and a settings page or a dictation burst asks
 * about the same host repeatedly. Deliberately SHORT: the verdict is what a DNS-rebinding attacker
 * would want to outlive, so the window in which a host that has just turned internal is still judged
 * public is kept to seconds — narrower than the OS resolver's own cache, which the connection that
 * follows reads from anyway.
 */
const VERDICT_TTL_MS = 10_000;

/** Bound, so a tenant churning hostnames cannot grow this without limit. */
const VERDICT_MAX_ENTRIES = 256;

/**
 * hostname → { blocked, at }. Only ever populated by the DEFAULT resolver (see below).
 *
 * Held on `globalThis` rather than in the module closure so it is shared by every copy of this
 * module in a process — the plugin barrel, the provider-helpers entry point the provider plugins map
 * onto, and a jest registry that has been reset. One host is then resolved once per TTL no matter
 * which door the request came through.
 */
const VERDICT_CACHE_KEY = Symbol.for('@gauzy/plugin-ai-chat:ssrf-host-verdicts');
const verdicts: Map<string, { blocked: boolean; at: number }> = ((globalThis as Record<symbol, unknown>)[
	VERDICT_CACHE_KEY
] ??= new Map<string, { blocked: boolean; at: number }>()) as Map<string, { blocked: boolean; at: number }>;

/**
 * Refuse the request when the host resolves to a non-public address.
 *
 * A lookup that ERRORS is not a verdict of "private" and is deliberately allowed through: an
 * unresolvable host cannot be connected to either, so the fetch below fails on the very same
 * resolution a moment later, and failing here instead would turn every transient resolver hiccup
 * into a security-shaped error the user cannot act on.
 *
 * The verdict cache is skipped whenever a caller injects its own `resolver`, so a test that answers
 * differently for the same hostname is never served another test's answer.
 */
async function assertResolvedHostIsPublic(hostname: string, resolver?: HostnameResolver): Promise<void> {
	const cacheable = resolver === undefined;
	const now = Date.now();

	if (cacheable) {
		const cached = verdicts.get(hostname);
		if (cached && now - cached.at < VERDICT_TTL_MS) {
			if (cached.blocked) throw blockedError();
			return;
		}
	}

	let addresses: string[];
	try {
		addresses = await (resolver ?? defaultResolver)(hostname);
	} catch {
		return;
	}

	// ANY private address disqualifies the host, not just the first: a resolver under the caller's
	// control can answer with a public address alongside an internal one and let the connection pick.
	const blocked = addresses.some((address) => isPrivateOrLoopbackHost(address));

	if (cacheable) {
		verdicts.delete(hostname);
		verdicts.set(hostname, { blocked, at: Date.now() });
		// Map preserves insertion order, so the first key is the least recently written.
		while (verdicts.size > VERDICT_MAX_ENTRIES) {
			const oldest = verdicts.keys().next().value;
			if (oldest === undefined) break;
			verdicts.delete(oldest);
		}
	}

	if (blocked) throw blockedError();
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
 * @param init - Standard `fetch` init; `redirect` is forced to `'error'`.
 * @param options - Egress-guard options.
 * @throws SsrfBlockedError before any request is made when the target is refused.
 */
export async function ssrfSafeFetch(
	url: string,
	init?: RequestInit,
	options?: ISsrfSafeFetchOptions
): Promise<Response> {
	const allowPrivate = options?.allowPrivateHost ?? isPrivateAiProviderBaseUrlAllowed();

	const reason = getUnsafeAiOutboundUrlReason(url, { allowPrivate });
	if (reason) {
		throw new SsrfBlockedError(`The configured AI provider endpoint is not allowed: ${reason}.`);
	}

	if (!allowPrivate) {
		await assertResolvedHostIsPublic(new URL(url).hostname, options?.resolver);
	}

	return await fetch(url, { ...(init ?? {}), redirect: 'error' });
}

/** Whether an error came from the egress guard (duck-typed, so it survives bundle boundaries). */
export function isSsrfBlockedError(error: unknown): boolean {
	return !!error && typeof error === 'object' && (error as { code?: string }).code === 'ESSRFBLOCKED';
}
