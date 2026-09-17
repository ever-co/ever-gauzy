import { createThrottlerStorage, RedisThrottlerStorage } from './redis-throttler.storage';

/**
 * The shared rate-limit bucket store.
 *
 * With the default in-process store, "5 login attempts per minute" meant `5 × replicas` per minute
 * and reset on every rollout — the production tenant runs several API pods. These tests drive the
 * store through a fake Redis so the counting and blocking semantics are pinned without a server.
 */
describe('RedisThrottlerStorage', () => {
	/**
	 * Minimal in-memory stand-in for the node-redis surface the storage actually uses.
	 *
	 * Every command computes its result at the moment it is ISSUED, the way Redis executes it on
	 * arrival, while `hold` lets a test delay when that result is DELIVERED — which is how a slow
	 * round trip lets another request's commands run in between.
	 */
	const fakeRedis = () => {
		const values = new Map<string, number>();
		const expiries = new Map<string, number>();
		const latency: { hold: Promise<void> | null } = { hold: null };

		const readTtl = (key: string) => {
			if (!values.has(key)) return -2;
			const expiresAt = expiries.get(key);
			if (expiresAt === undefined) return -1;
			return Math.max(expiresAt - Date.now(), -2);
		};

		/** Delivers an already-computed result, after the pending `hold` if one is armed. */
		const deliver = async <T>(result: T): Promise<T> => {
			const hold = latency.hold;
			latency.hold = null;
			if (hold) {
				await hold;
			}
			return result;
		};

		const client = {
			isReady: true as boolean | undefined,
			pTTL: jest.fn((key: string) => deliver(readTtl(key))),
			pExpire: jest.fn((key: string, ms: number) => {
				expiries.set(key, Date.now() + ms);
				return deliver(true);
			}),
			set: jest.fn((key: string, _value: string, options: { PX: number; NX?: boolean }) => {
				if (options.NX && readTtl(key) !== -2) {
					return deliver(null);
				}
				values.set(key, 1);
				expiries.set(key, Date.now() + options.PX);
				return deliver('OK');
			}),
			del: jest.fn((key: string) => {
				values.delete(key);
				expiries.delete(key);
				return deliver(1);
			}),
			multi: jest.fn(() => {
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
					exec() {
						// MULTI/EXEC runs the whole queue atomically on arrival.
						return deliver(queue.map((run) => run()));
					}
				};
				return chain;
			})
		};

		return { client, values, expiries, latency };
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

	it('does not admit a request that raced the creation of a block', async () => {
		const { client, latency } = fakeRedis();
		const storage = new RedisThrottlerStorage(client as any);

		for (let i = 0; i < 5; i++) {
			await storage.increment('key', 60_000, 5, 60_000, 'default');
		}

		// B issues its first command now, but its answer is delayed until A has finished. Reading the
		// block marker in its own round trip let B see "not blocked", then increment the counter A
		// had just cleared, and be admitted in the middle of the block.
		let release: () => void = () => undefined;
		latency.hold = new Promise<void>((resolve) => (release = resolve));
		const racing = storage.increment('key', 60_000, 5, 60_000, 'default');

		const first = await storage.increment('key', 60_000, 5, 60_000, 'default');
		release();
		const second = await racing;

		expect(first.isBlocked).toBe(true);
		expect(second.isBlocked).toBe(true);

		// And the block is still what the next request sees.
		expect((await storage.increment('key', 60_000, 5, 60_000, 'default')).isBlocked).toBe(true);
	});

	it('does not extend a block that a concurrent request already set', async () => {
		const { client, expiries, latency } = fakeRedis();
		const storage = new RedisThrottlerStorage(client as any);

		for (let i = 0; i < 5; i++) {
			await storage.increment('key', 60_000, 5, 60_000, 'default');
		}

		// B's over-limit count is read first but acted on last, after A already set the block.
		let release: () => void = () => undefined;
		latency.hold = new Promise<void>((resolve) => (release = resolve));
		const late = storage.increment('key', 60_000, 5, 600_000, 'default');

		await storage.increment('key', 60_000, 5, 60_000, 'default');
		const blockKey = 'throttle:default:key:blocked';
		const expiresAt = expiries.get(blockKey);
		expect(expiresAt).toBeDefined();

		release();
		expect((await late).isBlocked).toBe(true);
		expect(expiries.get(blockKey)).toBe(expiresAt);
	});

	it('never asks Redis for a zero-length block', async () => {
		const { client } = fakeRedis();
		const storage = new RedisThrottlerStorage(client as any);

		for (let i = 0; i < 2; i++) {
			await storage.increment('key', 60_000, 1, 0, 'default');
		}

		expect(client.set).toHaveBeenCalledWith('throttle:default:key:blocked', '1', { PX: 1, NX: true });
	});

	it('degrades to the in-process store instead of failing the request when Redis errors', async () => {
		const { client } = fakeRedis();
		client.multi.mockImplementation(() => {
			throw new Error('connection lost');
		});
		const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

		try {
			const storage = new RedisThrottlerStorage(client as any);
			const record = await storage.increment('key', 60_000, 5, 60_000, 'default');

			expect(record.totalHits).toBe(1);
			expect(record.isBlocked).toBe(false);
		} finally {
			error.mockRestore();
		}
	});

	it('does not queue commands on a disconnected client', async () => {
		// node-redis replays its offline queue on reconnect, which would count this request into the
		// shared bucket long after it was already counted by the in-process fallback.
		const { client } = fakeRedis();
		client.isReady = false;
		const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

		try {
			const storage = new RedisThrottlerStorage(client as any);
			const record = await storage.increment('key', 60_000, 5, 60_000, 'default');

			expect(record.totalHits).toBe(1);
			expect(client.multi).not.toHaveBeenCalled();
		} finally {
			error.mockRestore();
		}
	});

	it('does not wait forever when Redis never answers', async () => {
		// node-redis does not REJECT a command issued while the socket is down: it parks it in the
		// offline queue, so the promise simply never settles. This store runs behind the GLOBAL
		// throttler guard, so an unbounded await there stalls every request on the API. The deadline
		// has to turn that into the documented in-memory fallback.
		const client = {
			multi: () => {
				const chain = {
					pTTL: () => chain,
					incr: () => chain,
					exec: () => new Promise<unknown[]>(() => undefined)
				};
				return chain;
			}
		};
		const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

		try {
			const storage = new RedisThrottlerStorage(client as any);
			const started = Date.now();
			const record = await storage.increment('key', 60_000, 5, 60_000, 'default');

			expect(Date.now() - started).toBeLessThan(5_000);
			expect(record.totalHits).toBe(1);
			expect(record.isBlocked).toBe(false);
		} finally {
			error.mockRestore();
		}
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
