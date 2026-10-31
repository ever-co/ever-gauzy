// Must stay first: loads the entity graph before the service pulls an entity.
import '../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { StatusTypesEnum } from '@gauzy/contracts';
import { isPostgres, TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR } from '@gauzy/config';
import { coreEntities } from '../core/entities';
import { RequestContext } from '../core/context';
import { CrudService } from '../core/crud/crud.service';
import { MultiORMEnum } from '../core/utils';
import { TimeOffBalanceDeductionService } from '../time-off-balance/time-off-balance-deduction.service';
import { typeOrmTimeOffBalanceLedger } from '../time-off-balance/time-off-balance-ledger';
import { TypeOrmTimeOffRequestRepository } from './repository/type-orm-time-off-request.repository';
import { TimeOffRequest } from './time-off-request.entity';
import { TimeOffRequestService } from './time-off-request.service';

/**
 * The days an approval took from leave balances follow the approved request afterwards (ever-co/ever-gauzy#10183,
 * #11601 review), on a real better-sqlite3 database whose tables TypeORM created from the real entities.
 *
 * - An edit of its dates, employees, policy or holiday flag gives back what the approval took and takes what the
 *   edited request takes, on one transaction with the edit; a policy that requires sufficient balance refuses an
 *   edit its balances cannot cover, and the edit is not saved. Any other edit, and an edit of a request whose
 *   approval took nothing, saves as before.
 * - Deleting it gives its days back before the cascade removes the record of them.
 * - Withdrawing it (soft delete) gives its days back; putting it back takes them again, and only those a withdrawal
 *   gave back.
 */

jest.mock('@gauzy/config', () => ({
	...jest.requireActual('@gauzy/config'),
	// SQLite: no row locks, its transactions are serialized instead (see the service).
	isPostgres: jest.fn(() => false),
	isMySQL: jest.fn(() => false)
}));

const TIMEOUT = 5 * 60 * 1000;

type Row = Record<string, any>;

const TENANT = '0f7c1a2e-0000-4000-8000-00000000a001';
const OTHER_TENANT = '0f7c1a2e-0000-4000-8000-00000000a002';
const ORG = '0f7c1a2e-0000-4000-8000-00000000b001';
const USER = '0f7c1a2e-0000-4000-8000-00000000c001';
const EMPLOYEE = '0f7c1a2e-0000-4000-8000-00000000d001';
const COLLEAGUE = '0f7c1a2e-0000-4000-8000-00000000d002';
const POLICY = '0f7c1a2e-0000-4000-8000-00000000e001';
const OTHER_POLICY = '0f7c1a2e-0000-4000-8000-00000000e002';
const LEAVE = '0f7c1a2e-0000-4000-8000-00000000f001';

const scope = { tenantId: TENANT, organizationId: ORG };

/** Monday 2 to Sunday 8 November 2026, picked in Berlin (five working days): each day stored as 23:00 UTC before. */
const WEEK = { start: '2026-11-01 23:00:00.000', end: '2026-11-07 23:00:00.000' };
/** Monday 2 to Wednesday 4 November 2026, picked in Berlin: three working days. */
const THREE_DAYS = { start: '2026-11-01T23:00:00.000Z', end: '2026-11-03T23:00:00.000Z' };
/** Saturday 7 and Sunday 8 November 2026, picked in Berlin: no working day. */
const WEEKEND = { start: '2026-11-06T23:00:00.000Z', end: '2026-11-07T23:00:00.000Z' };
/** The week again, as the request dialog sends it. */
const WORKING_WEEK = { start: '2026-11-01T23:00:00.000Z', end: '2026-11-07T23:00:00.000Z' };

describe('TimeOffRequestService keeps the leave balance with an approved request', () => {
	let dataSource: DataSource;
	let service: TimeOffRequestService;
	let balanceSequence = 0;
	const deductionService = new TimeOffBalanceDeductionService();

	const insert = async (table: string, row: Row): Promise<void> => {
		const columns = Object.keys(row);
		await dataSource.query(
			`INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(', ')}) VALUES (${columns
				.map(() => '?')
				.join(', ')})`,
			columns.map((column) => row[column])
		);
	};

	/** A request of the employees named, under the policy named, `APPROVED` unless stated. */
	const fileLeave = async ({
		id = LEAVE,
		employees = [EMPLOYEE],
		status = StatusTypesEnum.APPROVED,
		policyId = POLICY,
		...row
	}: Row = {}): Promise<void> => {
		await insert('time_off_request', {
			id,
			...WEEK,
			requestDate: '2026-10-20 00:00:00.000',
			description: 'leave',
			status,
			policyId,
			isHoliday: 0,
			...scope,
			...row
		});
		for (const employeeId of employees) {
			await insert('time_off_request_employee', { timeOffRequestId: id, employeeId });
		}
	};

	/** What the approval of the request took, as the approve route takes it. */
	const approvalTakes = async (id = LEAVE): Promise<void> => {
		const leave = await dataSource.manager.findOne(TimeOffRequest, {
			where: { id },
			withDeleted: true,
			loadEagerRelations: false
		});
		await dataSource.transaction((manager) => deductionService.deduct(typeOrmTimeOffBalanceLedger(manager), leave));
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

	const balance = async (id: string): Promise<{ taken: number; remaining: number }> => {
		const [row] = await dataSource.query(`SELECT "taken", "remaining" FROM "time_off_balance" WHERE "id" = ?`, [
			id
		]);
		return { taken: Number(row.taken), remaining: Number(row.remaining) };
	};

	/** The deductions recorded for the request; `withdrawn` says whether a withdrawal gave them back. */
	const deductions = async (id = LEAVE): Promise<Row[]> =>
		(
			await dataSource.query(
				`SELECT "id", "balanceId", "days", "deletedAt" FROM "time_off_balance_deduction" WHERE "timeOffRequestId" = ? ORDER BY "balanceId"`,
				[id]
			)
		).map(({ id, balanceId, days, deletedAt }: Row) => ({ id, balanceId, days: Number(days), withdrawn: !!deletedAt }));

	const stored = async (id = LEAVE): Promise<Row | undefined> =>
		(await dataSource.query(`SELECT * FROM "time_off_request" WHERE "id" = ?`, [id]))[0];

	const requireSufficientBalance = (policyId = POLICY) =>
		dataSource.query(`UPDATE "time_off_policy" SET "requireSufficientBalance" = 1 WHERE "id" = ?`, [policyId]);

	const edit = (body: Row, id = LEAVE) => service.updateTimeOffByAdmin(id, body as any);

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

		// The fixtures name rows of tables this suite has no reason to fill (the employees' users).
		await dataSource.query('PRAGMA foreign_keys = OFF');
	}, TIMEOUT);

	afterAll(async () => {
		await dataSource?.destroy();
	});

	beforeEach(async () => {
		(isPostgres as jest.Mock).mockReturnValue(false);
		jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
		// A manager of the organization who may act for its employees, inside its organization boundary.
		jest.spyOn(RequestContext, 'currentUser').mockReturnValue({ id: USER, tenantId: TENANT, employeeId: null } as any);
		jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(USER);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORG);
		jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(null);
		jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);
		jest.spyOn(RequestContext, 'hasAnyPermission').mockReturnValue(true);
		jest.spyOn(RequestContext, 'hasRoles').mockReturnValue(false);

		service = new TimeOffRequestService(
			new TypeOrmTimeOffRequestRepository(dataSource.getRepository(TimeOffRequest)),
			{} as any,
			{} as any,
			deductionService
		);

		for (const table of [
			'time_off_balance_deduction',
			'time_off_balance',
			'official_holiday',
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
		await insert('tenant', { id: OTHER_TENANT, name: 'other tenant' });
		await insert('organization', {
			id: ORG,
			tenantId: TENANT,
			name: 'organization',
			currency: 'EUR',
			timeZone: 'Europe/Berlin'
		});
		await insert('employee', { id: EMPLOYEE, userId: USER, ...scope });
		await insert('employee', { id: COLLEAGUE, userId: USER, ...scope });
		await insert('time_off_policy', { id: POLICY, name: 'policy', requiresApproval: 1, paid: 1, ...scope });
		// Requires no approval, so a manager may move an approved request onto it.
		await insert('time_off_policy', { id: OTHER_POLICY, name: 'other', requiresApproval: 0, paid: 1, ...scope });
	});

	afterEach(() => jest.restoreAllMocks());

	describe('an edit of an approved request', () => {
		it('moves its charge with its dates: what the approval took goes back, what the edit takes is taken', async () => {
			const id = await allocate();
			await fileLeave();
			await approvalTakes();
			expect(await balance(id)).toEqual({ taken: 5, remaining: 15 });

			await edit({ ...THREE_DAYS, description: 'shorter' });

			expect(await balance(id)).toEqual({ taken: 3, remaining: 17 });
			expect(await deductions()).toEqual([expect.objectContaining({ balanceId: id, days: 3, withdrawn: false })]);
			expect(await stored()).toMatchObject({ description: 'shorter', status: StatusTypesEnum.APPROVED });
		});

		it('moves its charge with its employees', async () => {
			const mine = await allocate();
			const theirs = await allocate({ employeeId: COLLEAGUE });
			await fileLeave();
			await approvalTakes();

			await edit({ employees: [{ id: EMPLOYEE }, { id: COLLEAGUE }] });
			expect(await balance(mine)).toEqual({ taken: 5, remaining: 15 });
			expect(await balance(theirs)).toEqual({ taken: 5, remaining: 15 });

			await edit({ employees: [{ id: COLLEAGUE }] });
			expect(await balance(mine)).toEqual({ taken: 0, remaining: 20 });
			expect(await balance(theirs)).toEqual({ taken: 5, remaining: 15 });
			expect(await deductions()).toEqual([expect.objectContaining({ balanceId: theirs, days: 5 })]);
		});

		it('moves its charge onto the balance of the policy it is moved onto', async () => {
			const before = await allocate();
			const after = await allocate({ policyId: OTHER_POLICY });
			await fileLeave();
			await approvalTakes();

			await edit({ policy: { id: OTHER_POLICY } });

			expect(await balance(before)).toEqual({ taken: 0, remaining: 20 });
			expect(await balance(after)).toEqual({ taken: 5, remaining: 15 });
			expect(await stored()).toMatchObject({ policyId: OTHER_POLICY });
		});

		it('gives its days back when it becomes a holiday entry, and takes them again when it stops being one', async () => {
			const id = await allocate();
			await fileLeave();
			await approvalTakes();

			await edit({ isHoliday: true });

			expect(await balance(id)).toEqual({ taken: 0, remaining: 20 });
			// The record that it is charged stays, at zero days.
			expect(await deductions()).toEqual([expect.objectContaining({ balanceId: id, days: 0, withdrawn: false })]);

			await edit({ isHoliday: false });

			expect(await balance(id)).toEqual({ taken: 5, remaining: 15 });
			expect(await deductions()).toEqual([expect.objectContaining({ balanceId: id, days: 5 })]);
		});

		// #11608 review: an edit that left a charged request taking nothing used to drop every record of its charge, and
		// the edit back then took nothing, past even a policy that requires sufficient balance.
		it('keeps it charged through an edit to a weekend and back', async () => {
			const id = await allocate();
			await fileLeave();
			await approvalTakes();

			await edit(WEEKEND);
			expect(await balance(id)).toEqual({ taken: 0, remaining: 20 });
			expect(await deductions()).toEqual([expect.objectContaining({ balanceId: id, days: 0 })]);

			await edit(WORKING_WEEK);
			expect(await balance(id)).toEqual({ taken: 5, remaining: 15 });
			expect(await deductions()).toEqual([expect.objectContaining({ balanceId: id, days: 5 })]);
		});

		// #11608 review: a balance removed after the edit read its charge, and before it locked the balances, took the
		// charge's deductions with it (they cascade on delete); a zero-day record naming it would fail the edit on its
		// foreign key.
		it('records no charge on a balance removed before the edit locked it', async () => {
			const id = await allocate();
			await fileLeave();
			await approvalTakes();
			const leave = await dataSource.manager.findOne(TimeOffRequest, {
				where: { id: LEAVE },
				loadEagerRelations: false
			});
			const toWeekend = { ...leave, start: new Date(WEEKEND.start), end: new Date(WEEKEND.end) };

			await dataSource.transaction(async (manager) => {
				const ledger = typeOrmTimeOffBalanceLedger(manager);
				await deductionService.recharge(
					{
						...ledger,
						// Another transaction removes the balance, and the cascade its deduction; the lock no longer finds it.
						lockBalances: async (ids, tenantId) => {
							await manager.query(`DELETE FROM "time_off_balance_deduction" WHERE "balanceId" = ?`, [id]);
							await manager.query(`DELETE FROM "time_off_balance" WHERE "id" = ?`, [id]);
							return (await ledger.lockBalances(ids, tenantId)).filter((locked) => locked !== id);
						}
					},
					toWeekend as any
				);
			});

			expect(await deductions()).toEqual([]);
		});

		it('keeps it charged through an edit onto a policy it has no balance under, and back', async () => {
			const id = await allocate();
			await fileLeave();
			await approvalTakes();

			await edit({ policy: { id: OTHER_POLICY } });
			expect(await balance(id)).toEqual({ taken: 0, remaining: 20 });

			// Back onto a policy that requires approval: an administrator's edit.
			jest.spyOn(RequestContext, 'hasRoles').mockReturnValue(true);
			await edit({ policy: { id: POLICY } });
			expect(await balance(id)).toEqual({ taken: 5, remaining: 15 });
		});

		it('under a policy that requires sufficient balance, refuses (400) an edit back from a weekend its balance cannot cover', async () => {
			await requireSufficientBalance();
			const id = await allocate({ accrued: 6 });
			await fileLeave();
			await approvalTakes();
			await edit(WEEKEND);
			// The days given back were spent meanwhile.
			await dataSource.query(`UPDATE "time_off_balance" SET "taken" = 4, "remaining" = 2 WHERE "id" = ?`, [id]);

			await expect(edit(WORKING_WEEK)).rejects.toBeInstanceOf(BadRequestException);

			expect(await balance(id)).toEqual({ taken: 4, remaining: 2 });
			expect(new Date((await stored()).start + 'Z').toISOString()).toBe(WEEKEND.start);
		});

		it('keeps it charged through a withdrawal and recovery while it takes nothing', async () => {
			const id = await allocate();
			await fileLeave();
			await approvalTakes();
			await edit(WEEKEND);

			await service.softRemove(LEAVE);
			await service.softRecover(LEAVE);
			await edit(WORKING_WEEK);

			expect(await balance(id)).toEqual({ taken: 5, remaining: 15 });
		});

		it('leaves the charge where it is for an edit that changes none of them, the stored values sent back included', async () => {
			const id = await allocate();
			await fileLeave();
			await approvalTakes();
			const [taken] = await deductions();
			const current = await dataSource.manager.findOne(TimeOffRequest, {
				where: { id: LEAVE },
				relations: { employees: true }
			});

			// The request dialog sends every member on each edit, changed or not.
			await edit({
				start: current.start,
				end: current.end,
				isHoliday: false,
				policy: { id: POLICY },
				employees: [{ id: EMPLOYEE }],
				description: 'reworded'
			});

			expect(await balance(id)).toEqual({ taken: 5, remaining: 15 });
			expect(await deductions()).toEqual([taken]);
			expect(await stored()).toMatchObject({ description: 'reworded' });
		});

		it('takes nothing for a request whose approval took nothing (approved before balances followed approvals)', async () => {
			const id = await allocate();
			await fileLeave();

			await edit(THREE_DAYS);

			expect(await balance(id)).toEqual({ taken: 0, remaining: 20 });
			expect(await deductions()).toEqual([]);
			expect(new Date((await stored()).end + 'Z').toISOString()).toBe(THREE_DAYS.end);
		});

		it('under a policy that requires sufficient balance, refuses (400) an edit its balance cannot cover, and saves nothing', async () => {
			await requireSufficientBalance();
			const id = await allocate({ accrued: 6 });
			await fileLeave();
			await approvalTakes();
			expect(await balance(id)).toEqual({ taken: 5, remaining: 1 });

			// Monday 2 to Friday 13 November: ten working days.
			const refusal = edit({ end: '2026-11-12T23:00:00.000Z', description: 'longer' });

			await expect(refusal).rejects.toBeInstanceOf(BadRequestException);
			expect(await balance(id)).toEqual({ taken: 5, remaining: 1 });
			expect(await deductions()).toEqual([expect.objectContaining({ balanceId: id, days: 5 })]);
			expect(await stored()).toMatchObject({ end: WEEK.end, description: 'leave' });
		});

		it('under a policy that requires sufficient balance, refuses (400) moving it onto employees without a balance', async () => {
			await requireSufficientBalance();
			const id = await allocate();
			await fileLeave();
			await approvalTakes();

			await expect(edit({ employees: [{ id: EMPLOYEE }, { id: COLLEAGUE }] })).rejects.toThrow(
				/no leave balance is allocated/
			);

			expect(await balance(id)).toEqual({ taken: 5, remaining: 15 });
		});

		it('saves an edit of a request that is not approved as before, taking nothing', async () => {
			const id = await allocate();
			await fileLeave({ status: StatusTypesEnum.REQUESTED });

			await edit(THREE_DAYS);

			expect(await balance(id)).toEqual({ taken: 0, remaining: 20 });
			expect(await deductions()).toEqual([]);
			expect(new Date((await stored()).end + 'Z').toISOString()).toBe(THREE_DAYS.end);
		});
	});

	// #11608 review: the decision to move the charge was made on a read taken before the save, without a lock.
	describe('an edit decided under the row lock of the request', () => {
		/** The request as a read taken before a decision or another edit committed saw it. */
		const staleRead = (row: Row) =>
			jest.spyOn(service, 'findOneByIdString').mockImplementationOnce(async () => {
				const current = await dataSource.manager.findOne(TimeOffRequest, {
					where: { id: LEAVE },
					relations: { policy: true, organization: true }
				});
				return Object.assign(current, row);
			});

		it('recharges a request approved after the edit first read it as requested', async () => {
			const id = await allocate();
			await fileLeave();
			await approvalTakes();
			staleRead({ status: StatusTypesEnum.REQUESTED });

			await edit(THREE_DAYS);

			expect(await balance(id)).toEqual({ taken: 3, remaining: 17 });
			expect(await deductions()).toEqual([expect.objectContaining({ days: 3 })]);
		});

		it('recharges an edit its first read took for unchanged, against the dates another edit saved since', async () => {
			const id = await allocate();
			await fileLeave();
			await approvalTakes();
			// The first read already saw the dates this edit sends; the stored request has the week.
			staleRead({ start: new Date(THREE_DAYS.start), end: new Date(THREE_DAYS.end) });

			await edit({ ...THREE_DAYS, description: 'again' });

			expect(await balance(id)).toEqual({ taken: 3, remaining: 17 });
		});

		it('saves an edit that writes nothing leave balances follow through the plain save, outside any lock', async () => {
			const id = await allocate();
			await fileLeave();
			await approvalTakes();
			const save = jest.spyOn(service, 'save');
			const transaction = jest.spyOn(dataSource.manager, 'transaction');

			await edit({ description: 'reworded', isArchived: true });

			expect(save).toHaveBeenCalledTimes(1);
			expect(transaction).not.toHaveBeenCalled();
			expect(await balance(id)).toEqual({ taken: 5, remaining: 15 });
		});

		it('takes the row lock of the request, then those of the balances in one statement, on PostgreSQL and MySQL', async () => {
			const mine = await allocate();
			const theirs = await allocate({ employeeId: COLLEAGUE });
			await fileLeave();
			await approvalTakes();
			(isPostgres as jest.Mock).mockReturnValue(true);
			const locked: string[] = [];
			// SQLite has no row locks: the statements are recorded, and run without one.
			jest.spyOn(SelectQueryBuilder.prototype, 'setLock').mockImplementation(function (
				this: SelectQueryBuilder<any>,
				mode: string
			) {
				locked.push(`${this.expressionMap.mainAlias?.name}:${mode}`);
				return this;
			} as any);

			await edit({ employees: [{ id: COLLEAGUE }] });

			expect(locked).toEqual(['time_off_request:pessimistic_write', 'time_off_balance:pessimistic_write']);
			expect(await balance(mine)).toEqual({ taken: 0, remaining: 20 });
			expect(await balance(theirs)).toEqual({ taken: 5, remaining: 15 });
		});
	});

	describe('deleting an approved request', () => {
		it('gives its days back, then deletes it and the record of them', async () => {
			const id = await allocate();
			await fileLeave();
			await approvalTakes();

			await expect(service.delete(LEAVE)).resolves.toMatchObject({ affected: 1 });

			expect(await balance(id)).toEqual({ taken: 0, remaining: 20 });
			expect(await stored()).toBeUndefined();
			expect(await deductions()).toEqual([]);
		});

		it('gives back what each employee balance gave', async () => {
			const mine = await allocate({ taken: 2 });
			const theirs = await allocate({ employeeId: COLLEAGUE });
			await fileLeave({ employees: [EMPLOYEE, COLLEAGUE] });
			await approvalTakes();

			await service.delete(LEAVE);

			expect(await balance(mine)).toEqual({ taken: 2, remaining: 18 });
			expect(await balance(theirs)).toEqual({ taken: 0, remaining: 20 });
		});

		it('deletes a request that took nothing as before', async () => {
			const id = await allocate({ taken: 3 });
			await fileLeave({ status: StatusTypesEnum.REQUESTED });

			await service.delete(LEAVE);

			expect(await balance(id)).toEqual({ taken: 3, remaining: 17 });
			expect(await stored()).toBeUndefined();
		});

		it("leaves another tenant's request, and its balance, alone", async () => {
			const id = await allocate();
			await fileLeave({ tenantId: OTHER_TENANT });
			await approvalTakes();
			const before = await balance(id);

			await service.delete(LEAVE).catch(() => undefined);

			expect(await stored()).toBeDefined();
			expect(await balance(id)).toEqual(before);
		});
	});

	describe('withdrawing an approved request and putting it back', () => {
		it('gives its days back when it is withdrawn, and takes them again when it is put back', async () => {
			const id = await allocate();
			await fileLeave();
			await approvalTakes();

			const withdrawn = await service.softRemove(LEAVE);
			expect(withdrawn.deletedAt).toBeTruthy();
			expect(await balance(id)).toEqual({ taken: 0, remaining: 20 });
			expect(await deductions()).toEqual([expect.objectContaining({ days: 5, withdrawn: true })]);
			expect((await stored()).deletedAt).toBeTruthy();

			const recovered = await service.softRecover(LEAVE);
			expect(recovered.deletedAt).toBeNull();
			expect(await balance(id)).toEqual({ taken: 5, remaining: 15 });
			expect(await deductions()).toEqual([expect.objectContaining({ balanceId: id, days: 5, withdrawn: false })]);
			expect((await stored()).deletedAt).toBeNull();
		});

		it('gives nothing back twice when a withdrawn request is then deleted', async () => {
			const id = await allocate();
			await fileLeave();
			await approvalTakes();
			await service.softRemove(LEAVE);

			// The withdrawn record goes with the request (`ON DELETE CASCADE`), as in an installation.
			await dataSource.query('PRAGMA foreign_keys = ON');
			try {
				await service.delete(LEAVE);
			} finally {
				await dataSource.query('PRAGMA foreign_keys = OFF');
			}

			expect(await balance(id)).toEqual({ taken: 0, remaining: 20 });
			expect(await stored()).toBeUndefined();
			expect(await deductions()).toEqual([]);
		});

		it('gives back on delete what a withdrawal made before withdrawals gave days back still holds', async () => {
			const id = await allocate();
			await fileLeave();
			await approvalTakes();
			await dataSource.query(`UPDATE "time_off_request" SET "deletedAt" = datetime('now') WHERE "id" = ?`, [LEAVE]);

			await service.delete(LEAVE);

			expect(await balance(id)).toEqual({ taken: 0, remaining: 20 });
		});

		it('takes nothing when a request whose withdrawal gave nothing back is put back', async () => {
			const id = await allocate();
			// Approved before balances followed approvals, withdrawn before withdrawals gave days back.
			await fileLeave({ deletedAt: '2026-10-25 00:00:00.000' });

			await service.softRecover(LEAVE);

			expect(await balance(id)).toEqual({ taken: 0, remaining: 20 });
			expect(await deductions()).toEqual([]);
			expect((await stored()).deletedAt).toBeNull();
		});

		it('under a policy that requires sufficient balance, refuses (400) putting back what the balance no longer covers', async () => {
			await requireSufficientBalance();
			const id = await allocate({ accrued: 6 });
			await fileLeave();
			await approvalTakes();
			await service.softRemove(LEAVE);
			// The days given back were spent meanwhile.
			await dataSource.query(`UPDATE "time_off_balance" SET "taken" = 4, "remaining" = 2 WHERE "id" = ?`, [id]);

			await expect(service.softRecover(LEAVE)).rejects.toBeInstanceOf(BadRequestException);

			expect((await stored()).deletedAt).toBeTruthy();
			expect(await balance(id)).toEqual({ taken: 4, remaining: 2 });
			expect(await deductions()).toEqual([expect.objectContaining({ days: 5, withdrawn: true })]);
		});

		it('withdraws a request that took nothing as before', async () => {
			const id = await allocate({ taken: 1 });
			await fileLeave({ status: StatusTypesEnum.REQUESTED });

			await service.softRemove(LEAVE);
			await service.softRecover(LEAVE);

			expect(await balance(id)).toEqual({ taken: 1, remaining: 19 });
			expect(await deductions()).toEqual([]);
		});
	});
});
