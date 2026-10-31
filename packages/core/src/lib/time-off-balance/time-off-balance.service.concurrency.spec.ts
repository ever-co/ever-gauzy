import '../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { DataSource, EntitySchema, Repository } from 'typeorm';
import { RequestContext } from '../core/context';
import { TimeOffPolicy } from '../core/entities/internal';
import { TimeOffBalance } from './time-off-balance.entity';
import { TimeOffBalanceService } from './time-off-balance.service';

/**
 * The two concurrency-sensitive paths of the leave ledger (ever-co/ever-gauzy#10183, item 4), on a real better-sqlite
 * database:
 *
 * - `deduct` under two simultaneous callers: it is ONE conditional UPDATE, so the database decides; a
 *   read-modify-write pair would let both callers read the same `taken` and spend the same days twice;
 * - `carryForward` re-run: both sides are SET to the computed value, so a second run recomputes instead of
 *   shrinking the balance a second time.
 *
 * The schemas map the columns the statements read and write onto the real classes.
 */

jest.mock('../user-organization/assert-organization-membership', () => ({
	// The organization checks are covered in `time-off-balance.service.spec.ts`.
	assertCurrentUserBelongsToOrganization: jest.fn(async () => undefined)
}));

const TENANT = 'tenant-1';
const ORGANIZATION = 'org-1';
const EMPLOYEE = 'employee-1';
const POLICY = 'policy-1';

const audit = {
	createdAt: { type: 'datetime', createDate: true },
	updatedAt: { type: 'datetime', updateDate: true },
	deletedAt: { type: 'datetime', nullable: true, deleteDate: true }
};

const BalanceSchema = new EntitySchema<TimeOffBalance>({
	name: 'TimeOffBalance',
	target: TimeOffBalance,
	tableName: 'time_off_balance',
	columns: {
		id: { type: 'varchar', primary: true, generated: 'uuid' },
		tenantId: { type: 'varchar' },
		organizationId: { type: 'varchar' },
		employeeId: { type: 'varchar' },
		policyId: { type: 'varchar' },
		year: { type: 'int' },
		accrued: { type: 'numeric', default: 0 },
		taken: { type: 'numeric', default: 0 },
		carriedForward: { type: 'numeric', default: 0 },
		carriedOut: { type: 'numeric', default: 0 },
		remaining: { type: 'numeric', default: 0 },
		...audit
	} as any,
	indices: [{ columns: ['tenantId', 'organizationId', 'employeeId', 'policyId', 'year'], unique: true }]
});

const PolicySchema = new EntitySchema<TimeOffPolicy>({
	name: 'TimeOffPolicy',
	target: TimeOffPolicy,
	tableName: 'time_off_policy',
	columns: {
		id: { type: 'varchar', primary: true },
		tenantId: { type: 'varchar' },
		organizationId: { type: 'varchar' },
		allowCarryForward: { type: 'boolean', nullable: true },
		maxCarryForwardDays: { type: 'numeric', nullable: true },
		...audit
	} as any
});

describe('TimeOffBalanceService under concurrent and repeated writes', () => {
	let dataSource: DataSource;
	let balances: Repository<TimeOffBalance>;
	let service: TimeOffBalanceService;

	const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
	const key = { ...scope, employeeId: EMPLOYEE, policyId: POLICY };

	const read = async (year: number) => {
		const row = await balances.findOneOrFail({ where: { ...key, year } as any });
		return {
			accrued: Number(row.accrued),
			taken: Number(row.taken),
			carriedForward: Number(row.carriedForward),
			carriedOut: Number(row.carriedOut),
			remaining: Number(row.remaining)
		};
	};

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [BalanceSchema, PolicySchema],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		balances = dataSource.getRepository(TimeOffBalance);
		service = new TimeOffBalanceService(balances as any, {} as any);
	});

	afterAll(async () => {
		await dataSource?.destroy();
	});

	beforeEach(async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		await balances.clear();
		await dataSource.getRepository(TimeOffPolicy).clear();
		await dataSource
			.getRepository(TimeOffPolicy)
			.insert({ id: POLICY, ...scope, allowCarryForward: true, maxCarryForwardDays: null } as any);
	});

	afterEach(() => jest.restoreAllMocks());

	describe('deduct, by two callers at once', () => {
		const deduct = (days: number) => service.deduct({ ...key, year: 2026, days } as any);

		it('spends the days once: the second caller finds them gone and is refused', async () => {
			// 8 days left; each caller asks for 5.
			await balances.insert({ ...key, year: 2026, accrued: 10, taken: 2, remaining: 8 } as any);

			const results = await Promise.allSettled([deduct(5), deduct(5)]);

			expect(results.map(({ status }) => status).sort()).toEqual(['fulfilled', 'rejected']);
			const refusal = results.find((result): result is PromiseRejectedResult => result.status === 'rejected');
			expect(refusal.reason).toBeInstanceOf(BadRequestException);
			expect(await read(2026)).toMatchObject({ taken: 7, remaining: 3 });
		});

		it('spends both when there is enough for both', async () => {
			await balances.insert({ ...key, year: 2026, accrued: 10, taken: 0, remaining: 10 } as any);

			await Promise.all([deduct(4), deduct(5)]);

			expect(await read(2026)).toMatchObject({ taken: 9, remaining: 1 });
		});
	});

	describe('carryForward, run again', () => {
		const carryForward = (maxCarryForwardDays?: number) =>
			service.carryForward({ ...scope, policyId: POLICY, fromYear: 2025, toYear: 2026, maxCarryForwardDays } as any);

		beforeEach(async () => {
			// 7 unused days in 2025.
			await balances.insert({ ...key, year: 2025, accrued: 10, taken: 3, remaining: 7 } as any);
		});

		it('moves the unused days once, and a re-run changes nothing', async () => {
			await expect(carryForward()).resolves.toEqual({ carried: 1 });
			const first = { from: await read(2025), to: await read(2026) };

			await expect(carryForward()).resolves.toEqual({ carried: 1 });

			expect(first).toEqual({
				from: { accrued: 10, taken: 3, carriedForward: 0, carriedOut: 7, remaining: 0 },
				to: { accrued: 0, taken: 0, carriedForward: 7, carriedOut: 0, remaining: 7 }
			});
			expect({ from: await read(2025), to: await read(2026) }).toEqual(first);
		});

		it('keeps the cap on a re-run, and leaves the rest in the source year', async () => {
			await carryForward(5);
			await carryForward(5);

			expect(await read(2025)).toMatchObject({ carriedOut: 5, remaining: 2 });
			expect(await read(2026)).toMatchObject({ carriedForward: 5, remaining: 5 });
		});

		it('keeps what the target year already accrued and took', async () => {
			await balances.insert({ ...key, year: 2026, accrued: 20, taken: 4, remaining: 16 } as any);

			await carryForward();
			await carryForward();

			expect(await read(2026)).toEqual({ accrued: 20, taken: 4, carriedForward: 7, carriedOut: 0, remaining: 23 });
		});
	});
});
