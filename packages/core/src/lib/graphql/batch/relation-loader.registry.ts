import {
	DEFAULT_RELATION_BATCH_SIZE,
	RelationLoader,
	RelationLoaderOptions
} from './relation-loader';

/**
 * The relation loaders of one GraphQL operation.
 *
 * The registry is created once per request, in the GraphQL context factory, and released when the
 * operation ends. That is what keeps one caller's cached rows out of another caller's response: a
 * value loaded for one request is invisible to the next, so a row changed between two requests is
 * observed rather than served from a previous caller's cache.
 *
 * Two resolvers that ask for the same relation in one operation get the *same* loader, so the second
 * selection is answered from the first one's cache. Two resolvers that ask for different relations
 * get different loaders, so neither can delay or fail the other's batch.
 */

/**
 * What the registry has done, for tests and for a diagnostic endpoint.
 */
export interface RelationLoaderRegistryStats {
	/** Loaders opened in this operation. */
	readonly loaders: number;
	/** Batch function calls, summed over the loaders. */
	readonly batches: number;
	/** Keys handed to batch functions, summed over the loaders. */
	readonly keys: number;
	/** Loads answered from a cache, summed over the loaders. */
	readonly cacheHits: number;
}

/**
 * The loaders of one operation, keyed by the relation they resolve.
 */
export class RelationLoaderRegistry {
	private readonly loaders = new Map<string, RelationLoader<unknown, unknown>>();
	private readonly options: RelationLoaderOptions;
	private disposed = false;

	/**
	 * @param options Defaults applied to every loader this registry opens. A relation that needs a
	 * different batch size declares it where it is registered.
	 */
	constructor(options: RelationLoaderOptions = {}) {
		this.options = { maxBatchSize: DEFAULT_RELATION_BATCH_SIZE, ...options };
	}

	/**
	 * How many relations this operation has batched.
	 */
	get size(): number {
		return this.loaders.size;
	}

	/**
	 * The relation keys this operation has opened a loader for.
	 */
	get keys(): readonly string[] {
		return Array.from(this.loaders.keys());
	}

	/**
	 * The loader of one relation, opening it on first use.
	 *
	 * The key is the relation and the column it is joined on — `order_line:orderId` — never the
	 * parent object: the key is what makes two selections of the same relation share a batch.
	 *
	 * @param key The relation key.
	 * @param batchFn One repository call for a set of keys. It must be scoped to the caller's tenant
	 * and organization, because batching must not be able to widen what a caller may read.
	 * @param options Overrides for this relation.
	 * @returns The loader, reused when the key has been seen.
	 */
	for<K, V>(
		key: string,
		batchFn: (keys: readonly K[]) => Promise<readonly (V | Error)[]>,
		options: RelationLoaderOptions = {}
	): RelationLoader<K, V> {
		if (this.disposed) {
			throw new Error(
				`The relation loader registry of this operation was released and cannot open "${key}". ` +
					'A loader belongs to exactly one GraphQL operation.'
			);
		}

		const existing = this.loaders.get(key);
		if (existing) {
			// The first registration of a key owns it, so a second resolver selecting the same
			// relation shares the batch and the cache rather than opening a competing loader.
			return existing as RelationLoader<K, V>;
		}

		const loader = new RelationLoader<K, V>(batchFn, { ...this.options, ...options, name: key });
		this.loaders.set(key, loader as RelationLoader<unknown, unknown>);

		return loader;
	}

	/**
	 * Whether a relation already has a loader in this operation.
	 *
	 * @param key The relation key.
	 * @returns True when a loader exists.
	 */
	has(key: string): boolean {
		return this.loaders.has(key);
	}

	/**
	 * The loader of a relation, when one exists.
	 *
	 * @param key The relation key.
	 * @returns The loader, or undefined.
	 */
	get<K, V>(key: string): RelationLoader<K, V> | undefined {
		return this.loaders.get(key) as RelationLoader<K, V> | undefined;
	}

	/**
	 * What every loader in this operation has done.
	 */
	get stats(): RelationLoaderRegistryStats {
		let batches = 0;
		let keys = 0;
		let cacheHits = 0;

		for (const loader of this.loaders.values()) {
			const stats = loader.stats;
			batches += stats.batches;
			keys += stats.keys;
			cacheHits += stats.cacheHits;
		}

		return { loaders: this.loaders.size, batches, keys, cacheHits };
	}

	/**
	 * Releases every loader of the operation.
	 *
	 * Everything still waiting fails, and a resolver that kept a loader past the end of its operation
	 * gets a rejection rather than a value served from a request that has already been answered.
	 */
	clearAll(): void {
		for (const loader of this.loaders.values()) {
			loader.dispose();
		}

		this.loaders.clear();
		this.disposed = true;
	}
}
