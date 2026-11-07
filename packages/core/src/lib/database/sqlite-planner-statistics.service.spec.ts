import {
	SQLITE_ANALYSIS_LIMIT,
	SQLITE_OPTIMIZE_INTERVAL_MS,
	SqlitePlannerStatisticsService
} from './sqlite-planner-statistics.service';

/**
 * The SQLite planner statistics: `ANALYZE` (bounded) once the application starts and on demand, `PRAGMA optimize`
 * every hour, nothing on other databases or when opted out, and never a thrown error.
 */
describe('SqlitePlannerStatisticsService', () => {
	const service = (type: string, query = jest.fn(async (_sql: string): Promise<unknown[]> => [])) => ({
		service: new SqlitePlannerStatisticsService({ options: { type }, query } as any),
		query
	});

	const previous = process.env.DB_SQLITE_PLANNER_STATISTICS;
	afterEach(() => {
		if (previous === undefined) delete process.env.DB_SQLITE_PLANNER_STATISTICS;
		else process.env.DB_SQLITE_PLANNER_STATISTICS = previous;
		jest.useRealTimers();
	});

	it('gathers the statistics once the application starts, then optimizes hourly', async () => {
		jest.useFakeTimers();
		const { service: s, query } = service('better-sqlite3');
		await s.onApplicationBootstrap();
		expect(query.mock.calls.map((call) => call[0])).toEqual([`PRAGMA analysis_limit = ${SQLITE_ANALYSIS_LIMIT}`, 'ANALYZE']);

		query.mockClear();
		jest.advanceTimersByTime(SQLITE_OPTIMIZE_INTERVAL_MS);
		expect(query).toHaveBeenCalledWith('PRAGMA optimize');

		s.onApplicationShutdown();
		query.mockClear();
		jest.advanceTimersByTime(SQLITE_OPTIMIZE_INTERVAL_MS * 2);
		expect(query).not.toHaveBeenCalled();
	});

	it.each(['sqlite', 'better-sqlite3'])('is enabled on %s', (type) => {
		expect(service(type).service.enabled).toBe(true);
	});

	it.each(['postgres', 'mysql'])('does nothing on %s', async (type) => {
		const { service: s, query } = service(type);
		expect(s.enabled).toBe(false);
		await s.onApplicationBootstrap();
		await s.analyze();
		await s.optimize();
		expect(query).not.toHaveBeenCalled();
	});

	it.each(['false', '0', 'off', 'NO'])('is opted out of with DB_SQLITE_PLANNER_STATISTICS=%s', async (flag) => {
		process.env.DB_SQLITE_PLANNER_STATISTICS = flag;
		const { service: s, query } = service('better-sqlite3');
		expect(s.enabled).toBe(false);
		await s.onApplicationBootstrap();
		await s.analyze();
		expect(query).not.toHaveBeenCalled();
	});

	it('logs a failed ANALYZE or optimize instead of throwing', async () => {
		const query = jest.fn(async (_sql: string): Promise<unknown[]> => {
			throw new Error('database is locked');
		});
		const { service: s } = service('better-sqlite3', query);
		const warn = jest.spyOn((s as any).logger, 'warn').mockImplementation(() => undefined);
		await expect(s.analyze()).resolves.toBeUndefined();
		await expect(s.optimize()).resolves.toBeUndefined();
		expect(warn).toHaveBeenCalledTimes(2);
		expect(warn.mock.calls[0][0]).toContain('database is locked');
	});
});
