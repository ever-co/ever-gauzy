// Must stay first: loads the entity graph before the handler pulls an entity.
import '../../../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { StatusTypesEnum, StatusTypesMapRequestApprovalEnum } from '@gauzy/contracts';
import { TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { coreEntities } from '../../../core/entities';
import { RequestContext } from '../../../core/context';
import { CreateTimeOffBalanceDeductionTable1791000003630 } from '../../../database/migrations/1791000003630-CreateTimeOffBalanceDeductionTable';
import { TimeOffBalanceDeductionService } from '../../../time-off-balance/time-off-balance-deduction.service';
import { TimeOffRequest } from '../../time-off-request.entity';
import { TimeOffStatusCommand } from '../time-off.status.command';
import { TimeOffStatusHandler } from './time-off.status.handler';

/**
 * Leave balances follow the approve / deny decision (ever-co/ever-gauzy#10183, item 1), on a real better-sqlite3
 * database whose tables TypeORM created from the real entities, as the migrations create them in an installation —
 * and whose `time_off_balance_deduction` table is the one its migration creates, which TypeORM must find nothing to
 * change in.
 *
 * - Approving a request takes its working days (weekdays, less the organization's official holidays, split per
 *   calendar year) from the balance each employee has for the request's policy and year, in the decision's
 *   transaction.
 * - No balance row: approval works exactly as before, and nothing is created.
 * - A balance without the days left refuses the approval (400): the request, its approval and the balance stay as
 *   they were.
 * - Denying an approved request gives back what its approval took, and only that; deciding a request the way it is
 *   already decided moves nothing, so a repeated or concurrent approval never deducts twice.
 */

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	// SQLite: no row locks, its transactions are serialized instead (see the handler).
	isPostgres: jest.fn(() => false),
	isMySQL: jest.fn(() => false)
}));

const TIMEOUT = 5 * 60 * 1000;

type Row = Record<string, any>;

const TENANT = '0f7c1a2e-0000-4000-8000-00000000a001';
const ORG = '0f7c1a2e-0000-4000-8000-00000000b001';
const USER = '0f7c1a2e-0000-4000-8000-00000000c001';
const EMPLOYEE = '0f7c1a2e-0000-4000-8000-00000000d001';
const COLLEAGUE = '0f7c1a2e-0000-4000-8000-00000000d002';
const POLICY = '0f7c1a2e-0000-4000-8000-00000000e001';
const OTHER_POLICY = '0f7c1a2e-0000-4000-8000-00000000e002';
const LEAVE = '0f7c1a2e-0000-4000-8000-00000000f001';
const APPROVAL = '0f7c1a2e-0000-4000-8000-000000002001';

const scope = { tenantId: TENANT, organizationId: ORG };

/** Monday 2 to Sunday 8 November 2026, picked in Berlin: each day stored as 23:00 UTC the day before. */
const WEEK = { start: '2026-11-01 23:00:00.000', end: '2026-11-07 23:00:00.000' };

describe('TimeOffStatusHandler moves leave balances with the decision', () => {
	let dataSource: DataSource;
	let handler: TimeOffStatusHandler;
	let balanceSequence = 0;

	const insert = async (table: string, row: Row): Promise<void> => {
		const columns = Object.keys(row);
		await dataSource.query(
			`INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${columns
				.map(() => '?')
				.join(', ')})`,
			columns.map((column) => row[column])
		);
	};

	/** A request of the employees named, under the policy named, `REQUESTED` unless stated. */
	const fileLeave = async (
		{ employees = [EMPLOYEE], status = StatusTypesEnum.REQUESTED, policyId = POLICY, ...row }: Row = {}
	): Promise<void> => {
		await insert('time_off_request', {
			id: LEAVE,
			...WEEK,
			requestDate: '2026-10-20 00:00:00.000',
			status,
			policyId,
			isHoliday: 0,
			...scope,
			...row
		});
		for (const employeeId of employees) {
			await insert('time_off_request_employee', { timeOffRequestId: LEAVE, employeeId });
		}
		await insert('request_approval', {
			id: APPROVAL,
			requestId: LEAVE,
			requestType: 'TIME_OFF',
			name: 'Request time off',
			min_count: 1,
			status: StatusTypesMapRequestApprovalEnum[status as StatusTypesEnum],
			...scope
		});
	};

	/** A balance of `accrued` days, `taken` of them taken. */
	const allocate = async ({
		employeeId = EMPLOYEE,
		policyId = POLICY,
		year = 2026,
		accrued = 20,
		taken = 0
	}: Row = {}): Promise<string> => {
		const id = `0f7c1a2e-0000-4000-8000-${String(++balanceSequence).padStart(12, '0')}`;
		await insert('time_off_balance', {
			id,
			...scope,
			employeeId,
			policyId,
			year,
			accrued,
			taken,
			carriedForward: 0,
			carriedOut: 0,
			remaining: accrued - taken
		});
		return id;
	};

	const holiday = (row: Row): Promise<void> =>
		insert('official_holiday', {
			id: `0f7c1a2e-0000-4000-8000-${String(++balanceSequence).padStart(12, '0')}`,
			name: `holiday ${balanceSequence}`,
			countryCode: 'DE',
			...scope,
			...row
		});

	const balance = async (id: string): Promise<{ taken: number; remaining: number }> => {
		const [row] = await dataSource.query(`SELECT "taken", "remaining" FROM "time_off_balance" WHERE "id" = ?`, [id]);
		return { taken: Number(row.taken), remaining: Number(row.remaining) };
	};

	const deductions = async (): Promise<Row[]> =>
		(
			await dataSource.query(
				`SELECT "balanceId", "days", "tenantId", "organizationId" FROM "time_off_balance_deduction" WHERE "timeOffRequestId" = ? ORDER BY "balanceId"`,
				[LEAVE]
			)
		).map((row: Row) => ({ ...row, days: Number(row.days) }));

	const statuses = async (): Promise<{ leave: string; approval: number }> => {
		const [leave] = await dataSource.query(`SELECT "status" FROM "time_off_request" WHERE "id" = ?`, [LEAVE]);
		const [approval] = await dataSource.query(`SELECT "status" FROM "request_approval" WHERE "id" = ?`, [APPROVAL]);
		return { leave: leave.status, approval: Number(approval.status) };
	};

	const decide = (status: StatusTypesEnum) => handler.execute(new TimeOffStatusCommand(LEAVE, status));

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: coreEntities,
			synchronize: true,
			logging: false,
			invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
		});
		await dataSource.initialize();

		// The fixtures name rows of tables this suite has no reason to fill (users, the employees' users).
		await dataSource.query('PRAGMA foreign_keys = OFF');

		// The deduction table as an installation gets it: from its migration, not from `synchronize`.
		await dataSource.query(`DROP TABLE "time_off_balance_deduction"`);
		const queryRunner = dataSource.createQueryRunner();
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		try {
			await new CreateTimeOffBalanceDeductionTable1791000003630().up(queryRunner);
		} finally {
			await queryRunner.release();
			jest.restoreAllMocks();
		}

		const leaves = dataSource.getRepository(TimeOffRequest);
		handler = new TimeOffStatusHandler(leaves as any, {} as any, new TimeOffBalanceDeductionService());
	}, TIMEOUT);

	afterAll(async () => {
		await dataSource?.destroy();
	});

	beforeEach(async () => {
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		for (const table of [
			'time_off_balance_deduction',
			'time_off_balance',
			'official_holiday',
			'request_approval',
			'time_off_request_employee',
			'time_off_request',
			'time_off_policy',
			'employee',
			'organization',
			'tenant'
		]) {
			await dataSource.query(`DELETE FROM "${table}"`);
		}
		await insert('tenant', { id: TENANT, name: 'tenant' });
		await insert('organization', {
			id: ORG,
			tenantId: TENANT,
			name: 'organization',
			currency: 'EUR',
			timeZone: 'Europe/Berlin'
		});
		await insert('employee', { id: EMPLOYEE, userId: USER, ...scope });
		await insert('employee', { id: COLLEAGUE, userId: USER, ...scope });
		for (const id of [POLICY, OTHER_POLICY]) {
			await insert('time_off_policy', { id, name: `policy ${id.slice(-1)}`, requiresApproval: 1, paid: 1, ...scope });
		}
	});

	afterEach(() => jest.restoreAllMocks());

	it('creates the deduction table through its migration exactly as the entity maps it', async () => {
		const { upQueries } = await dataSource.driver.createSchemaBuilder().log();

		expect(
			upQueries.map(({ query }) => query).filter((query) => query.includes('time_off_balance_deduction'))
		).toEqual([]);
		const indexes: Row[] = await dataSource.query(`PRAGMA index_list("time_off_balance_deduction")`);
		expect(indexes.find(({ name }) => name === 'IDX_time_off_balance_deduction_unique')).toMatchObject({ unique: 1 });
	});

	describe('no balance row: approval works exactly as before', () => {
		it('approves, and creates no balance and no deduction', async () => {
			await fileLeave();

			await expect(decide(StatusTypesEnum.APPROVED)).resolves.toMatchObject({ status: StatusTypesEnum.APPROVED });

			expect(await statuses()).toEqual({
				leave: StatusTypesEnum.APPROVED,
				approval: StatusTypesMapRequestApprovalEnum.APPROVED
			});
			expect(await dataSource.query(`SELECT * FROM "time_off_balance"`)).toEqual([]);
			expect(await deductions()).toEqual([]);
		});

		it('takes nothing from a balance of another policy or another year', async () => {
			const otherPolicy = await allocate({ policyId: OTHER_POLICY });
			const otherYear = await allocate({ year: 2027 });
			await fileLeave();

			await decide(StatusTypesEnum.APPROVED);

			expect(await balance(otherPolicy)).toEqual({ taken: 0, remaining: 20 });
			expect(await balance(otherYear)).toEqual({ taken: 0, remaining: 20 });
			expect(await deductions()).toEqual([]);
		});
	});

	describe('a balance with the days left', () => {
		it('takes the working days of the request, and records them', async () => {
			const id = await allocate({ accrued: 20, taken: 3 });
			await fileLeave();

			await decide(StatusTypesEnum.APPROVED);

			// Monday to Friday, in Berlin, where the days were picked.
			expect(await balance(id)).toEqual({ taken: 8, remaining: 12 });
			expect(await deductions()).toEqual([{ balanceId: id, days: 5, ...scope }]);
		});

		it('leaves out the weekend and the organization official holidays, one-off and recurring', async () => {
			const id = await allocate();
			await holiday({ date: '2026-11-03', isRecurring: 0 });
			await holiday({ date: '2001-11-05', isRecurring: 1 });
			// Another organization's holiday is not this one's.
			await holiday({ date: '2026-11-04', isRecurring: 0, organizationId: '0f7c1a2e-0000-4000-8000-00000000b002' });
			await fileLeave();

			await decide(StatusTypesEnum.APPROVED);

			expect(await balance(id)).toEqual({ taken: 3, remaining: 17 });
		});

		it('takes from the balance of each employee of the request', async () => {
			const mine = await allocate();
			const theirs = await allocate({ employeeId: COLLEAGUE, accrued: 10 });
			await fileLeave({ employees: [EMPLOYEE, COLLEAGUE] });

			await decide(StatusTypesEnum.APPROVED);

			expect(await balance(mine)).toEqual({ taken: 5, remaining: 15 });
			expect(await balance(theirs)).toEqual({ taken: 5, remaining: 5 });
			expect((await deductions()).map(({ balanceId }) => balanceId).sort()).toEqual([mine, theirs].sort());
		});

		it('splits a request across 31 December between the balances of the two years', async () => {
			const thisYear = await allocate({ year: 2026 });
			const nextYear = await allocate({ year: 2027 });
			// Monday 28 December 2026 to Friday 8 January 2027, picked in Berlin.
			await fileLeave({ start: '2026-12-27 23:00:00.000', end: '2027-01-07 23:00:00.000' });

			await decide(StatusTypesEnum.APPROVED);

			expect(await balance(thisYear)).toEqual({ taken: 4, remaining: 16 });
			expect(await balance(nextYear)).toEqual({ taken: 6, remaining: 14 });
		});

		it('takes the year that has a balance, and nothing for the year that has none', async () => {
			const thisYear = await allocate({ year: 2026 });
			await fileLeave({ start: '2026-12-27 23:00:00.000', end: '2027-01-07 23:00:00.000' });

			await decide(StatusTypesEnum.APPROVED);

			expect(await balance(thisYear)).toEqual({ taken: 4, remaining: 16 });
			expect(await deductions()).toEqual([{ balanceId: thisYear, days: 4, ...scope }]);
		});
	});

	describe('a balance without the days left', () => {
		it('refuses the approval (400), and writes nothing', async () => {
			const id = await allocate({ accrued: 6, taken: 2 });
			await fileLeave();

			await expect(decide(StatusTypesEnum.APPROVED)).rejects.toBeInstanceOf(BadRequestException);

			expect(await statuses()).toEqual({
				leave: StatusTypesEnum.REQUESTED,
				approval: StatusTypesMapRequestApprovalEnum.REQUESTED
			});
			expect(await balance(id)).toEqual({ taken: 2, remaining: 4 });
			expect(await deductions()).toEqual([]);
		});

		it('rolls back what another employee balance already took', async () => {
			const enough = await allocate({ accrued: 20 });
			const short = await allocate({ employeeId: COLLEAGUE, accrued: 1 });
			await fileLeave({ employees: [EMPLOYEE, COLLEAGUE] });

			await expect(decide(StatusTypesEnum.APPROVED)).rejects.toBeInstanceOf(BadRequestException);

			expect(await balance(enough)).toEqual({ taken: 0, remaining: 20 });
			expect(await balance(short)).toEqual({ taken: 0, remaining: 1 });
			expect(await deductions()).toEqual([]);
		});
	});

	describe('taking the approval back', () => {
		it('denying an approved request gives back what its approval took', async () => {
			const id = await allocate({ accrued: 20, taken: 3 });
			await fileLeave();
			await decide(StatusTypesEnum.APPROVED);

			await decide(StatusTypesEnum.DENIED);

			expect(await statuses()).toEqual({
				leave: StatusTypesEnum.DENIED,
				approval: StatusTypesMapRequestApprovalEnum.DENIED
			});
			expect(await balance(id)).toEqual({ taken: 3, remaining: 17 });
			expect(await deductions()).toEqual([]);
		});

		it('gives back what was taken, not a recount: a holiday added since changes nothing', async () => {
			const id = await allocate();
			await fileLeave();
			await decide(StatusTypesEnum.APPROVED);
			await holiday({ date: '2026-11-04', isRecurring: 0 });

			await decide(StatusTypesEnum.DENIED);

			expect(await balance(id)).toEqual({ taken: 0, remaining: 20 });
		});

		it('gives back nothing for a request approved before balances followed approvals', async () => {
			const id = await allocate({ accrued: 20, taken: 7 });
			await fileLeave({ status: StatusTypesEnum.APPROVED });

			await decide(StatusTypesEnum.DENIED);

			expect(await statuses()).toMatchObject({ leave: StatusTypesEnum.DENIED });
			expect(await balance(id)).toEqual({ taken: 7, remaining: 13 });
		});

		it('gives back nothing to a balance allocated after the approval', async () => {
			await fileLeave();
			await decide(StatusTypesEnum.APPROVED);
			const id = await allocate({ accrued: 20, taken: 2 });

			await decide(StatusTypesEnum.DENIED);

			expect(await balance(id)).toEqual({ taken: 2, remaining: 18 });
		});

		it('approving the denied request again takes the days again', async () => {
			const id = await allocate();
			await fileLeave();
			await decide(StatusTypesEnum.APPROVED);
			await decide(StatusTypesEnum.DENIED);

			await decide(StatusTypesEnum.APPROVED);

			expect(await balance(id)).toEqual({ taken: 5, remaining: 15 });
			expect(await deductions()).toEqual([{ balanceId: id, days: 5, ...scope }]);
		});
	});

	describe('idempotent', () => {
		it('approving an approved request again takes nothing more', async () => {
			const id = await allocate();
			await fileLeave();
			await decide(StatusTypesEnum.APPROVED);

			await decide(StatusTypesEnum.APPROVED);

			expect(await balance(id)).toEqual({ taken: 5, remaining: 15 });
			expect(await deductions()).toHaveLength(1);
		});

		it('an approval that read the request before another approval committed takes nothing again', async () => {
			// On PostgreSQL and MySQL the leave's row lock makes the second approval wait and then read APPROVED. Should
			// one still get past it with the REQUESTED it read first, the recorded deduction stops it.
			const id = await allocate();
			await fileLeave();
			const [leave] = await dataSource.query(`SELECT * FROM "time_off_request" WHERE "id" = ?`, [LEAVE]);
			const deductionService = new TimeOffBalanceDeductionService();

			await deductionService.settle(dataSource.manager, leave, StatusTypesEnum.APPROVED);
			await expect(deductionService.settle(dataSource.manager, leave, StatusTypesEnum.APPROVED)).resolves.toBeUndefined();

			expect(await balance(id)).toEqual({ taken: 5, remaining: 15 });
			expect(await deductions()).toHaveLength(1);
		});

		it('denying a denied request again gives nothing back twice', async () => {
			const id = await allocate({ accrued: 20, taken: 4 });
			await fileLeave();
			await decide(StatusTypesEnum.APPROVED);
			await decide(StatusTypesEnum.DENIED);

			await decide(StatusTypesEnum.DENIED);

			expect(await balance(id)).toEqual({ taken: 4, remaining: 16 });
		});

		it('denying a request that was never approved moves nothing', async () => {
			const id = await allocate({ accrued: 20, taken: 4 });
			await fileLeave();

			await decide(StatusTypesEnum.DENIED);

			expect(await balance(id)).toEqual({ taken: 4, remaining: 16 });
		});
	});

	describe('requests that take nothing', () => {
		it('a holiday entry', async () => {
			const id = await allocate();
			await fileLeave({ isHoliday: 1 });

			await decide(StatusTypesEnum.APPROVED);

			expect(await balance(id)).toEqual({ taken: 0, remaining: 20 });
		});

		it('a request of weekend days only', async () => {
			const id = await allocate();
			// Saturday 7 and Sunday 8 November 2026.
			await fileLeave({ start: '2026-11-06 23:00:00.000', end: '2026-11-07 23:00:00.000' });

			await decide(StatusTypesEnum.APPROVED);

			expect(await balance(id)).toEqual({ taken: 0, remaining: 20 });
			expect(await deductions()).toEqual([]);
		});
	});

	it('refuses a second deduction of one request from one balance at the database (unique index)', async () => {
		const id = await allocate();
		await fileLeave();
		const row = { ...scope, timeOffRequestId: LEAVE, balanceId: id, days: 1 };
		await insert('time_off_balance_deduction', { id: '0f7c1a2e-0000-4000-8000-0000000d0001', ...row });

		await expect(
			insert('time_off_balance_deduction', { id: '0f7c1a2e-0000-4000-8000-0000000d0002', ...row })
		).rejects.toThrow(/UNIQUE/);
	});

	it('keeps one balance per employee, policy and year at the database (unique index), which the lookup relies on', async () => {
		await allocate();

		await expect(allocate()).rejects.toThrow(/UNIQUE/);
		// Another year, policy or employee is another balance.
		await expect(allocate({ year: 2027 })).resolves.toEqual(expect.any(String));
		await expect(allocate({ policyId: OTHER_POLICY })).resolves.toEqual(expect.any(String));
		await expect(allocate({ employeeId: COLLEAGUE })).resolves.toEqual(expect.any(String));
	});
});
