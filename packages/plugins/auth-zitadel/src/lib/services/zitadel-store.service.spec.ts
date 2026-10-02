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
			expect(results.filter(Boolean)).toHaveLength(1);
			expect(await store.isHeld('confirm', key)).toBe(true);
			await store.release('confirm', key);
			expect(await store.isHeld('confirm', key)).toBe(false);
			expect(await store.hold('confirm', key)).toBe(true);
		});

		it('keeps holds of different namespaces and keys apart', async () => {
			const key = store.newKey();
			expect(await store.hold('confirm', key)).toBe(true);
			expect(await store.hold('signup', key)).toBe(true);
			expect(await store.hold('confirm', store.newKey())).toBe(true);
		});

		it('ends a hold that was never released after its lifetime', async () => {
			jest.useFakeTimers({ now: Date.now() });
			const key = store.newKey();
			expect(await store.hold('confirm', key)).toBe(true);
			jest.setSystemTime(Date.now() + HOLD_TTL_MS + 1);
			expect(await store.isHeld('confirm', key)).toBe(false);
			expect(await store.hold('confirm', key)).toBe(true);
		});

		it('never holds or looks up a malformed key', async () => {
			expect(await store.hold('confirm', 'short')).toBe(true);
			expect(await store.isHeld('confirm', 'short')).toBe(false);
			await store.release('confirm', 'short');
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

		it('starts a window again when its expiry was lost', async () => {
			const redis = new FakeRedis();
			const store = new ZitadelStoreService(new InMemoryCache(), redis);
			const key = store.newKey();
			for (let i = 0; i < 3; i++) {
				await store.hit('confirm', key, 3, 60_000);
			}
			redis.dropExpiry((name) => name.startsWith('zitadel:rate:'));
			const refused = await store.hit('confirm', key, 3, 60_000);
			expect(refused).toEqual({ allowed: false, retryAfterSeconds: 60 });
			expect(await redis.pTTL(redis.keys().find((name) => name.startsWith('zitadel:rate:')))).toBeGreaterThan(0);
		});

		it('holds a key with SET NX and a lifetime, shared by every replica', async () => {
			const redis = new FakeRedis();
			const replicaA = new ZitadelStoreService(new InMemoryCache(), redis);
			const replicaB = new ZitadelStoreService(new InMemoryCache(), redis);
			const key = replicaA.newKey();
			expect(await replicaA.hold('confirm', key)).toBe(true);
			expect(await replicaB.hold('confirm', key)).toBe(false);
			expect(await replicaB.isHeld('confirm', key)).toBe(true);
			expect(redis.calls).toContain('set-nx');
			await replicaA.release('confirm', key);
			expect(await replicaB.hold('confirm', key)).toBe(true);
		});
	});
});
