import '../core/entities/internal';

import { DataSource, EntitySchema, Logger, Repository } from 'typeorm';
import { TimeOffBalance } from './time-off-balance.entity';
import { TimeOffBalanceService } from './time-off-balance.service';

/**
 * #10750: deduct and reverse move days between `taken` and `remaining` in one UPDATE. MySQL evaluates
 * single-table SET assignments left to right, so with `taken` first, `remaining` read the NEW `taken` and
 * was off by the days just moved. `remaining` is now assigned first, so it reads the old `taken` on every
 * engine. PostgreSQL and SQLite evaluate the right-hand sides against the old row either way: the stored
 * values below are the same as before, and the statement's order is the part MySQL depends on.
 *
 * A real better-sqlite database; the schema maps the columns the statement reads and writes onto the real class.
 */

const KEY = {
	employeeId: 'employee-1',
	policyId: 'policy-1',
	year: 2026,
	organizationId: 'org-1',
	tenantId: 'tenant-1'
};

const BalanceSchema = new EntitySchema<TimeOffBalance>({
	name: 'TimeOffBalance',
	target: TimeOffBalance,
	tableName: 'time_off_balance',
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar' },
		organizationId: { type: 'varchar' },
		employeeId: { type: 'varchar' },
		policyId: { type: 'varchar' },
		year: { type: 'int' },
		accrued: { type: 'numeric' },
		taken: { type: 'numeric' },
		carriedForward: { type: 'numeric' },
		carriedOut: { type: 'numeric' },
		remaining: { type: 'numeric' },
		deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
	} as any
});

describe('TimeOffBalanceService.applyDelta — one UPDATE that MySQL evaluates in order', () => {
	const updates: string[] = [];
	const logger: Logger = {
		logQuery: (query) => {
			if (/^UPDATE/i.test(query)) updates.push(query);
		},
		logQueryError: () => undefined,
		logQuerySlow: () => undefined,
		logSchemaBuild: () => undefined,
		logMigration: () => undefined,
		log: () => undefined
	};

	let dataSource: DataSource;
	let balances: Repository<TimeOffBalance>;
	let service: TimeOffBalanceService;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [BalanceSchema],
			synchronize: true,
			logging: ['query'],
			logger
		});
		await dataSource.initialize();
		balances = dataSource.getRepository(TimeOffBalance);
		service = new TimeOffBalanceService(balances as any, {} as any);
	});

	afterAll(async () => {
		await dataSource?.destroy();
	});

	beforeEach(async () => {
		updates.length = 0;
		await balances.clear();
		// 10 accrued + 2 carried forward - 1 carried out = 11 available, 3 of them taken
		await balances.insert({
			id: 'balance-1',
			...KEY,
			accrued: 10,
			carriedForward: 2,
			carriedOut: 1,
			taken: 3,
			remaining: 8
		} as any);
	});

	/** Moves `days` with `applyDelta`, as `deduct` (spending) and `reverse` do, and reads the row back. */
	async function apply(days: number, spending: boolean) {
		const { employeeId, policyId, year, organizationId, tenantId } = KEY;
		const affected = await (service as any).applyDelta(
			employeeId,
			policyId,
			year,
			days,
			organizationId,
			tenantId,
			spending
		);
		const row = await balances.findOneOrFail({ where: { id: 'balance-1' } as any });
		return { affected, taken: Number(row.taken), remaining: Number(row.remaining) };
	}

	it('assigns remaining before taken, so remaining reads the taken it replaces', async () => {
		await apply(2, true);

		expect(updates).toHaveLength(1);
		const set = updates[0].slice(updates[0].search(/\bSET\b/i), updates[0].search(/\bWHERE\b/i));
		expect(set.indexOf('"remaining" =')).toBeGreaterThan(-1);
		expect(set.indexOf('"remaining" =')).toBeLessThan(set.indexOf('"taken" ='));
	});

	it('a deduction moves the days from remaining to taken', async () => {
		expect(await apply(2, true)).toEqual({ affected: 1, taken: 5, remaining: 6 });
	});

	it('a deduction beyond what is left changes nothing', async () => {
		expect(await apply(9, true)).toEqual({ affected: 0, taken: 3, remaining: 8 });
	});

	it('a reversal moves the days back', async () => {
		expect(await apply(1, false)).toEqual({ affected: 1, taken: 2, remaining: 9 });
	});

	it('a reversal larger than taken clamps taken at zero', async () => {
		expect(await apply(5, false)).toEqual({ affected: 1, taken: 0, remaining: 11 });
	});
});
