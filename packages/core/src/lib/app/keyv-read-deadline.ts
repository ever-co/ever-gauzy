import { readNonNegativeIntEnv } from '../bootstrap/strict-int-env';

/**
 * A read deadline for the Redis (L2) layer of the API's cache.
 *
 * The cache is two layers: an in-memory L1 and Redis as L2, in Cacheable's "non-blocking" mode. Non-blocking only
 * covers WRITES: on every L1 miss Cacheable still awaits the Redis read (`processSecondaryForGetRawNonBlocking`
 * starts with `await secondary.getRaw(key)`). Those reads sit on the request path of the tenant-settings middleware
 * and of the permission and feature guards, and node-redis has no command timeout, so a Redis that stops answering
 * without closing the socket (a failover, a half-open connection) parked every request at its first cache miss.
 * Reads that take longer than the deadline now count as a miss; the caller then loads the value as it does for any
 * miss. `REDIS_CACHE_READ_TIMEOUT_MS` (default 250, like the throttler's Redis deadline), 0 disables it.
 */
export const DEFAULT_REDIS_CACHE_READ_TIMEOUT_MS = 250;

export function resolveRedisCacheReadTimeout(value: string | undefined): number {
	return readNonNegativeIntEnv('REDIS_CACHE_READ_TIMEOUT_MS', value, DEFAULT_REDIS_CACHE_READ_TIMEOUT_MS);
}

const READS: Record<string, (args: unknown[]) => unknown> = {
	get: () => undefined,
	getRaw: () => undefined,
	has: () => false,
	getMany: (args) => (Array.isArray(args[0]) ? args[0].map(() => undefined) : []),
	getManyRaw: (args) => (Array.isArray(args[0]) ? args[0].map(() => undefined) : []),
	hasMany: (args) => (Array.isArray(args[0]) ? args[0].map(() => false) : [])
};

/**
 * Bound the read methods of a Keyv-like store (`get`, `getRaw`, `has`, `getMany`, `getManyRaw`, `hasMany`) by
 * `timeoutMs`: past it they resolve as a miss. Writes are left alone (Cacheable does not await them in non-blocking
 * mode). Returns the same object.
 */
export function withKeyvReadDeadline<T extends object>(
	store: T,
	timeoutMs: number,
	logger: { warn: (message: string) => void } = console
): T {
	if (!timeoutMs || !store) {
		return store;
	}
	let lastWarning = 0;
	for (const [method, miss] of Object.entries(READS)) {
		const original = (store as any)[method];
		if (typeof original !== 'function') continue;
		(store as any)[method] = function (this: unknown, ...args: unknown[]) {
			let timer: NodeJS.Timeout;
			const deadline = new Promise((resolve) => {
				timer = setTimeout(() => {
					const now = Date.now();
					if (now - lastWarning > 10_000) {
						lastWarning = now;
						logger.warn(
							`Redis cache ${method} did not answer within ${timeoutMs}ms; treated as a cache miss.`
						);
					}
					resolve(miss(args));
				}, timeoutMs);
				timer.unref?.();
			});
			const read = Promise.resolve(original.apply(store, args));
			return Promise.race([read, deadline]).finally(() => clearTimeout(timer));
		};
	}
	return store;
}
