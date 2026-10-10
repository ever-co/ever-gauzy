/**
 * Per-request batching for relation field resolvers.
 *
 * A connection of a hundred parents, each selecting the same relation, is a hundred and one queries
 * unless something groups them. This class is that grouping: every `load` inside one execution tick
 * joins one batch, the batch function is called once for the whole set of distinct keys, and each
 * caller receives its own value back.
 *
 * The class deliberately depends on nothing: no Nest container, no ORM, no `dataloader`, so its
 * behaviour is a property of this file rather than of a dependency that may or may not be installed.
 * The resolver-facing API is the three methods below.
 *
 *   const lines = await context.loaders
 *       .for('order_line:orderId', (ids) => this.orderLineService.findByOrderIds(ids))
 *       .loadMany(orders.map((order) => order.id));
 *
 * Design notes that matter to a caller:
 *
 * - **One batch per tick.** Loads are flushed on a microtask, so every resolver that runs
 *   synchronously while the executor walks a page contributes to the same batch. A load issued from
 *   a later microtask opens the next batch, which is the behaviour a caller should expect rather
 *   than a limitation.
 * - **Keyed by the foreign key**, never by the whole parent object: the key is what the batch
 *   function queries on.
 * - **Values are cached, failures are not.** Selecting the same relation twice in one operation costs
 *   one query, but a batch that failed is retried rather than remembered: a transport failure is a
 *   condition, not a value.
 */

/**
 * How a loader batches.
 */
export interface RelationLoaderOptions {
	/** The largest key set one call to the batch function may receive. */
	readonly maxBatchSize?: number;
	/** Whether a resolved value is remembered for the life of the loader. */
	readonly cache?: boolean;
	/** How the flush is scheduled. Defaults to a microtask. */
	readonly schedule?: (flush: () => void) => void;
	/** A label used in diagnostics, normally `<relation>:<key>`. */
	readonly name?: string;
}

/**
 * What a loader has done, for tests and for a diagnostic endpoint.
 */
export interface RelationLoaderStats {
	/** How many times the batch function was called. */
	readonly batches: number;
	/** How many keys were handed to the batch function, across all batches. */
	readonly keys: number;
	/** How many loads were answered from the cache without touching the batch function. */
	readonly cacheHits: number;
	/** Whether the loader has been released. */
	readonly disposed: boolean;
	/** Keys currently cached. */
	readonly cached: number;
}

/**
 * Raised when a batch cannot be trusted to line up with the keys it was given.
 *
 * Assigning values to the wrong keys would be worse than failing: a relation resolved from another
 * row is a wrong answer, and in a multi-tenant deployment a wrong answer of that shape is a data
 * leak. The loader therefore refuses a mismatched batch instead of guessing.
 */
export class RelationBatchError extends Error {
	readonly code = 'RELATION_BATCH_MISMATCH';

	constructor(message: string) {
		super(message);
		this.name = 'RelationBatchError';
	}
}

/**
 * Raised when a load is issued after its operation ended.
 *
 * The loader belongs to one GraphQL operation. A resolver that holds it past that point is a bug,
 * and a rejection surfaces it as a field error rather than as a request that never finishes.
 */
export class RelationLoaderDisposedError extends Error {
	readonly code = 'RELATION_LOADER_RELEASED';

	constructor(name: string) {
		super(`The relation loader "${name}" was released with its request and cannot be used again.`);
		this.name = 'RelationLoaderDisposedError';
	}
}

/**
 * The default batch size. A larger key set is split, so a two-thousand-row page costs two queries
 * rather than one statement with two thousand bind parameters.
 */
export const DEFAULT_RELATION_BATCH_SIZE = 1000;

/**
 * One caller waiting for one key.
 */
export interface PendingLoad<V> {
	readonly resolve: (value: V) => void;
	readonly reject: (error: Error) => void;
}

/**
 * The scheduler used when the caller does not supply one.
 *
 * @param flush The flush to run.
 */
function scheduleMicrotask(flush: () => void): void {
	if (typeof queueMicrotask === 'function') {
		queueMicrotask(flush);
		return;
	}

	Promise.resolve().then(flush);
}

/**
 * Groups the loads of one tick into batches.
 */
export class RelationLoader<K, V> {
	private readonly batchFn: (keys: readonly K[]) => Promise<readonly (V | Error)[]>;
	private readonly maxBatchSize: number;
	private readonly cacheEnabled: boolean;
	private readonly schedule: (flush: () => void) => void;
	private readonly name: string;

	private readonly pending = new Map<K, PendingLoad<V>[]>();
	private readonly cache = new Map<K, Promise<V>>();

	private scheduled = false;
	private disposed = false;
	private batches = 0;
	private keyCount = 0;
	private cacheHits = 0;

	/**
	 * @param batchFn One repository call for a set of keys, returning one entry per key in the same
	 * order. An entry may be an `Error`, which fails only that key.
	 * @param options How to batch.
	 */
	constructor(
		batchFn: (keys: readonly K[]) => Promise<readonly (V | Error)[]>,
		options: RelationLoaderOptions = {}
	) {
		if (typeof batchFn !== 'function') {
			throw new TypeError('A relation loader needs a batch function.');
		}

		this.batchFn = batchFn;
		this.maxBatchSize = Math.max(1, Math.floor(options.maxBatchSize ?? DEFAULT_RELATION_BATCH_SIZE));
		this.cacheEnabled = options.cache ?? true;
		this.schedule = options.schedule ?? scheduleMicrotask;
		this.name = options.name ?? 'relation';
	}

	/**
	 * The label this loader reports in diagnostics.
	 */
	get label(): string {
		return this.name;
	}

	/**
	 * What this loader has done so far.
	 */
	get stats(): RelationLoaderStats {
		return {
			batches: this.batches,
			keys: this.keyCount,
			cacheHits: this.cacheHits,
			disposed: this.disposed,
			cached: this.cache.size
		};
	}

	/**
	 * Loads one key.
	 *
	 * @param key The foreign key of the relation, never the parent object.
	 * @returns The value for that key.
	 */
	load(key: K): Promise<V> {
		if (this.disposed) {
			return Promise.reject(new RelationLoaderDisposedError(this.name));
		}

		if (this.cacheEnabled) {
			const cached = this.cache.get(key);
			if (cached) {
				this.cacheHits += 1;
				return cached;
			}
		}

		const promise = new Promise<V>((resolve, reject) => {
			const waiting = this.pending.get(key) ?? [];
			waiting.push({ resolve, reject });
			this.pending.set(key, waiting);
		});

		if (this.cacheEnabled) {
			this.cache.set(key, promise);
		}

		this.scheduleFlush();

		return promise;
	}

	/**
	 * Loads several keys.
	 *
	 * Never rejects: a key whose value could not be read comes back as an `Error` in its position, so
	 * one failing relation cannot fail a page.
	 *
	 * @param keys The foreign keys.
	 * @returns One entry per key, in the order given.
	 */
	loadMany(keys: readonly K[]): Promise<readonly (V | Error)[]> {
		return Promise.all(
			keys.map((key) =>
				this.load(key).then(
					(value) => value,
					(error: Error) => error
				)
			)
		);
	}

	/**
	 * Forgets one key, so the next load of it queries again.
	 *
	 * @param key The key.
	 */
	clear(key: K): void {
		this.cache.delete(key);
	}

	/**
	 * Forgets every cached value without releasing the loader.
	 */
	clearAll(): void {
		this.cache.clear();
	}

	/**
	 * Releases the loader.
	 *
	 * Called when the operation that owns it ends. Everything still waiting is failed rather than
	 * left hanging, and every later load fails too, because the request scope it belonged to is gone.
	 */
	dispose(): void {
		if (this.disposed) {
			return;
		}

		this.disposed = true;
		const error = new RelationLoaderDisposedError(this.name);

		for (const waiting of this.pending.values()) {
			for (const load of waiting) {
				load.reject(error);
			}
		}

		this.pending.clear();
		this.cache.clear();
	}

	/**
	 * Schedules the flush of the current tick, once.
	 */
	private scheduleFlush(): void {
		if (this.scheduled) {
			return;
		}

		this.scheduled = true;
		this.schedule(() => {
			this.scheduled = false;
			void this.flush();
		});
	}

	/**
	 * Runs the batch function for everything that is waiting.
	 */
	private async flush(): Promise<void> {
		if (this.disposed || this.pending.size === 0) {
			return;
		}

		const batch = new Map(this.pending);
		this.pending.clear();

		const keys = Array.from(batch.keys());

		for (let start = 0; start < keys.length; start += this.maxBatchSize) {
			const chunk = keys.slice(start, start + this.maxBatchSize);
			void this.dispatch(chunk, batch);
		}
	}

	/**
	 * Calls the batch function for one chunk and distributes the results.
	 *
	 * @param keys The chunk's keys.
	 * @param batch The loads waiting on those keys.
	 */
	private async dispatch(chunk: readonly K[], batch: Map<K, PendingLoad<V>[]>): Promise<void> {
		this.batches += 1;
		this.keyCount += chunk.length;

		let values: readonly (V | Error)[];

		try {
			values = await this.batchFn(chunk);
		} catch (error) {
			const failure = error instanceof Error ? error : new Error(String(error));
			for (const key of chunk) {
				this.settle(batch, key, failure);
			}
			return;
		}

		if (!Array.isArray(values) || values.length !== chunk.length) {
			// The batch function promised one entry per key and did not deliver it. Guessing which
			// value belongs to which key is exactly the mistake this check exists to prevent.
			const failure = new RelationBatchError(
				`The batch function of "${this.name}" returned ${Array.isArray(values) ? values.length : 'no'} entries for ${chunk.length} keys. ` +
					'It must return exactly one entry per key, in the order the keys were given.'
			);
			for (const key of chunk) {
				this.settle(batch, key, failure);
			}
			return;
		}

		chunk.forEach((key, index) => {
			this.settle(batch, key, values[index]);
		});
	}

	/**
	 * Hands one key's result to its waiters.
	 *
	 * @param batch The loads waiting on the current chunk.
	 * @param key The key.
	 * @param value The value, or the error that stands in for it.
	 */
	private settle(batch: Map<K, PendingLoad<V>[]>, key: K, value: V | Error): void {
		const waiting = batch.get(key) ?? [];

		if (value instanceof Error) {
			// A failed key is not cached: a batch that failed is retried rather than remembered.
			if (this.cacheEnabled) {
				this.cache.delete(key);
			}
			for (const load of waiting) {
				load.reject(value);
			}
			return;
		}

		if (this.cacheEnabled) {
			this.cache.set(key, Promise.resolve(value));
		}
		for (const load of waiting) {
			load.resolve(value);
		}
	}
}
