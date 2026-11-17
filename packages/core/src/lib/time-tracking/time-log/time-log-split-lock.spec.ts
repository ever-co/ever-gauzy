import { TIME_LOG_SPLIT_LOCK_WAIT_SECONDS, TimeLogSplitBusyError, withTimeLogSplitLock } from './time-log-split-lock';

const LOG_ID = '12030000-0000-4000-8000-000000000001';
const LOCK_NAME = `gauzy:time-log-split:${LOG_ID}`;

/** A connection of the pool, recording what runs on it, in order, with what `work` does in between. */
function connection(answer: (sql: string) => unknown = () => []) {
	const steps: string[] = [];
	const runner = {
		connect: jest.fn(async () => void steps.push('connect')),
		startTransaction: jest.fn(async () => void steps.push('begin')),
		rollbackTransaction: jest.fn(async () => void steps.push('end')),
		release: jest.fn(async () => void steps.push('release')),
		query: jest.fn(async (sql: string) => {
			steps.push(sql);
			return answer(sql);
		})
	};
	const dataSourceOf = (type: string) => ({ options: { type }, createQueryRunner: () => runner }) as never;
	const work = jest.fn(async () => {
		steps.push('split');
		return true;
	});
	return { runner, steps, dataSourceOf, work };
}

describe('withTimeLogSplitLock (CORE-26)', () => {
	it("splits a PostgreSQL log while a transaction of its own connection holds the log's advisory lock", async () => {
		const { runner, steps, dataSourceOf, work } = connection();

		await expect(withTimeLogSplitLock(dataSourceOf('postgres'), LOG_ID, work)).resolves.toBe(true);

		expect(steps).toEqual([
			'connect',
			'begin',
			`SET LOCAL lock_timeout = '${TIME_LOG_SPLIT_LOCK_WAIT_SECONDS}s'`,
			'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
			'split',
			'end',
			'release'
		]);
		expect(runner.query).toHaveBeenLastCalledWith(expect.stringContaining('pg_advisory_xact_lock'), [LOCK_NAME]);
	});

	it('releases the PostgreSQL lock and its connection when the split fails, and raises its error', async () => {
		const { steps, dataSourceOf } = connection();
		const failing = async () => {
			steps.push('split');
			throw new Error('The update failed');
		};

		await expect(withTimeLogSplitLock(dataSourceOf('postgres'), LOG_ID, failing)).rejects.toThrow(
			'The update failed'
		);

		expect(steps.slice(-3)).toEqual(['split', 'end', 'release']);
	});

	it('raises a busy split, without splitting, when the PostgreSQL lock is not taken within the wait', async () => {
		const { steps, dataSourceOf, work } = connection((sql) => {
			if (sql.includes('pg_advisory_xact_lock')) {
				throw Object.assign(new Error('canceling statement due to lock timeout'), { code: '55P03' });
			}
			return [];
		});

		await expect(withTimeLogSplitLock(dataSourceOf('postgres'), LOG_ID, work)).rejects.toBeInstanceOf(
			TimeLogSplitBusyError
		);

		expect(work).not.toHaveBeenCalled();
		expect(steps.slice(-2)).toEqual(['end', 'release']);
	});

	it('raises any other error of the PostgreSQL lock as it came', async () => {
		const { dataSourceOf, work } = connection((sql) => {
			if (sql.includes('pg_advisory_xact_lock')) {
				throw Object.assign(new Error('connection lost'), { code: '08006' });
			}
			return [];
		});

		await expect(withTimeLogSplitLock(dataSourceOf('postgres'), LOG_ID, work)).rejects.toThrow('connection lost');
		expect(work).not.toHaveBeenCalled();
	});

	it.each(['mysql', 'mariadb'])('splits a %s log while its own connection holds the named lock', async (type) => {
		const { runner, steps, dataSourceOf, work } = connection((sql) => {
			if (sql.includes('GET_LOCK')) {
				return [{ acquired: 1 }];
			}
			return [];
		});

		await expect(withTimeLogSplitLock(dataSourceOf(type), LOG_ID, work)).resolves.toBe(true);

		expect(steps).toEqual([
			'connect',
			'SELECT GET_LOCK(?, ?) AS `acquired`',
			'split',
			'SELECT RELEASE_LOCK(?)',
			'release'
		]);
		expect(runner.query).toHaveBeenNthCalledWith(1, expect.any(String), [
			LOCK_NAME,
			TIME_LOG_SPLIT_LOCK_WAIT_SECONDS
		]);
		expect(LOCK_NAME.length).toBeLessThanOrEqual(64);
	});

	it.each([0, null])(
		'raises a busy split, without splitting, when MySQL answers %s to the named lock',
		async (acquired) => {
			const { steps, dataSourceOf, work } = connection(() => [{ acquired }]);

			await expect(withTimeLogSplitLock(dataSourceOf('mysql'), LOG_ID, work)).rejects.toBeInstanceOf(
				TimeLogSplitBusyError
			);

			expect(work).not.toHaveBeenCalled();
			expect(steps).not.toContain('SELECT RELEASE_LOCK(?)');
			expect(steps[steps.length - 1]).toBe('release');
		}
	);

	it.each(['sqlite', 'better-sqlite3'])('splits a %s log as it is: one writer, one API process', async (type) => {
		const { runner, dataSourceOf, work } = connection();

		await expect(withTimeLogSplitLock(dataSourceOf(type), LOG_ID, work)).resolves.toBe(true);

		expect(runner.connect).not.toHaveBeenCalled();
	});

	it('splits as it is without a data source', async () => {
		const work = jest.fn(async () => true);

		await expect(withTimeLogSplitLock(undefined, LOG_ID, work)).resolves.toBe(true);
	});
});
