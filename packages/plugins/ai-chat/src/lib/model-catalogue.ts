/**
 * Shared plumbing for fetching a provider's model catalogue.
 *
 * Six providers need the same three things — a bounded HTTP GET, a cache keyed by credential, and a
 * failure mode that never empties the dropdown — so it lives here once rather than being re-derived
 * (and subtly mis-derived) per provider.
 *
 * The pattern is lifted from the OpenRouter free-model fetch that already proved it out: TTL cache,
 * in-flight de-duplication so a burst makes ONE network call, and a previously cached list preferred
 * over a pinned fallback because stale-but-real beats a guess.
 */

import type { IAiChatModel } from '@gauzy/contracts';
import type { IAiChatModelList, IAiProviderCredentials } from './provider.types';

/** How long a fetched catalogue stays fresh. Model lists change on the order of weeks. */
const DEFAULT_TTL_MS = 30 * 60 * 1000;

/**
 * How long to remember a FAILURE before trying again.
 *
 * Without this, a provider that is down turns every settings page load into another timeout, and the
 * user waits the full budget each time to be told the same thing.
 */
const DEFAULT_NEGATIVE_TTL_MS = 60 * 1000;

/** Upstream call budget. The settings page waits on this, so it must be short. */
const FETCH_TIMEOUT_MS = 8_000;

/** Guard against a pathological response eating memory. */
const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;

interface CacheEntry<T> {
	value: T;
	fetchedAt: number;
	/** Set when the last attempt FAILED; `value` is then the previous good list (or empty). */
	failedAt?: number;
}

export interface ICatalogueResult<T> {
	value: T;
	/** True when a refresh failed and this is a previously cached value. */
	stale: boolean;
}

export interface ICatalogueCache<T> {
	/**
	 * Return the cached value, or load it.
	 *
	 * `load` is called at most once per key at a time. A rejection is remembered briefly so a downed
	 * provider does not re-time-out on every call, and the previous value (if any) is served as stale.
	 */
	get(key: string, load: () => Promise<T>): Promise<ICatalogueResult<T>>;
	/** Testing seam. */
	clear(): void;
}

export function createCatalogueCache<T>(options?: {
	ttlMs?: number;
	negativeTtlMs?: number;
	maxEntries?: number;
}): ICatalogueCache<T> {
	const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
	const negativeTtlMs = options?.negativeTtlMs ?? DEFAULT_NEGATIVE_TTL_MS;
	// Bounded: the key includes a credential hash, so a tenant churning keys must not grow this
	// without limit.
	const maxEntries = options?.maxEntries ?? 64;

	const entries = new Map<string, CacheEntry<T>>();
	const inFlight = new Map<string, Promise<T>>();

	const remember = (key: string, entry: CacheEntry<T>) => {
		entries.delete(key);
		entries.set(key, entry);
		// Map preserves insertion order, so the first key is the least recently written.
		while (entries.size > maxEntries) {
			const oldest = entries.keys().next().value;
			if (oldest === undefined) break;
			entries.delete(oldest);
		}
	};

	return {
		async get(key: string, load: () => Promise<T>): Promise<ICatalogueResult<T>> {
			const cached = entries.get(key);
			const now = Date.now();

			if (cached) {
				if (cached.failedAt !== undefined && now - cached.failedAt < negativeTtlMs) {
					return { value: cached.value, stale: true };
				}
				if (cached.failedAt === undefined && now - cached.fetchedAt < ttlMs) {
					return { value: cached.value, stale: false };
				}
			}

			// Explicit undefined check, not truthiness: a Promise is always truthy, so `if (pending)`
			// reads like a forgotten await.
			const pending = inFlight.get(key);
			if (pending !== undefined) {
				try {
					return { value: await pending, stale: false };
				} catch {
					return { value: cached?.value ?? ([] as unknown as T), stale: true };
				}
			}

			const promise = load();
			inFlight.set(key, promise);
			try {
				const value = await promise;
				remember(key, { value, fetchedAt: Date.now() });
				return { value, stale: false };
			} catch (error) {
				// Keep serving whatever we had. An empty list would empty the user's dropdown, which is
				// a worse answer than a slightly old one.
				remember(key, {
					value: cached?.value ?? ([] as unknown as T),
					fetchedAt: cached?.fetchedAt ?? 0,
					failedAt: Date.now()
				});
				// The caller that triggers the refresh is the one that must not be punished for it.
				// Throwing here dropped it to the pinned fallback while every caller BEHIND it — inside
				// the negative TTL — got served the real, slightly old list. Exactly backwards, and
				// invisible in testing because the second call always looked right.
				if (cached) {
					return { value: cached.value, stale: true };
				}
				throw error;
			} finally {
				inFlight.delete(key);
			}
		},
		clear() {
			entries.clear();
			inFlight.clear();
		}
	};
}

/**
 * A cache key for a credential, WITHOUT the credential in it.
 *
 * Catalogues are account-specific — two tenants' keys can see different models — so the key has to
 * vary per credential. It must never contain the secret itself: cache keys end up in logs, heap
 * dumps and debuggers. A short non-cryptographic digest is enough to distinguish keys; this is not a
 * security boundary, it is a bucket label.
 */
export function credentialCacheKey(credentials: IAiProviderCredentials | null): string {
	if (!credentials?.apiKey) return 'anonymous';
	let hash = 5381;
	const material = `${credentials.apiKey}|${credentials.baseUrl ?? ''}`;
	for (let i = 0; i < material.length; i++) {
		hash = ((hash << 5) + hash + material.charCodeAt(i)) | 0;
	}
	return `k${(hash >>> 0).toString(36)}`;
}

/**
 * GET JSON from a provider's catalogue endpoint, bounded in both time and size.
 *
 * Throws on any non-2xx. Callers are expected to catch and fall back to a curated list — a catalogue
 * is a convenience, never a gate.
 */
export async function fetchCatalogueJson<T>(url: string, init?: { headers?: Record<string, string> }): Promise<T> {
	const response = await fetch(url, {
		headers: { accept: 'application/json', ...(init?.headers ?? {}) },
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
	});
	if (!response.ok) {
		// Deliberately does NOT include the response body: these endpoints are called with a
		// credential, and error bodies have been known to echo request context back.
		throw new Error(`Model catalogue request failed: ${response.status} ${response.statusText}`);
	}

	// Cheap pre-check: when the header IS present and already too big, stop before reading a byte.
	const declared = Number(response.headers.get('content-length') ?? 0);
	if (declared > MAX_RESPONSE_BYTES) {
		throw new Error(`Model catalogue response too large: ${declared} bytes`);
	}

	// The header is the hint, not the bound. Chunked and HTTP/2 responses carry no content-length at
	// all, so checking only the header and then calling `response.json()` buffers whatever arrives —
	// a cap that reads as enforced and is not. Count what is actually read and abandon the stream at
	// the limit.
	const reader = response.body?.getReader();
	if (!reader) {
		return (await response.json()) as T;
	}
	const decoder = new TextDecoder();
	let text = '';
	let received = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		received += value.byteLength;
		if (received > MAX_RESPONSE_BYTES) {
			await reader.cancel().catch(() => undefined);
			throw new Error(`Model catalogue response too large: over ${MAX_RESPONSE_BYTES} bytes`);
		}
		text += decoder.decode(value, { stream: true });
	}
	text += decoder.decode();
	return JSON.parse(text) as T;
}

/**
 * Resolve a catalogue that lives behind a PUBLIC endpoint (no credential required).
 *
 * Fails open to `curated`: an empty dropdown must never be how "the fetch failed" is expressed.
 */
export async function publicCatalogue(options: {
	curated: IAiChatModel[];
	cache: ICatalogueCache<IAiChatModel[]>;
	load: () => Promise<IAiChatModel[]>;
}): Promise<IAiChatModelList> {
	try {
		const { value, stale } = await options.cache.get('public', options.load);
		return value.length ? { models: value, source: 'live', stale } : { models: options.curated, source: 'curated' };
	} catch {
		return { models: options.curated, source: 'curated' };
	}
}

/**
 * Resolve a catalogue that requires the tenant's API key.
 *
 * Two rules live here rather than in each provider, because getting either wrong is a real bug and
 * four near-identical copies is four chances to get it wrong:
 *
 * 1. **No credential → curated.** These endpoints answer 401 without one, so calling them is a
 *    guaranteed timeout-then-fallback on a settings page that has not been configured yet — which is
 *    exactly when it is most often opened.
 * 2. **A custom `baseUrl` → curated.** The key then belongs to *that* endpoint, not to the vendor.
 *    Sending it to the vendor's official catalogue host would hand a third party a credential it
 *    never issued, and a proxy's model list is not the vendor's list anyway. This is the one rule
 *    here that is a security property rather than an ergonomic one.
 *
 * Fails open: any error yields `curated`.
 */
export async function keyedCatalogue(options: {
	credentials: IAiProviderCredentials | null;
	curated: IAiChatModel[];
	cache: ICatalogueCache<IAiChatModel[]>;
	load: (credentials: IAiProviderCredentials) => Promise<IAiChatModel[]>;
}): Promise<IAiChatModelList> {
	const { credentials, curated } = options;
	if (!credentials?.apiKey || credentials.baseUrl) return { models: curated, source: 'curated' };
	try {
		const { value, stale } = await options.cache.get(credentialCacheKey(credentials), () =>
			options.load(credentials)
		);
		return value.length ? { models: value, source: 'live', stale } : { models: curated, source: 'curated' };
	} catch {
		return { models: curated, source: 'curated' };
	}
}

/**
 * Resolve the catalogue of a SELF-HOSTED / local server (Speaches, LocalAI, whisper.cpp, an
 * OpenAI-compatible gateway) — the exact case {@link keyedCatalogue} deliberately refuses.
 *
 * `keyedCatalogue` returns curated whenever a custom `baseUrl` is set, because for a VENDOR provider
 * the key then belongs to that endpoint and must not be sent to the vendor's official catalogue host.
 * For a local server there is no vendor host: the tenant's base URL IS the server, and its `/models`
 * is the only list worth showing (which whisper models are actually installed, which chat models are
 * loaded). So this calls `load(baseUrl, credentials)` against that base URL — and NOTHING is fetched
 * when there is no base URL to fetch from.
 *
 * Fails open like the others: any error yields `curated`. The cache key includes the base URL as
 * well as the (hashed) key, since two tenants can point at two different servers.
 */
export async function selfHostedCatalogue(options: {
	credentials: IAiProviderCredentials | null;
	/** Address used when the credential carries none (a provider's conventional local default). */
	defaultBaseUrl?: string;
	curated: IAiChatModel[];
	cache: ICatalogueCache<IAiChatModel[]>;
	load: (baseUrl: string, credentials: IAiProviderCredentials | null) => Promise<IAiChatModel[]>;
}): Promise<IAiChatModelList> {
	const { credentials, curated } = options;
	const baseUrl = credentials?.baseUrl || options.defaultBaseUrl;
	if (!baseUrl) return { models: curated, source: 'curated' };
	try {
		const key = `${baseUrl}|${credentialCacheKey(credentials)}`;
		const { value, stale } = await options.cache.get(key, () => options.load(baseUrl, credentials));
		return value.length ? { models: value, source: 'live', stale } : { models: curated, source: 'curated' };
	} catch {
		return { models: curated, source: 'curated' };
	}
}

/**
 * Merge a curated list with a fetched one, curated first and ids de-duplicated.
 *
 * For providers whose catalogue endpoint cannot express "supports tool calling": the curated entries
 * are the ones we have actually verified work with the agent, so they lead, and the fetched remainder
 * is offered below them rather than replacing them.
 */
export function mergeCatalogue(curated: IAiChatModel[], fetched: IAiChatModel[]): IAiChatModel[] {
	const seen = new Set(curated.map((model) => model.id));
	return [...curated, ...fetched.filter((model) => !seen.has(model.id))];
}

/** Turn a raw model id into something readable when the provider offers no display name. */
export function prettifyModelId(id: string): string {
	const tail = id.includes('/') ? (id.split('/').pop() ?? id) : id;
	return tail
		.replace(/[-_]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/\b\w/g, (c) => c.toUpperCase());
}
