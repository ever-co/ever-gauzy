import { createThrottlerStorage, RedisThrottlerStorage } from './redis-throttler.storage';

/**
 * The shared rate-limit bucket store.
 *
 * With the default in-process store, "5 login attempts per minute" meant `5 × replicas` per minute
 * and reset on every rollout — the production tenant runs several API pods. These tests drive the
 * store through a fake Redis so the counting and blocking semantics are pinned without a server.
 */
describe('RedisThrottlerStorage', () => {
	/** Minimal in-memory stand-in for the node-redis surface the storage actually uses. */
	const fakeRedis = () => {
		const values = new Map<string, number>();
		const expiries = new Map<string, number>();

		const readTtl = (key: string) => {
			if (!values.has(key)) return -2;
			const expiresAt = expiries.get(key);
			if (expiresAt === undefined) return -1;
			return Math.max(expiresAt - Date.now(), -2);
		};

		const client = {
			pTTL: jest.fn(async (key: string) => readTtl(key)),
			pExpire: jest.fn(async (key: string, ms: number) => {
				expiries.set(key, Date.now() + ms);
				return true;
			}),
			set: jest.fn(async (key: string, _value: string, options: { PX: number }) => {
				values.set(key, 1);
				expiries.set(key, Date.now() + options.PX);
				return 'OK';
			}),
			del: jest.fn(async (key: string) => {
				values.delete(key);
				expiries.delete(key);
				return 1;
			}),
			multi: () => {
				const queue: Array<() => number> = [];
				const chain = {
					incr(key: string) {
						queue.push(() => {
							const next = (values.get(key) ?? 0) + 1;
							values.set(key, next);
							return next;
						});
						return chain;
					},
					pTTL(key: string) {
						queue.push(() => readTtl(key));
						return chain;
					},
					async exec() {
						return queue.map((run) => run());
					}
				};
				return chain;
			}
		};

		return { client, values, expiries };
	};

	it('counts hits and reports the bucket state', async () => {
		const { client } = fakeRedis();
		const storage = new RedisThrottlerStorage(client as any);

		const first = await storage.increment('key', 60_000, 5, 60_000, 'default');
		expect(first.totalHits).toBe(1);
		expect(first.isBlocked).toBe(false);
		expect(first.timeToExpire).toBeGreaterThan(0);

		const second = await storage.increment('key', 60_000, 5, 60_000, 'default');
		expect(second.totalHits).toBe(2);
	});

	it('blocks once the limit is exceeded and keeps blocking afterwards', async () => {
		const { client } = fakeRedis();
		const storage = new RedisThrottlerStorage(client as any);

		for (let i = 0; i < 5; i++) {
			expect((await storage.increment('key', 60_000, 5, 60_000, 'default')).isBlocked).toBe(false);
		}

		const sixth = await storage.increment('key', 60_000, 5, 60_000, 'default');
		expect(sixth.isBlocked).toBe(true);
		expect(sixth.timeToBlockExpire).toBeGreaterThan(0);

		// The block, not the counter, is what the next request sees.
		const seventh = await storage.increment('key', 60_000, 5, 60_000, 'default');
		expect(seventh.isBlocked).toBe(true);
	});

	it('keeps separate buckets per key and per named throttler', async () => {
		const { client } = fakeRedis();
		const storage = new RedisThrottlerStorage(client as any);

		await storage.increment('a', 60_000, 5, 60_000, 'default');
		await storage.increment('a', 60_000, 5, 60_000, 'default');

		expect((await storage.increment('b', 60_000, 5, 60_000, 'default')).totalHits).toBe(1);
		expect((await storage.increment('a', 60_000, 5, 60_000, 'strict')).totalHits).toBe(1);
	});

	it('degrades to the in-process store instead of failing the request when Redis errors', async () => {
		const { client } = fakeRedis();
		client.pTTL.mockRejectedValue(new Error('connection lost'));
		jest.spyOn(console, 'error').mockImplementation(() => undefined);

		const storage = new RedisThrottlerStorage(client as any);
		const record = await storage.increment('key', 60_000, 5, 60_000, 'default');

		expect(record.totalHits).toBe(1);
		expect(record.isBlocked).toBe(false);
	});
});

describe('createThrottlerStorage', () => {
	it('warns and defers to the module default when no Redis client is configured', () => {
		const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
		try {
			expect(createThrottlerStorage(null)).toBeUndefined();
			expect(String(warn.mock.calls[0][0])).toContain('REDIS_ENABLED');
		} finally {
			warn.mockRestore();
		}
	});

	it('uses Redis when a client is available', () => {
		expect(createThrottlerStorage({} as any)).toBeInstanceOf(RedisThrottlerStorage);
	});
});
