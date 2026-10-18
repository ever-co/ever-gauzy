import { UnauthorizedException } from '@nestjs/common';
import {
	AuthenticatedUserCache,
	authenticatedUserCacheKey,
	cloneAuthenticatedUser,
	DEFAULT_AUTHENTICATED_USER_TTL_MS,
	MAX_AUTHENTICATED_USER_TTL_MS,
	resolveAuthenticatedUserTtlMs
} from './authenticated-user-cache';

class UserEntity {
	id: string;
	email: string;
	hash?: string;
	role?: { id: string; name: string };
	permissions?: any[];
	constructor(init: Partial<UserEntity>) {
		Object.assign(this, init);
	}
}

/** The validated context of `id`, as `JwtStrategy` would have built it. */
function validated(id = 'user-1'): any {
	return new UserEntity({
		id,
		email: `${id}@ever.co`,
		hash: 'secret',
		role: { id: 'role-1', name: 'EMPLOYEE' },
		permissions: ['ORG_TEAM_VIEW']
	});
}

/** A promise that settles only when the test says so. */
function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

describe('resolveAuthenticatedUserTtlMs', () => {
	it.each([
		['unset', undefined, DEFAULT_AUTHENTICATED_USER_TTL_MS],
		['blank', '  ', DEFAULT_AUTHENTICATED_USER_TTL_MS],
		['a number of milliseconds', '2500', 2500],
		['a fractional number (floored)', '2500.9', 2500],
		['zero', '0', 0],
		['false', 'false', 0],
		['off', 'OFF', 0],
		['no', 'no', 0],
		['unreadable', 'ten seconds', DEFAULT_AUTHENTICATED_USER_TTL_MS],
		['negative', '-1', DEFAULT_AUTHENTICATED_USER_TTL_MS],
		['above the cap', String(60 * 60 * 1000), MAX_AUTHENTICATED_USER_TTL_MS]
	])('reads %s', (_label, value, expected) => {
		expect(resolveAuthenticatedUserTtlMs(value)).toBe(expected);
	});

	it('reads JWT_AUTHENTICATED_USER_TTL_MS by default', () => {
		const before = process.env.JWT_AUTHENTICATED_USER_TTL_MS;
		try {
			process.env.JWT_AUTHENTICATED_USER_TTL_MS = '750';
			expect(resolveAuthenticatedUserTtlMs()).toBe(750);
		} finally {
			if (before === undefined) delete process.env.JWT_AUTHENTICATED_USER_TTL_MS;
			else process.env.JWT_AUTHENTICATED_USER_TTL_MS = before;
		}
	});
});

describe('authenticatedUserCacheKey', () => {
	it('tells apart tokens that differ in any claim', () => {
		const base = { id: 'u', employeeId: 'e', organizationId: 'o', tenantId: 't' };
		const keys = new Set([
			authenticatedUserCacheKey(base),
			authenticatedUserCacheKey({ ...base, employeeId: 'e2' }),
			authenticatedUserCacheKey({ ...base, organizationId: 'o2' }),
			authenticatedUserCacheKey({ ...base, tenantId: 't2' }),
			authenticatedUserCacheKey({ ...base, id: undefined, thirdPartyId: 'u' }),
			authenticatedUserCacheKey({ ...base, employeeId: undefined })
		]);
		expect(keys.size).toBe(6);
	});

	it('treats an absent claim and an empty one alike', () => {
		expect(authenticatedUserCacheKey({ id: 'u', employeeId: undefined })).toBe(
			authenticatedUserCacheKey({ id: 'u', employeeId: '' })
		);
	});
});

describe('cloneAuthenticatedUser', () => {
	it('keeps the prototype and every own property, accessors included', () => {
		const user = validated();
		Object.defineProperty(user, 'lazy', { get: () => 'loaded', enumerable: false, configurable: true });
		const copy = cloneAuthenticatedUser(user);
		expect(copy).not.toBe(user);
		expect(copy).toBeInstanceOf(UserEntity);
		expect(copy).toEqual(user);
		expect((copy as any).lazy).toBe('loaded');
	});

	it('isolates one request from another', () => {
		const user = validated();
		const copy = cloneAuthenticatedUser(user);
		(copy as any).lastOrganizationId = 'org-2';
		expect((user as any).lastOrganizationId).toBeUndefined();
	});
});

describe('AuthenticatedUserCache', () => {
	const claims = { id: 'user-1', tenantId: 'tenant', employeeId: 'emp-1', organizationId: 'org-1' };

	function build(options: ConstructorParameters<typeof AuthenticatedUserCache>[0] = {}) {
		let clock = 1_000_000;
		const cache = new AuthenticatedUserCache({ ttlMs: 10_000, ormType: 'typeorm', now: () => clock, ...options });
		const load = jest.fn(async () => validated());
		return { cache, load, tick: (ms: number) => (clock += ms) };
	}

	it('judges the first request against the database and reuses the context for the next ones', async () => {
		const { cache, load } = build();
		const first = await cache.resolve(claims, load);
		const second = await cache.resolve(claims, load);
		expect(load).toHaveBeenCalledTimes(1);
		expect(second).toEqual(first);
		expect(second).toMatchObject({ id: 'user-1', permissions: ['ORG_TEAM_VIEW'] });
	});

	it('hands every request its own copy of the user, with its class', async () => {
		const { cache, load } = build();
		const first = await cache.resolve(claims, load);
		const second = await cache.resolve(claims, load);
		expect(second).not.toBe(first);
		expect(second).toBeInstanceOf(UserEntity);
		expect(first).toBeInstanceOf(UserEntity);
		// The loader's own copy is a copy too: what it does to it never reaches the kept context.
		(first as any).lastOrganizationId = 'org-9';
		const third = await cache.resolve(claims, load);
		expect((third as any).lastOrganizationId).toBeUndefined();
	});

	it('judges a token afresh once its context has expired', async () => {
		const { cache, load, tick } = build({ ttlMs: 10_000 });
		await cache.resolve(claims, load);
		tick(9_999);
		await cache.resolve(claims, load);
		expect(load).toHaveBeenCalledTimes(1);
		tick(1);
		await cache.resolve(claims, load);
		expect(load).toHaveBeenCalledTimes(2);
	});

	it('shares one lookup between concurrent requests with the same claims', async () => {
		const { cache } = build();
		const lookup = deferred<any>();
		const load = jest.fn(() => lookup.promise);
		const requests = [cache.resolve(claims, load), cache.resolve(claims, load), cache.resolve(claims, load)];
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(load).toHaveBeenCalledTimes(1);
		lookup.resolve(validated());
		const users = await Promise.all(requests);
		expect(users.map((user: any) => user.id)).toEqual(['user-1', 'user-1', 'user-1']);
		expect(new Set(users).size).toBe(3);
	});

	it('keeps tokens with different claims apart', async () => {
		const { cache, load } = build();
		await cache.resolve(claims, load);
		await cache.resolve({ ...claims, organizationId: 'org-2' }, load);
		await cache.resolve({ ...claims, employeeId: undefined }, load);
		expect(load).toHaveBeenCalledTimes(3);
		expect(cache.size).toBe(3);
	});

	it('never remembers a refusal', async () => {
		const { cache } = build();
		const refusal = new UnauthorizedException('unauthorized');
		const load = jest.fn(async () => refusal);
		expect(await cache.resolve(claims, load)).toBe(refusal);
		expect(await cache.resolve(claims, load)).toBe(refusal);
		expect(load).toHaveBeenCalledTimes(2);
		expect(cache.size).toBe(0);
	});

	it('never remembers a missing user', async () => {
		const { cache } = build();
		const load = jest.fn(async () => undefined as any);
		expect(await cache.resolve(claims, load)).toBeUndefined();
		await cache.resolve(claims, load);
		expect(load).toHaveBeenCalledTimes(2);
		expect(cache.size).toBe(0);
	});

	it('passes a failed lookup to every waiting request and judges the next one afresh', async () => {
		const { cache } = build();
		const lookup = deferred<any>();
		const load = jest.fn(() => lookup.promise);
		const requests = [cache.resolve(claims, load), cache.resolve(claims, load)];
		const outage = new Error('timeout exceeded when trying to connect');
		lookup.reject(outage);
		await expect(requests[0]).rejects.toBe(outage);
		await expect(requests[1]).rejects.toBe(outage);
		expect(load).toHaveBeenCalledTimes(1);

		load.mockResolvedValue(validated());
		await expect(cache.resolve(claims, load)).resolves.toMatchObject({ id: 'user-1' });
		expect(load).toHaveBeenCalledTimes(2);
	});

	it('forgets one user, every token of theirs', async () => {
		const { cache, load } = build();
		await cache.resolve(claims, load);
		await cache.resolve({ ...claims, organizationId: 'org-2' }, load);
		const other = jest.fn(async () => validated('user-2'));
		await cache.resolve({ id: 'user-2', tenantId: 'tenant' }, other);
		expect(cache.size).toBe(3);

		cache.forget('user-1');
		expect(cache.size).toBe(1);
		await cache.resolve(claims, load);
		expect(load).toHaveBeenCalledTimes(3);
		await cache.resolve({ id: 'user-2', tenantId: 'tenant' }, other);
		expect(other).toHaveBeenCalledTimes(1);
	});

	it.each([
		['forgotten', (cache: AuthenticatedUserCache) => cache.forget('user-1')],
		['cleared', (cache: AuthenticatedUserCache) => cache.clear()]
	])('keeps nothing a lookup in flight resolves once the cache is %s, and no later request joins it', async (_label, invalidate) => {
		const { cache } = build();
		const lookup = deferred<any>();
		const load = jest.fn(() => lookup.promise);
		const inFlight = cache.resolve(claims, load);

		invalidate(cache);

		// A request after the invalidation starts its own lookup rather than joining the stale one.
		const fresh = deferred<any>();
		const reload = jest.fn(() => fresh.promise);
		const later = cache.resolve(claims, reload);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(reload).toHaveBeenCalledTimes(1);

		// The stale lookup still answers its own request, but its context is not kept.
		lookup.resolve(validated());
		await expect(inFlight).resolves.toMatchObject({ id: 'user-1' });
		expect(cache.size).toBe(0);

		fresh.resolve(validated());
		await later;
		expect(cache.size).toBe(1);
		await cache.resolve(claims, load);
		expect(load).toHaveBeenCalledTimes(1);
	});

	it('clears everything', async () => {
		const { cache, load } = build();
		await cache.resolve(claims, load);
		cache.clear();
		expect(cache.size).toBe(0);
		await cache.resolve(claims, load);
		expect(load).toHaveBeenCalledTimes(2);
	});

	it('makes room when full by evicting the oldest live context', async () => {
		const { cache, load, tick } = build({ maxEntries: 3, ttlMs: 10_000 });
		await cache.resolve({ id: 'a' }, load);
		tick(5_000);
		await cache.resolve({ id: 'b' }, load);
		await cache.resolve({ id: 'c' }, load);
		expect(cache.size).toBe(3);

		// Nothing has expired: the oldest (a) goes.
		await cache.resolve({ id: 'd' }, load);
		expect(cache.size).toBe(3);
		await cache.resolve({ id: 'b' }, load);
		await cache.resolve({ id: 'a' }, load);
		expect(load).toHaveBeenCalledTimes(5); // a, b, c, d, then a again

		// Still nothing has expired (a was re-read at +5 s): c is the oldest and goes on the next insertion.
		tick(5_000);
		await cache.resolve({ id: 'e' }, load);
		expect(cache.size).toBe(3);
		await cache.resolve({ id: 'a' }, load);
		await cache.resolve({ id: 'd' }, load);
		await cache.resolve({ id: 'e' }, load);
		expect(load).toHaveBeenCalledTimes(6);
	});

	it('drops every expired context before evicting a live one', async () => {
		const { cache, load, tick } = build({ maxEntries: 3, ttlMs: 10_000 });
		await cache.resolve({ id: 'a' }, load);
		await cache.resolve({ id: 'b' }, load);
		tick(6_000);
		await cache.resolve({ id: 'c' }, load);
		tick(5_000); // a and b have expired; c is still live
		await cache.resolve({ id: 'd' }, load);
		expect(cache.size).toBe(2); // both expired contexts went, c survived
		await cache.resolve({ id: 'c' }, load);
		expect(load).toHaveBeenCalledTimes(4); // a, b, c, d — c was still kept
	});

	it('is off when the window is 0', async () => {
		const { cache, load } = build({ ttlMs: 0 });
		expect(cache.enabled).toBe(false);
		await cache.resolve(claims, load);
		await cache.resolve(claims, load);
		expect(load).toHaveBeenCalledTimes(2);
		expect(cache.size).toBe(0);
	});

	it('is off under MikroORM, whose unit of work manages the user', async () => {
		const { cache, load } = build({ ormType: 'mikro-orm', ttlMs: 10_000 });
		expect(cache.enabled).toBe(false);
		await cache.resolve(claims, load);
		await cache.resolve(claims, load);
		expect(load).toHaveBeenCalledTimes(2);
	});

	it('reads its window from the environment by default', () => {
		const before = process.env.JWT_AUTHENTICATED_USER_TTL_MS;
		try {
			process.env.JWT_AUTHENTICATED_USER_TTL_MS = '0';
			expect(new AuthenticatedUserCache({ ormType: 'typeorm' }).enabled).toBe(false);
			process.env.JWT_AUTHENTICATED_USER_TTL_MS = '5000';
			expect(new AuthenticatedUserCache({ ormType: 'typeorm' }).enabled).toBe(true);
		} finally {
			if (before === undefined) delete process.env.JWT_AUTHENTICATED_USER_TTL_MS;
			else process.env.JWT_AUTHENTICATED_USER_TTL_MS = before;
		}
	});
});
