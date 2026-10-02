import { FakeRedis, InMemoryCache } from '../fixtures/in-memory-accounts';
import { HOLD_TTL_MS, ZitadelStoreService } from './zitadel-store.service';

describe('ZitadelStoreService', () => {
	afterEach(() => {
		jest.useRealTimers();
	});

	describe.each<[string, () => FakeRedis | null]>([
		['in process memory', () => null],
		['in Redis', () => new FakeRedis()]
	])('holds and per-key counters %s', (_where, redisFactory) => {
		let store: ZitadelStoreService;

		beforeEach(() => {
			store = new ZitadelStoreService(new InMemoryCache(), redisFactory());
		});

		it('lets one attempt at a time hold a key, also among concurrent callers', async () => {
			const key = store.newKey();
			const results = await Promise.all([
				store.hold('confirm', key),
				store.hold('confirm', key),
				store.hold('confirm', key)
			]);
			const holds = results.filter(Boolean);
			expect(holds).toHaveLength(1);
			expect(await store.isHeld('confirm', key)).toBe(true);
			await store.release('confirm', key, holds[0]);
			expect(await store.isHeld('confirm', key)).toBe(false);
			expect(await store.hold('confirm', key)).toBeTruthy();
		});

		it('keeps holds of different namespaces and keys apart', async () => {
			const key = store.newKey();
			expect(await store.hold('confirm', key)).toBeTruthy();
			expect(await store.hold('signup', key)).toBeTruthy();
			expect(await store.hold('confirm', store.newKey())).toBeTruthy();
		});

		it('ends a hold that was never released after its lifetime', async () => {
			jest.useFakeTimers({ now: Date.now() });
			const key = store.newKey();
			expect(await store.hold('confirm', key)).toBeTruthy();
			jest.setSystemTime(Date.now() + HOLD_TTL_MS + 1);
			expect(await store.isHeld('confirm', key)).toBe(false);
			expect(await store.hold('confirm', key)).toBeTruthy();
		});

		it("never ends another attempt's hold, also after its own hold outlived its lifetime", async () => {
			jest.useFakeTimers({ now: Date.now() });
			const key = store.newKey();
			const first = await store.hold('confirm', key);
			jest.setSystemTime(Date.now() + HOLD_TTL_MS + 1);
			const second = await store.hold('confirm', key);
			expect(second).toBeTruthy();
			expect(second).not.toBe(first);

			// The first attempt finishes late: the second one keeps its hold.
			await store.release('confirm', key, first);
			expect(await store.isHeld('confirm', key)).toBe(true);
			expect(await store.hold('confirm', key)).toBeNull();
			await store.release('confirm', key, second);
			expect(await store.isHeld('confirm', key)).toBe(false);
		});

		it('never holds or looks up a malformed key', async () => {
			const hold = await store.hold('confirm', 'short');
			expect(hold).toBeTruthy();
			expect(await store.isHeld('confirm', 'short')).toBe(false);
			await store.release('confirm', 'short', hold);
		});

		it('counts the uses of each key in its window', async () => {
			jest.useFakeTimers({ now: Date.now() });
			const key = store.newKey();
			const other = store.newKey();
			const results = [];
			for (let i = 0; i < 4; i++) {
				results.push(await store.hit('confirm', key, 3, 60_000));
			}
			expect(results.map((result) => result.allowed)).toEqual([true, true, true, false]);
			expect(results[3].retryAfterSeconds).toBeGreaterThan(0);
			expect(results[3].retryAfterSeconds).toBeLessThanOrEqual(60);
			// Another key, and the same key on another route, have their own counters.
			expect((await store.hit('confirm', other, 3, 60_000)).allowed).toBe(true);
			expect((await store.hit('signup', key, 3, 60_000)).allowed).toBe(true);
			// A new window starts afresh.
			jest.setSystemTime(Date.now() + 60_001);
			expect((await store.hit('confirm', key, 3, 60_000)).allowed).toBe(true);
		});
	});

	describe('with Redis', () => {
		it('keeps counters under a digest of the key, never the key itself', async () => {
			const redis = new FakeRedis();
			const store = new ZitadelStoreService(new InMemoryCache(), redis);
			const key = store.newKey();
			await store.hit('confirm', key, 3, 60_000);
			expect(redis.keys().some((name) => name.includes(key))).toBe(false);
			expect(redis.keys().some((name) => name.startsWith('zitadel:rate:confirm:'))).toBe(true);
		});

		it('counts and reads the window in one transaction', async () => {
			const redis = new FakeRedis();
			const store = new ZitadelStoreService(new InMemoryCache(), redis);
			await store.hit('confirm', store.newKey(), 3, 60_000);
			expect(redis.calls).toEqual(['multi', 'incr', 'pTTL', 'pExpire']);
		});

		it.each([
			['a refused', 3],
			['an allowed', 1]
		])('starts a window again when its expiry was lost, on %s use', async (_name, usesBefore) => {
			const redis = new FakeRedis();
			const store = new ZitadelStoreService(new InMemoryCache(), redis);
			const key = store.newKey();
			for (let i = 0; i < usesBefore; i++) {
				await store.hit('confirm', key, 3, 60_000);
			}
			redis.dropExpiry((name) => name.startsWith('zitadel:rate:'));
			const result = await store.hit('confirm', key, 3, 60_000);
			expect(result).toEqual(
				usesBefore >= 3 ? { allowed: false, retryAfterSeconds: 60 } : { allowed: true, retryAfterSeconds: 0 }
			);
			expect(await redis.pTTL(redis.keys().find((name) => name.startsWith('zitadel:rate:')))).toBeGreaterThan(0);
		});

		it('holds a key with SET NX and a lifetime, shared by every replica, and releases only its own hold', async () => {
			const redis = new FakeRedis();
			const replicaA = new ZitadelStoreService(new InMemoryCache(), redis);
			const replicaB = new ZitadelStoreService(new InMemoryCache(), redis);
			const key = replicaA.newKey();
			const hold = await replicaA.hold('confirm', key);
			expect(hold).toBeTruthy();
			expect(await replicaB.hold('confirm', key)).toBeNull();
			expect(await replicaB.isHeld('confirm', key)).toBe(true);
			expect(redis.calls).toContain('set-nx');
			await replicaB.release('confirm', key, 'not-the-hold');
			expect(await replicaB.isHeld('confirm', key)).toBe(true);
			await replicaA.release('confirm', key, hold);
			expect(redis.calls).toContain('eval');
			expect(await replicaB.hold('confirm', key)).toBeTruthy();
		});
	});
});
