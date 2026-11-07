/**
 * 🛑 This import must stay FIRST, before any import that pulls a core service (see the note at the top of
 * `screenshot.controller.spec.ts`: entering the entity graph from a service leaves a class decorator
 * `undefined` and the suite fails to load).
 */
import '../../core/entities/internal';
import { Logger } from '@nestjs/common';
import { MoreThan } from 'typeorm';
import { EmployeeKindEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { MultiORMEnum } from '../../core/utils';
import {
	DEFAULT_PUBLIC_STATS_TTL_MS,
	PUBLIC_STATS_NEW_TENANT_WINDOW_DAYS,
	PublicStatsService,
	publicStatsCacheControl,
	resolvePublicStatsTtlMs
} from './public-stats.service';

/**
 * `GET /public/stats` is public and counts over the whole database, the screenshot table among them. The
 * figures move slowly: one computation per `PUBLIC_STATS_TTL_MS` window serves every caller, concurrent
 * callers share the computation in flight, and once the window has passed the previous figures are
 * answered at once while the recount runs behind the request.
 */
describe('resolvePublicStatsTtlMs', () => {
	it.each([
		['unset', undefined, DEFAULT_PUBLIC_STATS_TTL_MS],
		['blank', ' ', DEFAULT_PUBLIC_STATS_TTL_MS],
		['a number of milliseconds', '60000', 60_000],
		['zero', '0', 0],
		['false', 'false', 0],
		['off', 'OFF', 0],
		['unreadable', 'one hour', DEFAULT_PUBLIC_STATS_TTL_MS],
		['negative', '-5', DEFAULT_PUBLIC_STATS_TTL_MS]
	])('reads %s', (_label, value, expected) => {
		expect(resolvePublicStatsTtlMs(value)).toBe(expected);
	});

	it('defaults to one hour', () => {
		expect(DEFAULT_PUBLIC_STATS_TTL_MS).toBe(60 * 60 * 1000);
	});
});

/**
 * The HTTP cache lifetime follows the window: a shorter `PUBLIC_STATS_TTL_MS` must not leave clients and CDNs
 * reusing hour-old figures, and a window of `0` ("recount on every call") must not be cached at all.
 */
describe('publicStatsCacheControl', () => {
	it.each([
		['the default window', DEFAULT_PUBLIC_STATS_TTL_MS, 'public, max-age=3600, stale-while-revalidate=600'],
		['a one-minute window', 60_000, 'public, max-age=60, stale-while-revalidate=60'],
		['a window under a second', 500, 'public, max-age=0, stale-while-revalidate=0'],
		['no window', 0, 'no-store'],
		['an unreadable window', Number.NaN, 'no-store']
	])('follows %s', (_label, ttlMs, expected) => {
		expect(publicStatsCacheControl(ttlMs)).toBe(expected);
	});
});

describe('PublicStatsService.getPublicStats', () => {
	const originalTtl = process.env.PUBLIC_STATS_TTL_MS;
	const originalOrm = process.env.DB_ORM;

	beforeEach(() => {
		jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
	});

	afterEach(() => {
		if (originalTtl === undefined) delete process.env.PUBLIC_STATS_TTL_MS;
		else process.env.PUBLIC_STATS_TTL_MS = originalTtl;
		if (originalOrm === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = originalOrm;
		jest.restoreAllMocks();
	});

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

	/** Lets every settled promise run its continuations. */
	const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

	function build(ttl?: string) {
		if (ttl === undefined) delete process.env.PUBLIC_STATS_TTL_MS;
		else process.env.PUBLIC_STATS_TTL_MS = ttl;
		const counts = {
			// The tenant count is asked twice: every tenant, and the ones registered inside the window
			tenants: jest.fn(async (options?: unknown) => (options ? 3 : 10)),
			users: jest.fn(async () => 12),
			agentUsers: jest.fn(async () => 2),
			employees: jest.fn(async () => 7),
			teams: jest.fn(async () => 4),
			projects: jest.fn(async () => 5),
			screenshots: jest.fn(async () => 1000),
			/** The TypeORM sum: a Postgres driver answers a bigint sum as a string. */
			typeOrmSum: jest.fn(async (): Promise<{ total: string | number | null } | undefined> => ({
				total: '7200'
			})),
			/** The knex sum under MikroORM. */
			knexSum: jest.fn(async (): Promise<{ total: string | number | null } | undefined> => ({ total: 10800 }))
		};
		const typeOrmQuery = { select: jest.fn(), getRawOne: counts.typeOrmSum };
		typeOrmQuery.select.mockReturnValue(typeOrmQuery);
		const typeOrmTimeSlotRepository = { createQueryBuilder: jest.fn(() => typeOrmQuery) };
		const knexQuery = { sum: jest.fn(), whereNull: jest.fn(), first: counts.knexSum };
		knexQuery.sum.mockReturnValue(knexQuery);
		knexQuery.whereNull.mockReturnValue(knexQuery);
		const knex = jest.fn(() => knexQuery);
		const mikroOrmTimeSlotRepository = { getKnex: () => knex };
		const service = new PublicStatsService(
			{ count: counts.tenants } as any,
			{ count: counts.users, countAgentUsers: counts.agentUsers } as any,
			{ count: counts.employees } as any,
			{ count: counts.teams } as any,
			{ count: counts.projects } as any,
			{ count: counts.screenshots } as any,
			typeOrmTimeSlotRepository as any,
			mikroOrmTimeSlotRepository as any
		);
		return { service, counts, typeOrmQuery, typeOrmTimeSlotRepository, knex, knexQuery };
	}

	const expected = {
		tenants: 10,
		tenantsLast90Days: 3,
		users: 10,
		employees: 7,
		teams: 4,
		projects: 5,
		screenshots: 1000,
		hoursTracked: 2,
		computedAt: expect.any(String)
	};

	it('answers counts of the whole installation, and nothing but counts', async () => {
		const { service, counts } = build();
		const now = 1_700_000_000_000;
		jest.spyOn(Date, 'now').mockReturnValue(now);

		const stats = await service.getPublicStats();

		expect(stats).toEqual({ ...expected, computedAt: new Date(now).toISOString() });
		// Nothing but the documented fields: no amounts, no identifiers, no per-tenant figure
		expect(Object.keys(stats).sort()).toEqual(Object.keys(expected).sort());
		// Every count is asked without a tenant filter of its own (the request carries no tenant)
		expect(counts.tenants).toHaveBeenNthCalledWith(1);
		expect(counts.tenants).toHaveBeenNthCalledWith(2, {
			where: { createdAt: MoreThan(new Date(now - PUBLIC_STATS_NEW_TENANT_WINDOW_DAYS * 24 * 60 * 60 * 1000)) }
		});
		expect(counts.employees).toHaveBeenCalledWith({ where: { kind: EmployeeKindEnum.HUMAN } });
		for (const count of [counts.users, counts.agentUsers, counts.teams, counts.projects, counts.screenshots]) {
			expect(count).toHaveBeenCalledWith();
		}
	});

	it('never reports a negative number of people', async () => {
		const { service, counts } = build();
		counts.users.mockResolvedValueOnce(1);
		counts.agentUsers.mockResolvedValueOnce(5);
		expect((await service.getPublicStats()).users).toBe(0);
	});

	describe('tracked hours', () => {
		it('sums the time slots through the TypeORM query builder, in whole hours rounded down', async () => {
			const { service, counts, typeOrmQuery, typeOrmTimeSlotRepository, knex } = build();
			counts.typeOrmSum.mockResolvedValueOnce({ total: '7199' });
			expect((await service.getPublicStats()).hoursTracked).toBe(1);
			expect(typeOrmTimeSlotRepository.createQueryBuilder).toHaveBeenCalledWith('time_slot');
			expect(typeOrmQuery.select).toHaveBeenCalledWith('COALESCE(SUM(time_slot.duration), 0)', 'total');
			expect(knex).not.toHaveBeenCalled();
		});

		it('sums the time slots through knex under MikroORM, leaving deleted slots out', async () => {
			process.env.DB_ORM = MultiORMEnum.MikroORM;
			const { service, knex, knexQuery, typeOrmTimeSlotRepository } = build();
			expect((await service.getPublicStats()).hoursTracked).toBe(3);
			expect(knex).toHaveBeenCalledWith('time_slot');
			expect(knexQuery.sum).toHaveBeenCalledWith({ total: 'duration' });
			expect(knexQuery.whereNull).toHaveBeenCalledWith('deletedAt');
			expect(typeOrmTimeSlotRepository.createQueryBuilder).not.toHaveBeenCalled();
		});

		it.each([
			['no row', undefined],
			['a null sum', { total: null }],
			['a negative sum', { total: '-5' }],
			['an unreadable sum', { total: 'many' }]
		])('reads %s as 0 hours', async (_label, row) => {
			const { service, counts } = build();
			counts.typeOrmSum.mockResolvedValueOnce(row);
			expect((await service.getPublicStats()).hoursTracked).toBe(0);
		});
	});

	it('computes the counts once per window and serves the next calls from it', async () => {
		const { service, counts } = build();
		const first = await service.getPublicStats();
		const second = await service.getPublicStats();
		expect(first).toEqual(expected);
		expect(second).toBe(first);
		for (const count of Object.values(counts)) {
			if (count === counts.knexSum) continue;
			expect(count).toHaveBeenCalledTimes(count === counts.tenants ? 2 : 1);
		}
	});

	it('shares one computation between concurrent callers', async () => {
		const { service, counts } = build();
		const screenshots = deferred<number>();
		counts.screenshots.mockReturnValue(screenshots.promise);
		const calls = [service.getPublicStats(), service.getPublicStats(), service.getPublicStats()];
		await flush();
		expect(counts.screenshots).toHaveBeenCalledTimes(1);
		screenshots.resolve(99);
		const results = await Promise.all(calls);
		expect(results.map((stats) => stats.screenshots)).toEqual([99, 99, 99]);
	});

	it('once the window has passed, answers the previous figures at once and recounts behind the request', async () => {
		const { service, counts } = build('1000');
		const now = jest.spyOn(Date, 'now');
		now.mockReturnValue(1_000_000);
		await service.getPublicStats();
		expect(counts.screenshots).toHaveBeenCalledTimes(1);

		// Inside the window: nothing is recounted
		now.mockReturnValue(1_000_999);
		await service.getPublicStats();
		expect(counts.screenshots).toHaveBeenCalledTimes(1);

		// The window has passed: the recount starts, and the caller does not wait on it
		now.mockReturnValue(1_001_000);
		const recount = deferred<number>();
		counts.screenshots.mockReturnValueOnce(recount.promise);
		expect((await service.getPublicStats()).screenshots).toBe(1000);
		expect(counts.screenshots).toHaveBeenCalledTimes(2);
		// A second caller while the recount is in flight joins it rather than starting another
		expect((await service.getPublicStats()).screenshots).toBe(1000);
		expect(counts.screenshots).toHaveBeenCalledTimes(2);

		recount.resolve(2000);
		await flush();
		expect((await service.getPublicStats()).screenshots).toBe(2000);
		expect(counts.screenshots).toHaveBeenCalledTimes(2);
	});

	it('keeps the previous figures when a recount fails, and tries again on the next call', async () => {
		const { service, counts } = build('1000');
		const now = jest.spyOn(Date, 'now');
		now.mockReturnValue(1_000_000);
		await service.getPublicStats();

		now.mockReturnValue(1_001_000);
		counts.screenshots.mockRejectedValueOnce(new Error('timeout exceeded when trying to connect'));
		expect((await service.getPublicStats()).screenshots).toBe(1000);
		await flush();
		expect(Logger.prototype.error).toHaveBeenCalledWith(
			expect.stringContaining('timeout exceeded when trying to connect'),
			expect.anything()
		);

		// The failed recount left the previous figures in place; this call answers them and recounts again
		counts.screenshots.mockResolvedValueOnce(3000);
		expect((await service.getPublicStats()).screenshots).toBe(1000);
		await flush();
		expect((await service.getPublicStats()).screenshots).toBe(3000);
		expect(counts.screenshots).toHaveBeenCalledTimes(3);
	});

	it('keeps nothing when the first computation fails, and computes again on the next call', async () => {
		const { service, counts } = build();
		counts.screenshots.mockRejectedValueOnce(new Error('timeout exceeded when trying to connect'));
		await expect(service.getPublicStats()).rejects.toThrow(/Failed to retrieve the public statistics/);
		await expect(service.getPublicStats()).resolves.toEqual(expected);
		expect(counts.screenshots).toHaveBeenCalledTimes(2);
	});

	it('computes the counts on every call when the window is 0', async () => {
		const { service, counts } = build('0');
		await service.getPublicStats();
		await service.getPublicStats();
		expect(counts.screenshots).toHaveBeenCalledTimes(2);
	});

	it('never shares figures computed for a signed-in caller (tenant-scoped counts)', async () => {
		const { service, counts } = build();
		const caller = jest
			.spyOn(RequestContext, 'currentUser')
			.mockReturnValue({ id: 'u1', tenantId: 'tenant-a' } as any);
		counts.screenshots.mockResolvedValueOnce(1);
		expect((await service.getPublicStats()).screenshots).toBe(1);
		caller.mockReturnValue(null);
		expect(await service.getPublicStats()).toEqual(expected);
		expect(counts.screenshots).toHaveBeenCalledTimes(2);
	});
});
