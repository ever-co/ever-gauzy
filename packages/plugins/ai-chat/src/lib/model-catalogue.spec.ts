import type { IAiChatModel } from '@gauzy/contracts';
import {
	createCatalogueCache,
	credentialCacheKey,
	keyedCatalogue,
	mergeCatalogue,
	prettifyModelId,
	publicCatalogue
} from './model-catalogue';
import type { IAiProviderCredentials } from './provider.types';

const model = (id: string): IAiChatModel => ({ id, label: id, providerId: 'test' });

const CURATED: IAiChatModel[] = [model('curated-a'), model('curated-b')];
const FETCHED: IAiChatModel[] = [model('live-a'), model('live-b')];

const credentials = (overrides: Partial<IAiProviderCredentials> = {}): IAiProviderCredentials => ({
	apiKey: 'sk-test-key',
	source: 'tenant',
	...overrides
});

describe('createCatalogueCache', () => {
	it('calls the loader once and serves the cached value while fresh', async () => {
		const cache = createCatalogueCache<IAiChatModel[]>({ ttlMs: 60_000 });
		const load = jest.fn().mockResolvedValue(FETCHED);

		const first = await cache.get('key', load);
		const second = await cache.get('key', load);

		expect(load).toHaveBeenCalledTimes(1);
		expect(first).toEqual({ value: FETCHED, stale: false });
		expect(second).toEqual({ value: FETCHED, stale: false });
	});

	it('de-duplicates concurrent loads for the same key', async () => {
		const cache = createCatalogueCache<IAiChatModel[]>();
		let resolveLoad: (models: IAiChatModel[]) => void = () => undefined;
		const load = jest.fn().mockImplementation(
			() =>
				new Promise<IAiChatModel[]>((resolve) => {
					resolveLoad = resolve;
				})
		);

		const calls = Promise.all([cache.get('key', load), cache.get('key', load), cache.get('key', load)]);
		resolveLoad(FETCHED);

		expect(await calls).toEqual([
			{ value: FETCHED, stale: false },
			{ value: FETCHED, stale: false },
			{ value: FETCHED, stale: false }
		]);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it('rethrows a first failure but remembers it, so the next call does not retry immediately', async () => {
		const cache = createCatalogueCache<IAiChatModel[]>({ negativeTtlMs: 60_000 });
		const load = jest.fn().mockRejectedValue(new Error('upstream down'));

		await expect(cache.get('key', load)).rejects.toThrow('upstream down');
		// A downed provider must not turn every settings page load into another 8s timeout.
		await expect(cache.get('key', load)).resolves.toEqual({ value: [], stale: true });
		expect(load).toHaveBeenCalledTimes(1);
	});

	it('keeps serving the previous value as stale when a refresh fails', async () => {
		const cache = createCatalogueCache<IAiChatModel[]>({ ttlMs: -1, negativeTtlMs: 60_000 });
		const load = jest.fn().mockResolvedValueOnce(FETCHED).mockRejectedValue(new Error('flaky'));

		await cache.get('key', load);
		// ttlMs of -1 makes the entry stale immediately, forcing the refresh.
		await expect(cache.get('key', load)).rejects.toThrow('flaky');
		// Stale-but-real beats dropping to nothing: this is what stops a blip emptying the dropdown.
		await expect(cache.get('key', load)).resolves.toEqual({ value: FETCHED, stale: true });
	});

	it('bounds itself, evicting the least recently written key', async () => {
		const cache = createCatalogueCache<IAiChatModel[]>({ maxEntries: 2 });
		const load = jest.fn().mockImplementation(() => Promise.resolve(FETCHED));

		await cache.get('a', load);
		await cache.get('b', load);
		await cache.get('c', load);
		// 'a' was evicted, so it loads again; 'c' is still cached.
		await cache.get('a', load);
		await cache.get('c', load);

		expect(load).toHaveBeenCalledTimes(4);
	});
});

describe('credentialCacheKey', () => {
	it('never contains the secret', () => {
		const key = credentialCacheKey(credentials({ apiKey: 'sk-super-secret-value' }));
		expect(key).not.toContain('sk-super-secret-value');
		expect(key).not.toContain('secret');
	});

	it('distinguishes different credentials and matches identical ones', () => {
		expect(credentialCacheKey(credentials({ apiKey: 'one' }))).toBe(
			credentialCacheKey(credentials({ apiKey: 'one' }))
		);
		expect(credentialCacheKey(credentials({ apiKey: 'one' }))).not.toBe(
			credentialCacheKey(credentials({ apiKey: 'two' }))
		);
		// The base URL is part of the identity: the same key against a different endpoint can see a
		// different catalogue.
		expect(credentialCacheKey(credentials({ baseUrl: 'https://a.example' }))).not.toBe(
			credentialCacheKey(credentials({ baseUrl: 'https://b.example' }))
		);
	});

	it('has a stable key for the absence of a credential', () => {
		expect(credentialCacheKey(null)).toBe('anonymous');
		expect(credentialCacheKey(credentials({ apiKey: '' }))).toBe('anonymous');
	});
});

describe('keyedCatalogue', () => {
	it('returns the curated list without calling upstream when there is no credential', async () => {
		const load = jest.fn();
		const result = await keyedCatalogue({
			credentials: null,
			curated: CURATED,
			cache: createCatalogueCache<IAiChatModel[]>(),
			load
		});

		expect(result).toEqual(CURATED);
		expect(load).not.toHaveBeenCalled();
	});

	it('never sends a credential to the vendor when a custom base URL is configured', async () => {
		const load = jest.fn();
		const result = await keyedCatalogue({
			credentials: credentials({ baseUrl: 'https://proxy.internal/v1' }),
			curated: CURATED,
			cache: createCatalogueCache<IAiChatModel[]>(),
			load
		});

		// The key belongs to the proxy, not to the vendor. Fetching the vendor's catalogue with it
		// would hand a third party a credential it never issued.
		expect(result).toEqual(CURATED);
		expect(load).not.toHaveBeenCalled();
	});

	it('returns the fetched list when the call succeeds', async () => {
		const result = await keyedCatalogue({
			credentials: credentials(),
			curated: CURATED,
			cache: createCatalogueCache<IAiChatModel[]>(),
			load: async () => FETCHED
		});

		expect(result).toEqual(FETCHED);
	});

	it('fails open to the curated list when the fetch throws', async () => {
		const result = await keyedCatalogue({
			credentials: credentials(),
			curated: CURATED,
			cache: createCatalogueCache<IAiChatModel[]>(),
			load: async () => {
				throw new Error('401 Unauthorized');
			}
		});

		expect(result).toEqual(CURATED);
	});

	it('treats an empty result as a failed fetch rather than an empty dropdown', async () => {
		const result = await keyedCatalogue({
			credentials: credentials(),
			curated: CURATED,
			cache: createCatalogueCache<IAiChatModel[]>(),
			load: async () => []
		});

		expect(result).toEqual(CURATED);
	});
});

describe('publicCatalogue', () => {
	it('returns the fetched list when the call succeeds', async () => {
		const result = await publicCatalogue({
			curated: CURATED,
			cache: createCatalogueCache<IAiChatModel[]>(),
			load: async () => FETCHED
		});

		expect(result).toEqual(FETCHED);
	});

	it('fails open to the curated list on error and on an empty result', async () => {
		const onError = await publicCatalogue({
			curated: CURATED,
			cache: createCatalogueCache<IAiChatModel[]>(),
			load: async () => {
				throw new Error('network');
			}
		});
		const onEmpty = await publicCatalogue({
			curated: CURATED,
			cache: createCatalogueCache<IAiChatModel[]>(),
			load: async () => []
		});

		expect(onError).toEqual(CURATED);
		expect(onEmpty).toEqual(CURATED);
	});
});

describe('mergeCatalogue', () => {
	it('keeps the curated entries first and drops duplicates from the fetched list', () => {
		const merged = mergeCatalogue(CURATED, [model('curated-a'), model('live-a')]);

		expect(merged.map((entry) => entry.id)).toEqual(['curated-a', 'curated-b', 'live-a']);
	});
});

describe('prettifyModelId', () => {
	it.each([
		['claude-sonnet-5', 'Claude Sonnet 5'],
		['anthropic/claude-opus-5', 'Claude Opus 5'],
		['gpt_4o_mini', 'Gpt 4o Mini']
	])('turns %s into %s', (id, expected) => {
		expect(prettifyModelId(id)).toBe(expected);
	});
});
