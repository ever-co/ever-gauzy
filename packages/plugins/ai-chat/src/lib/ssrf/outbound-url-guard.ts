/**
 * SSRF guard for AI-provider endpoints — the PURE half.
 *
 * BYOK lets a tenant admin store a provider `baseUrl` and the server then fetches it: the model
 * catalogue (`GET {baseUrl}/models`), dictation (`POST {baseUrl}/audio/transcriptions`), chat
 * completions and the docs plugin's embeddings all originate from that one stored string. Validated
 * only as "is a URL", it pointed anywhere the API pod can reach — cloud metadata, the Kubernetes
 * API, another namespace (GHSA-w3mx-m5cr-3gxp).
 *
 * The host-class rules themselves are NOT re-implemented here: `@gauzy/utils` already carries the
 * audited predicates the Make.com and Zapier webhook guards use, so this module composes them and
 * adds only what is specific to a provider base URL. Nothing in here touches Node built-ins, so it
 * stays importable from the provider-helpers entry point the provider plugins map onto; the
 * DNS-resolving half lives next door in `ssrf-safe-fetch.ts`.
 */

import { getUnsafeOutboundUrlReason, isPrivateOrLoopbackHost } from '@gauzy/utils';
import type { IAiProviderCredentials } from '../provider.types';

/**
 * Opt-in for deployments that let TENANTS point a provider at a private address.
 *
 * Default DENY. Single-tenant self-hosts and desktop/local-server builds whose users enter a
 * LocalAI, Speaches, vLLM, Ollama or whisper.cpp address on `localhost` or a LAN in the settings page
 * set this to `true`; on shared hosting it stays off, because there the same capability is a tenant
 * reaching the operator's internal network. Addresses the OPERATOR chose — a `*_BASE_URL` environment
 * value or a provider's built-in default — are not tenant input and do not need it (see
 * {@link isPrivateAiProviderEndpointAllowed}).
 */
export const ALLOW_PRIVATE_BASE_URLS_ENV = 'GAUZY_AI_CHAT_ALLOW_PRIVATE_BASE_URLS';

/**
 * Host substituted for a private one when re-asking the shared guard about an opted-in URL.
 *
 * `example.com` is reserved by RFC 2606, so it can never collide with a real provider host, and it
 * is unambiguously public as far as {@link isPrivateOrLoopbackHost} is concerned.
 */
const PUBLIC_PROBE_HOST = 'public.example.com';

/** Whether this deployment has opted in to private/loopback AI-provider endpoints. */
export function isPrivateAiProviderBaseUrlAllowed(): boolean {
	return (process.env[ALLOW_PRIVATE_BASE_URLS_ENV] ?? '').trim().toLowerCase() === 'true';
}

/**
 * Whether a request made with these credentials may target a loopback/private/link-local host — the
 * value provider plugins pass as `allowPrivateHost` to the catalogue and speech helpers.
 *
 * The SSRF threat is a TENANT choosing the address, so the rule follows who chose it:
 *
 * - **A tenant credential that carries its own base URL** → only when the deployment opted in with
 *   {@link ALLOW_PRIVATE_BASE_URLS_ENV}. This is the GHSA-w3mx-m5cr-3gxp case and stays default-deny.
 * - **Anything else** → allowed. An `environment`/`platform` credential's base URL comes from the
 *   operator's own `*_BASE_URL` variable, and a credential with NO base URL makes the provider fall back
 *   to its built-in default (`http://localhost:8000/v1` for Speaches, a vendor host for the rest).
 *   Neither is tenant input, and refusing them broke zero-config local providers on every install
 *   that had not set the flag.
 *
 * `source` is assigned by the server's credential resolver, never read from a request, so a tenant
 * cannot claim a different provenance. With no credentials at all nothing vouches for the address,
 * so only the deployment flag decides.
 *
 * @param credentials - The credentials the request is about to be made with.
 * @returns `true` when a private target is acceptable for this request.
 */
export function isPrivateAiProviderEndpointAllowed(credentials: IAiProviderCredentials | null | undefined): boolean {
	if (!credentials) {
		return isPrivateAiProviderBaseUrlAllowed();
	}
	const tenantSuppliedUrl = credentials.source === 'tenant' && !!credentials.baseUrl?.trim();
	return !tenantSuppliedUrl || isPrivateAiProviderBaseUrlAllowed();
}

/**
 * Why this URL is not safe for the server to request on a tenant's behalf, or `null` when it is.
 *
 * Applied to the URL actually being fetched, so a query string is fine here (Deepgram puts its
 * options there). Delegates scheme, embedded-credential, length and host-class judgement to
 * `getUnsafeOutboundUrlReason`; `allowHttp` is on because a self-hosted model server on a LAN
 * legitimately speaks plain HTTP, and the host-class rule is what stops that meaning "anywhere".
 *
 * @param url - The absolute URL about to be requested.
 * @param options.allowPrivate - Permit loopback/private/link-local hosts. Defaults to the
 *        {@link ALLOW_PRIVATE_BASE_URLS_ENV} deployment flag.
 */
export function getUnsafeAiOutboundUrlReason(url: string, options?: { allowPrivate?: boolean }): string | null {
	if (typeof url !== 'string' || url.trim().length === 0) {
		return 'a URL is required';
	}
	const candidate = url.trim();

	let parsed: URL;
	try {
		parsed = new URL(candidate);
	} catch {
		return 'it is not a valid URL';
	}

	const allowPrivate = options?.allowPrivate ?? isPrivateAiProviderBaseUrlAllowed();
	if (allowPrivate && isPrivateOrLoopbackHost(parsed.hostname)) {
		// This deployment opted in to private targets — but ONLY to the host rule. Rather than
		// skipping the shared guard wholesale (which would silently drop any rule added to it later),
		// ask it about the same URL with the host swapped for a known-public one.
		const probe = new URL(candidate);
		probe.hostname = PUBLIC_PROBE_HOST;
		return getUnsafeOutboundUrlReason(probe.toString(), { allowHttp: true });
	}

	return getUnsafeOutboundUrlReason(candidate, { allowHttp: true });
}

/**
 * Why this value is not safe to STORE as a provider base URL, or `null` when it is.
 *
 * Everything {@link getUnsafeAiOutboundUrlReason} rejects, plus a query string or fragment: the
 * providers build their endpoint by APPENDING (`${baseUrl}/models`), so a trailing `?` or `#` in the
 * stored value demotes that suffix into a query string or fragment and hands the caller full control
 * of the request path on the target host. `@IsUrl` accepts both by default, which is how
 * `http://169.254.169.254/latest/meta-data/?` reached the fetch with its path intact.
 *
 * @param url - The base URL being stored.
 * @param options.allowPrivate - See {@link getUnsafeAiOutboundUrlReason}.
 */
export function getUnsafeAiProviderBaseUrlReason(url: string, options?: { allowPrivate?: boolean }): string | null {
	if (typeof url !== 'string' || url.trim().length === 0) {
		return 'a base URL is required';
	}
	const candidate = url.trim();

	try {
		// eslint-disable-next-line no-new
		new URL(candidate);
	} catch {
		return 'it is not a valid URL';
	}
	// Checked on the RAW STRING, not on `parsed.search`/`parsed.hash`: the URL parser normalizes a
	// trailing bare `?` or `#` away, while the providers build their endpoint by concatenating the
	// stored string (`${baseUrl}/models`) — so `http://target/anything?` really does become
	// `http://target/anything?/models`, with the attacker owning the whole path.
	if (candidate.includes('?') || candidate.includes('#')) {
		return 'it must not contain a query string or fragment';
	}

	return getUnsafeAiOutboundUrlReason(candidate, options);
}

/** Convenience predicate over {@link getUnsafeAiProviderBaseUrlReason}. */
export function isSafeAiProviderBaseUrl(url: string, options?: { allowPrivate?: boolean }): boolean {
	return getUnsafeAiProviderBaseUrlReason(url, options) === null;
}
