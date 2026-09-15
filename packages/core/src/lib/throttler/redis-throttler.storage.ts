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
	 * @param hitKey - Key holding the hit counter.
	 * @param blockKey - Key holding the block marker.
	 * @param ttl - Window length in milliseconds.
	 * @param limit - Hits allowed within the window.
	 * @param blockDuration - How long to block once the limit is exceeded, in milliseconds.
	 * @returns The bucket state after the hit.
	 */
	private async incrementInRedis(
		hitKey: string,
		blockKey: string,
		ttl: number,
		limit: number,
		blockDuration: number
	): Promise<ThrottlerStorageRecord> {
		const blockTtl = await this.client.pTTL(blockKey);

		if (blockTtl > 0) {
			const seconds = Math.ceil(blockTtl / 1000);
			// Still blocked: report a hit count past the limit so the guard raises 429 without
			// the counter itself having to survive the block window.
			return {
				totalHits: limit + 1,
				timeToExpire: seconds,
				isBlocked: true,
				timeToBlockExpire: seconds
			};
		}

		const results = await this.client.multi().incr(hitKey).pTTL(hitKey).exec();
		const totalHits = Number(results?.[0] ?? 0);
		let remainingTtl = Number(results?.[1] ?? -1);

		// -1 = key exists with no expiry, -2 = key vanished between the increment and the TTL read.
		// Either way the window needs (re)arming, or a counter would live forever and block the
		// key permanently.
		if (!Number.isFinite(remainingTtl) || remainingTtl < 0) {
			await this.client.pExpire(hitKey, ttl);
			remainingTtl = ttl;
		}

		if (totalHits > limit) {
			await this.client.set(blockKey, '1', { PX: blockDuration });
			await this.client.del(hitKey);

			return {
				totalHits,
				timeToExpire: Math.ceil(blockDuration / 1000),
				isBlocked: true,
				timeToBlockExpire: Math.ceil(blockDuration / 1000)
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
