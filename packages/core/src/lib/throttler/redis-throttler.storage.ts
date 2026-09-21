import { Logger } from '@nestjs/common';
import { ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';
import { createClient } from 'redis';

type RedisClient = ReturnType<typeof createClient>;

// `ThrottlerStorageRecord` lives in a module the package's barrel does not re-export, so derive it
// from the interface rather than reaching into `@nestjs/throttler/dist/...`.
type ThrottlerStorageRecord = Awaited<ReturnType<ThrottlerStorage['increment']>>;

const KEY_PREFIX = 'throttle:';

/**
 * How long one bucket update may take before the request stops waiting for Redis.
 *
 * A rejected command falls back to the in-process store, but a command issued while the client is
 * merely DISCONNECTED does not reject: node-redis parks it in its offline queue and the promise
 * stays pending for as long as the reconnect loop runs. This store sits behind the GLOBAL throttler
 * guard, so a pending promise there stalls every request on the API, not just this one — hence a
 * deadline rather than an unbounded await.
 */
export const REDIS_THROTTLER_TIMEOUT_MS = 250;

/**
 * Rate-limit bucket store shared by every API replica.
 *
 * `@nestjs/throttler`'s default storage is a `Map` inside one Node process. Production runs several
 * API pods behind one ingress, so "5 login attempts per minute" was really `5 × replicas` per
 * minute, and every rollout reset the counters. Keeping the buckets in Redis makes the configured
 * limit the actual limit regardless of how many replicas are serving.
 *
 * Falls back to the in-process store when Redis is not configured or a command fails, so a Redis
 * outage degrades the limiter to its previous per-pod behaviour instead of taking authentication
 * down with it.
 */
export class RedisThrottlerStorage implements ThrottlerStorage {
	private readonly logger = new Logger(RedisThrottlerStorage.name);
	private readonly fallback = new ThrottlerStorageService();

	constructor(private readonly client: RedisClient) {}

	/**
	 * Registers one hit against `key` and reports the bucket state.
	 *
	 * Mirrors the semantics of the in-memory implementation: the counter expires `ttl` ms after the
	 * first hit in the window, exceeding `limit` sets a block for `blockDuration` ms, and the
	 * counter is cleared when the block is set so the window starts clean once the block lapses.
	 *
	 * @param key - Bucket key (already a hash of route + tracker).
	 * @param ttl - Window length in milliseconds.
	 * @param limit - Hits allowed within the window.
	 * @param blockDuration - How long to block once the limit is exceeded, in milliseconds.
	 * @param throttlerName - Name of the named throttler this hit belongs to.
	 * @returns The bucket state after the hit.
	 */
	async increment(
		key: string,
		ttl: number,
		limit: number,
		blockDuration: number,
		throttlerName: string
	): Promise<ThrottlerStorageRecord> {
		const hitKey = `${KEY_PREFIX}${throttlerName}:${key}`;
		const blockKey = `${hitKey}:blocked`;

		try {
			return await this.withDeadline(this.incrementInRedis(hitKey, blockKey, ttl, limit, blockDuration));
		} catch (error) {
			this.logger.error(`Redis throttler storage unavailable, falling back to in-memory: ${error?.message}`);
			return this.fallback.increment(key, ttl, limit, blockDuration, throttlerName);
		}
	}

	/**
	 * Rejects if `operation` has not settled within {@link REDIS_THROTTLER_TIMEOUT_MS}.
	 *
	 * @param operation - The Redis work to bound.
	 * @returns The operation's result.
	 */
	private withDeadline<T>(operation: Promise<T>): Promise<T> {
		let timer: NodeJS.Timeout;

		return Promise.race([
			operation,
			new Promise<never>((_, reject) => {
				timer = setTimeout(
					() => reject(new Error(`Redis did not answer within ${REDIS_THROTTLER_TIMEOUT_MS}ms`)),
					REDIS_THROTTLER_TIMEOUT_MS
				);
				timer.unref?.();
			})
		]).finally(() => clearTimeout(timer));
	}

	/**
	 * The Redis half of {@link increment}, kept separate so the whole sequence can be bounded by one
	 * deadline rather than each command individually.
	 *
	 * The block check and the hit are read in ONE `MULTI`, which Redis executes without interleaving.
	 * Reading the block marker in a separate round trip first let two concurrent requests both see "no
	 * block"; one then created the block and cleared the counter, and the other incremented the fresh
	 * counter and was admitted DURING the block. With the snapshot, every request whose hit lands after
	 * the block was set also sees the block, and every request whose hit lands before it sees a count
	 * that already includes the earlier hits.
	 *
	 * A client that is not connected is not asked at all: node-redis would park the commands in its
	 * offline queue and replay them on reconnect, long after this request fell back to the in-process
	 * store, double-counting it into the shared bucket.
	 *
	 * @param hitKey - Key holding the hit counter.
	 * @param blockKey - Key holding the block marker.
	 * @param ttl - Window length in milliseconds.
	 * @param limit - Hits allowed within the window.
	 * @param blockDuration - How long to block once the limit is exceeded, in milliseconds.
	 * @returns The bucket state after the hit.
	 * @throws Error when the client is not ready, so the caller takes the in-process fallback.
	 */
	private async incrementInRedis(
		hitKey: string,
		blockKey: string,
		ttl: number,
		limit: number,
		blockDuration: number
	): Promise<ThrottlerStorageRecord> {
		if (this.client.isReady === false) {
			throw new Error('Redis client is not connected');
		}

		const results = await this.client.multi().pTTL(blockKey).incr(hitKey).pTTL(hitKey).exec();
		const blockTtl = Number(results?.[0] ?? -2);
		const totalHits = Number(results?.[1] ?? 0);
		let remainingTtl = Number(results?.[2] ?? -1);

		if (blockTtl > 0) {
			// Still blocked. The hit recorded above must not survive into the window that follows
			// the block (the in-process store does not count hits while blocked either), so drop it.
			await this.client.del(hitKey);

			const seconds = Math.ceil(blockTtl / 1000);
			return {
				totalHits: Math.max(totalHits, limit + 1),
				timeToExpire: seconds,
				isBlocked: true,
				timeToBlockExpire: seconds
			};
		}

		// -1 = key exists with no expiry, -2 = key vanished between the increment and the TTL read.
		// Either way the window needs (re)arming, or a counter would live forever and block the
		// key permanently.
		if (!Number.isFinite(remainingTtl) || remainingTtl < 0) {
			await this.client.pExpire(hitKey, ttl);
			remainingTtl = ttl;
		}

		if (totalHits > limit) {
			// `ThrottlerGuard` resolves `blockDuration` to the ttl when none is configured, but Redis
			// rejects `PX 0`, and a rejected SET would silently hand this request to the per-process
			// fallback — so never ask for less than 1 ms. NX: a concurrent request that already set the
			// block owns its expiry; this one must not push it further out.
			const blockMs = Math.max(1, blockDuration);
			await this.client.set(blockKey, '1', { PX: blockMs, NX: true });
			await this.client.del(hitKey);

			return {
				totalHits,
				timeToExpire: Math.ceil(blockMs / 1000),
				isBlocked: true,
				timeToBlockExpire: Math.ceil(blockMs / 1000)
			};
		}

		return {
			totalHits,
			timeToExpire: Math.ceil(remainingTtl / 1000),
			isBlocked: false,
			timeToBlockExpire: 0
		};
	}
}

/**
 * Builds the throttler storage for this deployment.
 *
 * @param client - The shared Redis client, or null when Redis is not configured.
 * @returns A Redis-backed store, or `undefined` to let `ThrottlerModule` use its own in-memory one.
 */
export function createThrottlerStorage(client: RedisClient | null): ThrottlerStorage | undefined {
	if (!client) {
		// eslint-disable-next-line no-console
		console.warn(
			'Throttle buckets are per-process: with more than one API replica the effective rate limit ' +
				'is multiplied by the replica count. Set REDIS_ENABLED=true (plus REDIS_URL or ' +
				'REDIS_HOST/REDIS_PORT) to share them.'
		);
		return undefined;
	}

	return new RedisThrottlerStorage(client);
}
