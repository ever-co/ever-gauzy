import { DEFAULT_GLOBAL_STATS_TTL_MS, resolveGlobalStatsTtlMs, StatsService } from './stats.service';

/**
 * `/stats/global` is public (behind its feature flag) and answers nine aggregate statements over the whole
 * database, the sum of every time log ever among them. The figures move slowly: one computation per
 * `STATS_GLOBAL_TTL_MS` window serves every caller, and concurrent callers share the computation in flight.
 */
describe('resolveGlobalStatsTtlMs', () => {
	it.each([
		['unset', undefined, DEFAULT_GLOBAL_STATS_TTL_MS],
		['blank', ' ', DEFAULT_GLOBAL_STATS_TTL_MS],
		['a number of milliseconds', '60000', 60_000],
		['zero', '0', 0],
		['false', 'false', 0],
		['off', 'OFF', 0],
		['unreadable', 'five minutes', DEFAULT_GLOBAL_STATS_TTL_MS],
		['negative', '-5', DEFAULT_GLOBAL_STATS_TTL_MS]
	])('reads %s', (_label, value, expected) => {
		expect(resolveGlobalStatsTtlMs(value)).toBe(expected);
	});
});

describe('StatsService.getGlobalStats', () => {
	const originalTtl = process.env.STATS_GLOBAL_TTL_MS;

	afterEach(() => {
		if (originalTtl === undefined) delete process.env.STATS_GLOBAL_TTL_MS;
		else process.env.STATS_GLOBAL_TTL_MS = originalTtl;
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

	function build(ttl?: string) {
		if (ttl === undefined) delete process.env.STATS_GLOBAL_TTL_MS;
		else process.env.STATS_GLOBAL_TTL_MS = ttl;
		const counts = {
			employees: jest.fn(async () => 10),
			tasks: jest.fn(async () => 20),
			organizations: jest.fn(async () => 3),
			teams: jest.fn(async () => 4),
			tenants: jest.fn(async () => 2),
			invoices: jest.fn(async () => ({ count: 5, amount: 500 })),
			payments: jest.fn(async () => ({ count: 6, amount: 600 })),
			users: jest.fn(async () => ({ count: 12, lastMonthActiveUsers: 7 })),
			hours: jest.fn(async () => 1234)
		};
		const service = new StatsService(
			{ count: counts.employees } as any,
			{ count: counts.organizations } as any,
			{ count: counts.teams } as any,
			{ count: counts.tenants } as any,
			{ getUserStats: counts.users } as any,
			{ count: counts.tasks } as any,
			{ getInvoiceStats: counts.invoices } as any,
			{ getPaymentStats: counts.payments } as any,
			{ getOverallTrackedTime: counts.hours } as any
		);
		return { service, counts };
	}

	const expected = {
		employees: 10,
		tasks: 20,
		organizations: 3,
		teams: 4,
		tenants: 2,
		invoices: { count: 5, amount: 500 },
		payments: { count: 6, amount: 600 },
		users: { count: 12, lastMonthActiveUsers: 7 },
		hours: 1234
	};

	it('computes the statistics once per window and serves the next calls from it', async () => {
		const { service, counts } = build();
		const first = await service.getGlobalStats();
		const second = await service.getGlobalStats();
		expect(first).toEqual(expected);
		expect(second).toEqual(expected);
		for (const count of Object.values(counts)) {
			expect(count).toHaveBeenCalledTimes(1);
		}
	});

	it('shares one computation between concurrent callers', async () => {
		const { service, counts } = build();
		const hours = deferred<number>();
		counts.hours.mockReturnValue(hours.promise);
		const calls = [service.getGlobalStats(), service.getGlobalStats(), service.getGlobalStats()];
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(counts.hours).toHaveBeenCalledTimes(1);
		hours.resolve(99);
		const results = await Promise.all(calls);
		expect(results.map((stats) => stats.hours)).toEqual([99, 99, 99]);
	});

	it('computes them again once the window has passed', async () => {
		const { service, counts } = build('1000');
		const now = jest.spyOn(Date, 'now');
		now.mockReturnValue(1_000_000);
		await service.getGlobalStats();
		now.mockReturnValue(1_000_999);
		await service.getGlobalStats();
		expect(counts.employees).toHaveBeenCalledTimes(1);
		now.mockReturnValue(1_001_000);
		await service.getGlobalStats();
		expect(counts.employees).toHaveBeenCalledTimes(2);
	});

	it('keeps nothing when the computation fails, and computes again on the next call', async () => {
		const { service, counts } = build();
		jest.spyOn(console, 'error').mockImplementation(() => undefined);
		counts.hours.mockRejectedValueOnce(new Error('timeout exceeded when trying to connect'));
		await expect(service.getGlobalStats()).rejects.toThrow(/Failed to retrieve global statistics/);
		await expect(service.getGlobalStats()).resolves.toEqual(expected);
		expect(counts.hours).toHaveBeenCalledTimes(2);
	});

	it('computes them on every call when the window is 0', async () => {
		const { service, counts } = build('0');
		await service.getGlobalStats();
		await service.getGlobalStats();
		expect(counts.employees).toHaveBeenCalledTimes(2);
	});
});
