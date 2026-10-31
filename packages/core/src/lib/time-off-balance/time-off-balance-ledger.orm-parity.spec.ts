import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * The balance side of a time-off decision on both ORMs, over one database whose tables TypeORM created
 * (ever-co/ever-gauzy#10183, #11601 review).
 *
 * The time-off routes run their transaction on TypeORM whichever ORM the installation runs; the request approval's
 * answer runs it on the installation's ORM, so under `DB_ORM=mikro-orm` it approves a leave on a MikroORM
 * transaction. The leave's days must then be taken on that same transaction (a statement on another connection would
 * wait for the leave's row lock the answer holds), which is why the statements are stated once per ORM
 * (`typeOrmTimeOffBalanceLedger`, `mikroOrmTimeOffBalanceLedger`) under the one set of rules
 * (`TimeOffBalanceDeductionService`).
 *
 * Each case runs the real service over the real entities on both ORMs, against one better-sqlite3 file: first the
 * ledger itself — taking, giving back, withdrawing and putting back, and what a strict policy refuses — and then the
 * request approval's answer, which must check and take exactly what the time-off route does.
 */

const TIMEOUT = 15 * 60 * 1000;

type Row = Record<string, any>;
type Orm = 'typeorm' | 'mikro-orm';

const ORMS: Orm[] = ['typeorm', 'mikro-orm'];

const TENANT = '0f7c1a2e-0000-4000-8000-00000000a001';
const ORG = '0f7c1a2e-0000-4000-8000-00000000b001';
const USER = '0f7c1a2e-0000-4000-8000-00000000c001';
const EMPLOYEE = '0f7c1a2e-0000-4000-8000-00000000d001';
const COLLEAGUE = '0f7c1a2e-0000-4000-8000-00000000d002';
const POLICY = '0f7c1a2e-0000-4000-8000-00000000e001';
const LEAVE = '0f7c1a2e-0000-4000-8000-00000000f001';

const scope = { tenantId: TENANT, organizationId: ORG };

/** Monday 2 to Sunday 8 November 2026, picked in Berlin (five working days): each day stored as 23:00 UTC before. */
const WEEK = { start: '2026-11-01 23:00:00.000', end: '2026-11-07 23:00:00.000' };

describe('The leave balance follows a time-off decision on TypeORM and on MikroORM', () => {
	const file = path.join(os.tmpdir(), `gauzy-time-off-balance-parity-${process.pid}-${Date.now()}.sqlite3`);

	let loaded: Row = {};
	let dataSource: any;
	let orm: any;
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

	/** A request of the employees named, `REQUESTED` unless stated. */
	const fileLeave = async ({ employees = [EMPLOYEE], status = 'REQUESTED', ...row }: Row = {}): Promise<void> => {
		await insert('time_off_request', {
			id: LEAVE,
			...WEEK,
			requestDate: '2026-10-20 00:00:00.000',
			status,
			policyId: POLICY,
			isHoliday: 0,
			...scope,
			...row
		});
		for (const employeeId of employees) {
			await insert('time_off_request_employee', { timeOffRequestId: LEAVE, employeeId });
		}
	};

	/** A balance of `accrued` days, `taken` of them taken. */
	const allocate = async ({ employeeId = EMPLOYEE, year = 2026, accrued = 20, taken = 0 }: Row = {}): Promise<string> => {
		const id = `0f7c1a2e-0000-4000-8000-${String(++balanceSequence).padStart(12, '0')}`;
		await insert('time_off_balance', {
			id,
			...scope,
			employeeId,
			policyId: POLICY,
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

	/** The deductions recorded for the leave; `withdrawn` says whether a withdrawal gave them back. */
	const deductions = async (): Promise<Row[]> =>
		(
			await dataSource.query(
				`SELECT "balanceId", "days", "tenantId", "organizationId", "deletedAt" FROM "time_off_balance_deduction" WHERE "timeOffRequestId" = ? ORDER BY "balanceId"`,
				[LEAVE]
			)
		).map(({ deletedAt, days, ...row }: Row) => ({ ...row, days: Number(days), withdrawn: !!deletedAt }));

	const leaveStatus = async (): Promise<string> =>
		(await dataSource.query(`SELECT "status" FROM "time_off_request" WHERE "id" = ?`, [LEAVE]))[0].status;

	const requireSufficientBalance = () =>
		dataSource.query(`UPDATE "time_off_policy" SET "requireSufficientBalance" = 1 WHERE "id" = ?`, [POLICY]);

	/** The leave as a decision's read finds it. */
	const leave = async (): Promise<Row> =>
		await dataSource.manager.findOne(loaded.TimeOffRequest, {
			where: { id: LEAVE },
			withDeleted: true,
			loadEagerRelations: false
		});

	/** Runs `work` on one transaction of the ORM named, over that ORM's ledger. */
	const onLedger = async <R>(ormType: Orm, work: (ledger: any) => Promise<R>): Promise<R> =>
		ormType === 'typeorm'
			? await dataSource.transaction(
					async (manager: any) => await work(loaded.typeOrmTimeOffBalanceLedger(manager))
			  )
			: await orm.em
					.fork()
					.transactional(async (em: any) => await work(loaded.mikroOrmTimeOffBalanceLedger(em)));

	/**
	 * Runs `work` on one transaction of the ORM named, over that ORM's ledger with `wrap` laid over it, which is handed
	 * a way to run a statement on that transaction.
	 */
	const onWrappedLedger = async <R>(
		ormType: Orm,
		wrap: (ledger: any, run: (sql: string, params: unknown[]) => Promise<unknown>) => any,
		work: (ledger: any) => Promise<R>
	): Promise<R> =>
		ormType === 'typeorm'
			? await dataSource.transaction(
					async (manager: any) =>
						await work(
							wrap(loaded.typeOrmTimeOffBalanceLedger(manager), (sql, params) => manager.query(sql, params))
						)
			  )
			: await orm.em
					.fork()
					.transactional(
						async (em: any) =>
							await work(wrap(loaded.mikroOrmTimeOffBalanceLedger(em), (sql, params) => em.execute(sql, params)))
					);

	/** What a ledger was asked to lock and to move, in order. */
	const recording = (calls: string[]) => (ledger: any) => ({
		...ledger,
		lockBalances: async (ids: string[], tenantId: string) => {
			calls.push(`lock ${[...ids].sort().join(',')}`);
			return await ledger.lockBalances(ids, tenantId);
		},
		moveTakenDays: async (id: string, tenantId: string, days: number, move: string) => {
			calls.push(`${move} ${id}`);
			return await ledger.moveTakenDays(id, tenantId, days, move);
		}
	});

	/** A request approval service answering on the ORM named, as the module builds it. */
	const requestApprovals = (ormType: Orm): any => {
		const em = orm.em.fork();
		const instance = new loaded.RequestApprovalService(
			new loaded.TypeOrmRequestApprovalRepository(dataSource.getRepository(loaded.RequestApproval)),
			new loaded.MikroOrmRequestApprovalRepository(em, loaded.RequestApproval),
			{} as any,
			{} as any,
			{} as any,
			{} as any,
			undefined,
			undefined,
			new loaded.TimeOffBalanceDeductionService()
		);
		// The ORM is a module constant of the CRUD base; each instance states its own (see the request approval's
		// ORM parity suite).
		Object.defineProperty(instance, 'ormType', { get: () => ormType });
		return instance;
	};

	/** The answer's move of the leave, as `RequestApprovalStatusHandler` makes it, on the answer's transaction. */
	const answerMovesLeave = (ormType: Orm, status: string): Promise<number> =>
		requestApprovals(ormType).answerTransaction(
			async (transaction: any) => await transaction.moveTimeOff(LEAVE, TENANT, status)
		);

	beforeAll(async () => {
		const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
		process.env.DB_ORM = 'mikro-orm';
		process.env.DB_TYPE = 'better-sqlite3';

		try {
			await jest.isolateModulesAsync(async () => {
				// MikroORM keeps decorator metadata in a process-wide store; this load's decorators write the
				// mapping under test into an empty one.
				require('@mikro-orm/core').MetadataStorage.clear();

				// Must be first: loads the entity graph before a service pulls an entity.
				const entities = require('../core/entities/internal');

				const { coreEntities } = require('../core/entities');
				const { DataSource } = require('typeorm');
				const { MikroORM, EntityCaseNamingStrategy } = require('@mikro-orm/core');
				const { BetterSqliteDriver } = require('@mikro-orm/better-sqlite');
				const { SoftDeleteHandler } = require('mikro-orm-soft-delete');
				const {
					MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS,
					TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
				} = require('@gauzy/config');
				const ledger = require('./time-off-balance-ledger');

				loaded = {
					TimeOffRequest: entities.TimeOffRequest,
					RequestApproval: entities.RequestApproval,
					RequestContext: require('../core/context/request-context').RequestContext,
					TimeOffBalanceDeductionService: require('./time-off-balance-deduction.service')
						.TimeOffBalanceDeductionService,
					typeOrmTimeOffBalanceLedger: ledger.typeOrmTimeOffBalanceLedger,
					mikroOrmTimeOffBalanceLedger: ledger.mikroOrmTimeOffBalanceLedger,
					RequestApprovalService: require('../request-approval/request-approval.service').RequestApprovalService,
					TypeOrmRequestApprovalRepository: require('../request-approval/repository/type-orm-request-approval.repository')
						.TypeOrmRequestApprovalRepository,
					MikroOrmRequestApprovalRepository: require('../request-approval/repository/mikro-orm-request-approval.repository')
						.MikroOrmRequestApprovalRepository
				};

				// TypeORM creates the tables, as the migrations do in an installation; both ORMs then use them.
				dataSource = new DataSource({
					type: 'better-sqlite3',
					database: file,
					entities: coreEntities,
					synchronize: true,
					logging: false,
					invalidWhereValuesBehavior: TYPEORM_INVALID_WHERE_VALUES_BEHAVIOR
				});
				await dataSource.initialize();

				orm = await MikroORM.init({
					driver: BetterSqliteDriver,
					dbName: file,
					entities: coreEntities,
					namingStrategy: EntityCaseNamingStrategy,
					extensions: [SoftDeleteHandler],
					autoJoinRefsForFilters: MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS,
					allowGlobalContext: true,
					discovery: { warnWhenNoEntities: false }
				});
			});
		} finally {
			for (const [key, value] of Object.entries(previous)) {
				if (value === undefined) delete process.env[key];
				else process.env[key] = value;
			}
		}

		// The placeholder column of the custom-fields embeddables, which MikroORM selects whenever it joins an
		// employee (see the request approval's ORM parity suite).
		for (const table of ['employee', 'tag', 'organization_project']) {
			const columns: Row[] = await dataSource.query(`PRAGMA table_info("${table}")`);
			if (!columns.some((column) => column.name === 'fix_relational_custom_fields')) {
				await dataSource.query(`ALTER TABLE "${table}" ADD "fix_relational_custom_fields" boolean`);
			}
		}
	}, TIMEOUT);

	afterAll(async () => {
		await orm?.close(true);
		await dataSource?.destroy();
		try {
			fs.unlinkSync(file);
		} catch {
			// The file is the operating system's temporary directory's to reclaim.
		}
	});

	beforeEach(async () => {
		const context = loaded.RequestContext;
		jest.spyOn(context, 'currentUser').mockReturnValue({ id: USER, tenantId: TENANT });
		jest.spyOn(context, 'currentUserId').mockReturnValue(USER);
		jest.spyOn(context, 'currentTenantId').mockReturnValue(TENANT);
		jest.spyOn(context, 'currentOrganizationId').mockReturnValue(ORG);

		// The fixtures name rows of tables this suite has no reason to fill (the users), on both connections.
		await dataSource.query('PRAGMA foreign_keys = OFF');
		await orm.em.getConnection().execute('PRAGMA foreign_keys = OFF');
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
	});

	afterEach(() => jest.restoreAllMocks());

	describe.each(ORMS)('the ledger, on %s', (ormType) => {
		const service = () => new loaded.TimeOffBalanceDeductionService();

		it('takes the working days, less official holidays, and records them in the scope of the request', async () => {
			const id = await allocate();
			await insert('official_holiday', {
				id: '0f7c1a2e-0000-4000-8000-0000000a0001',
				name: 'holiday',
				countryCode: 'DE',
				date: '2026-11-04',
				isRecurring: 0,
				...scope
			});
			await fileLeave({ status: 'APPROVED' });
			const approved = await leave();

			await onLedger(ormType, (ledger) => service().deduct(ledger, approved));

			expect(await balance(id)).toEqual({ taken: 4, remaining: 16 });
			expect(await deductions()).toEqual([{ balanceId: id, days: 4, ...scope, withdrawn: false }]);
		});

		it('takes nothing again for a request that already took its days', async () => {
			const id = await allocate();
			await fileLeave({ status: 'APPROVED' });
			const approved = await leave();

			await onLedger(ormType, (ledger) => service().deduct(ledger, approved));
			await expect(onLedger(ormType, (ledger) => service().deduct(ledger, approved))).resolves.toEqual([]);

			expect(await balance(id)).toEqual({ taken: 5, remaining: 15 });
			expect(await deductions()).toHaveLength(1);
		});

		it('gives back what was taken, per employee, and removes the record', async () => {
			const mine = await allocate({ taken: 2 });
			const theirs = await allocate({ employeeId: COLLEAGUE });
			await fileLeave({ status: 'APPROVED', employees: [EMPLOYEE, COLLEAGUE] });
			const approved = await leave();
			await onLedger(ormType, (ledger) => service().deduct(ledger, approved));
			expect(await balance(mine)).toEqual({ taken: 7, remaining: 13 });

			await expect(onLedger(ormType, (ledger) => service().restore(ledger, approved))).resolves.toBe(10);

			expect(await balance(mine)).toEqual({ taken: 2, remaining: 18 });
			expect(await balance(theirs)).toEqual({ taken: 0, remaining: 20 });
			expect(await deductions()).toEqual([]);
		});

		it('overdraws a balance without the days left, by default', async () => {
			const id = await allocate({ accrued: 3 });
			await fileLeave({ status: 'APPROVED' });
			const approved = await leave();

			await onLedger(ormType, (ledger) => service().deduct(ledger, approved));

			expect(await balance(id)).toEqual({ taken: 5, remaining: -2 });
		});

		it('takes nothing, by default, from an employee without a balance', async () => {
			await fileLeave({ status: 'APPROVED' });
			const approved = await leave();

			await expect(onLedger(ormType, (ledger) => service().deduct(ledger, approved))).resolves.toEqual([]);

			expect(await deductions()).toEqual([]);
		});

		it('under a policy that requires sufficient balance, refuses a balance without the days left, and rolls back', async () => {
			await requireSufficientBalance();
			const enough = await allocate();
			const short = await allocate({ employeeId: COLLEAGUE, accrued: 3 });
			await fileLeave({ status: 'APPROVED', employees: [EMPLOYEE, COLLEAGUE] });
			const approved = await leave();

			await expect(onLedger(ormType, (ledger) => service().deduct(ledger, approved))).rejects.toThrow(
				/Insufficient leave balance for the requested number of days/
			);

			expect(await balance(enough)).toEqual({ taken: 0, remaining: 20 });
			expect(await balance(short)).toEqual({ taken: 0, remaining: 3 });
			expect(await deductions()).toEqual([]);
		});

		it('under a policy that requires sufficient balance, refuses an employee without a balance', async () => {
			await requireSufficientBalance();
			const id = await allocate();
			await fileLeave({ status: 'APPROVED', employees: [EMPLOYEE, COLLEAGUE] });
			const approved = await leave();

			await expect(onLedger(ormType, (ledger) => service().deduct(ledger, approved))).rejects.toThrow(
				/no leave balance is allocated under this time-off policy for 2026/
			);

			expect(await balance(id)).toEqual({ taken: 0, remaining: 20 });
			expect(await deductions()).toEqual([]);
		});

		it('gives the days back on a withdrawal and keeps the record as withdrawn, then takes them again on recovery', async () => {
			const id = await allocate();
			await fileLeave({ status: 'APPROVED' });
			const approved = await leave();
			await onLedger(ormType, (ledger) => service().deduct(ledger, approved));

			await expect(onLedger(ormType, (ledger) => service().withdraw(ledger, approved))).resolves.toBe(5);
			expect(await balance(id)).toEqual({ taken: 0, remaining: 20 });
			expect(await deductions()).toEqual([expect.objectContaining({ days: 5, withdrawn: true })]);
			// A withdrawn record is no charge: nothing to give back again, nothing an edit would move.
			await expect(onLedger(ormType, (ledger) => service().hasCharge(ledger, approved))).resolves.toBe(false);
			await expect(onLedger(ormType, (ledger) => service().restore(ledger, approved))).resolves.toBe(0);

			await onLedger(ormType, (ledger) => service().reinstate(ledger, approved));
			expect(await balance(id)).toEqual({ taken: 5, remaining: 15 });
			expect(await deductions()).toEqual([expect.objectContaining({ balanceId: id, days: 5, withdrawn: false })]);
		});

		it('takes nothing on the recovery of a request whose withdrawal gave nothing back', async () => {
			const id = await allocate();
			await fileLeave({ status: 'APPROVED' });
			const approved = await leave();

			await expect(onLedger(ormType, (ledger) => service().reinstate(ledger, approved))).resolves.toEqual([]);

			expect(await balance(id)).toEqual({ taken: 0, remaining: 20 });
		});

		it('moves the charge of an edited request: gives back what it took, takes what it takes now', async () => {
			const id = await allocate();
			await fileLeave({ status: 'APPROVED' });
			await onLedger(ormType, async (ledger) => service().deduct(ledger, await leave()));
			// Monday 2 to Wednesday 4 November.
			await dataSource.query(`UPDATE "time_off_request" SET "end" = ? WHERE "id" = ?`, [
				'2026-11-03 23:00:00.000',
				LEAVE
			]);
			const edited = await leave();

			await onLedger(ormType, (ledger) => service().recharge(ledger, edited));

			expect(await balance(id)).toEqual({ taken: 3, remaining: 17 });
			expect(await deductions()).toEqual([expect.objectContaining({ balanceId: id, days: 3 })]);
		});

		const moveTo = (range: { start: string; end: string }) =>
			dataSource.query(`UPDATE "time_off_request" SET "start" = ?, "end" = ? WHERE "id" = ?`, [
				range.start,
				range.end,
				LEAVE
			]);

		// #11608 review: a recharge that took nothing dropped every record of the charge, so the next one took nothing.
		it('keeps a zero-day record of the charge when an edit leaves it taking nothing, and charges the edit back', async () => {
			const id = await allocate();
			await fileLeave({ status: 'APPROVED' });
			await onLedger(ormType, async (ledger) => service().deduct(ledger, await leave()));

			// Saturday 7 and Sunday 8 November.
			await moveTo({ start: '2026-11-06 23:00:00.000', end: '2026-11-07 23:00:00.000' });
			await onLedger(ormType, async (ledger) => service().recharge(ledger, await leave()));
			expect(await balance(id)).toEqual({ taken: 0, remaining: 20 });
			expect(await deductions()).toEqual([{ balanceId: id, days: 0, ...scope, withdrawn: false }]);
			await expect(onLedger(ormType, async (ledger) => service().hasCharge(ledger, await leave()))).resolves.toBe(
				true
			);

			// Withdrawn and put back while it takes nothing, it stays charged.
			await onLedger(ormType, async (ledger) => service().withdraw(ledger, await leave()));
			await onLedger(ormType, async (ledger) => service().reinstate(ledger, await leave()));
			expect(await deductions()).toEqual([{ balanceId: id, days: 0, ...scope, withdrawn: false }]);

			await moveTo(WEEK);
			await onLedger(ormType, async (ledger) => service().recharge(ledger, await leave()));
			expect(await balance(id)).toEqual({ taken: 5, remaining: 15 });
			expect(await deductions()).toEqual([{ balanceId: id, days: 5, ...scope, withdrawn: false }]);
		});

		it('gives back nothing for a zero-day record, and removes it with the approval', async () => {
			const id = await allocate();
			await fileLeave({ status: 'APPROVED' });
			await onLedger(ormType, async (ledger) => service().deduct(ledger, await leave()));
			await dataSource.query(`UPDATE "time_off_request" SET "isHoliday" = 1 WHERE "id" = ?`, [LEAVE]);
			await onLedger(ormType, async (ledger) => service().recharge(ledger, await leave()));

			await expect(onLedger(ormType, async (ledger) => service().restore(ledger, await leave()))).resolves.toBe(0);

			expect(await balance(id)).toEqual({ taken: 0, remaining: 20 });
			expect(await deductions()).toEqual([]);
		});

		// #11608 review: under READ COMMITTED a balance removed after it was read made the spend move nothing, and a
		// strict policy let the approval through.
		describe('a balance removed after it was read', () => {
			const removedOnceRead = (ledger: any, run: (sql: string, params: unknown[]) => Promise<unknown>) => ({
				...ledger,
				balancesOf: async (...args: unknown[]) => {
					const rows = await ledger.balancesOf(...args);
					await run(`UPDATE "time_off_balance" SET "deletedAt" = ?`, ['2026-10-30 00:00:00.000']);
					return rows;
				}
			});

			it('refuses the approval under a policy that requires sufficient balance, and rolls back', async () => {
				await requireSufficientBalance();
				const id = await allocate();
				await fileLeave({ status: 'APPROVED' });
				const approved = await leave();

				await expect(
					onWrappedLedger(ormType, removedOnceRead, (ledger) => service().deduct(ledger, approved))
				).rejects.toThrow(/no leave balance is allocated under this time-off policy for 2026/);

				expect(await deductions()).toEqual([]);
				expect(await balance(id)).toEqual({ taken: 0, remaining: 20 });
				// The removal rolled back with it.
				expect(await dataSource.query(`SELECT * FROM "time_off_balance" WHERE "deletedAt" IS NOT NULL`)).toEqual(
					[]
				);
			});

			it('takes nothing from it, by default, as from a balance that never existed', async () => {
				await allocate();
				await fileLeave({ status: 'APPROVED' });
				const approved = await leave();

				await expect(
					onWrappedLedger(ormType, removedOnceRead, (ledger) => service().deduct(ledger, approved))
				).resolves.toEqual([]);

				expect(await deductions()).toEqual([]);
			});
		});

		// #11608 review: a recharge locked the balances it gave back to, then the ones it took from.
		it('locks the balances a recharge gives back to and takes from together, before any day moves', async () => {
			const mine = await allocate();
			const theirs = await allocate({ employeeId: COLLEAGUE });
			await fileLeave({ status: 'APPROVED' });
			await onLedger(ormType, async (ledger) => service().deduct(ledger, await leave()));
			await dataSource.query(`UPDATE "time_off_request_employee" SET "employeeId" = ? WHERE "timeOffRequestId" = ?`, [
				COLLEAGUE,
				LEAVE
			]);
			const calls: string[] = [];

			await onWrappedLedger(ormType, recording(calls), async (ledger) => service().recharge(ledger, await leave()));

			expect(calls).toEqual([`lock ${[mine, theirs].sort().join(',')}`, `giveBack ${mine}`, `overdraw ${theirs}`]);
			expect(await balance(mine)).toEqual({ taken: 0, remaining: 20 });
			expect(await balance(theirs)).toEqual({ taken: 5, remaining: 15 });
		});

		it('locks the balances it moves before any day moves, on an approval and a reversal too', async () => {
			const mine = await allocate();
			const theirs = await allocate({ employeeId: COLLEAGUE });
			await fileLeave({ status: 'APPROVED', employees: [EMPLOYEE, COLLEAGUE] });
			const calls: string[] = [];
			const both = [mine, theirs].sort();

			await onWrappedLedger(ormType, recording(calls), async (ledger) => service().deduct(ledger, await leave()));
			await onWrappedLedger(ormType, recording(calls), async (ledger) => service().restore(ledger, await leave()));

			expect(calls).toEqual([
				`lock ${both.join(',')}`,
				...both.map((id) => `overdraw ${id}`),
				`lock ${both.join(',')}`,
				...both.map((id) => `giveBack ${id}`)
			]);
		});
	});

	describe.each(ORMS)("the request approval's answer, on %s", (ormType) => {
		it('takes the days of the leave it approves, on its transaction', async () => {
			const id = await allocate();
			await fileLeave();

			await expect(answerMovesLeave(ormType, 'APPROVED')).resolves.toBe(1);

			expect(await leaveStatus()).toBe('APPROVED');
			expect(await balance(id)).toEqual({ taken: 5, remaining: 15 });
			expect(await deductions()).toEqual([{ balanceId: id, days: 5, ...scope, withdrawn: false }]);
		});

		it('takes nothing for the leave it refuses', async () => {
			const id = await allocate();
			await fileLeave();

			await expect(answerMovesLeave(ormType, 'DENIED')).resolves.toBe(1);

			expect(await leaveStatus()).toBe('DENIED');
			expect(await balance(id)).toEqual({ taken: 0, remaining: 20 });
			expect(await deductions()).toEqual([]);
		});

		it('moves nothing, and takes nothing, for a leave decided already', async () => {
			const id = await allocate();
			await fileLeave({ status: 'APPROVED' });

			await expect(answerMovesLeave(ormType, 'APPROVED')).resolves.toBe(0);

			expect(await balance(id)).toEqual({ taken: 0, remaining: 20 });
		});

		it('approves as before, taking nothing, when no balance exists and the policy does not require one', async () => {
			await fileLeave();

			await expect(answerMovesLeave(ormType, 'APPROVED')).resolves.toBe(1);

			expect(await leaveStatus()).toBe('APPROVED');
			expect(await deductions()).toEqual([]);
		});

		it('under a policy that requires sufficient balance, is refused when the balance lacks the days, and the leave stays requested', async () => {
			await requireSufficientBalance();
			const id = await allocate({ accrued: 3 });
			await fileLeave();

			await expect(answerMovesLeave(ormType, 'APPROVED')).rejects.toThrow(/Insufficient leave balance/);

			expect(await leaveStatus()).toBe('REQUESTED');
			expect(await balance(id)).toEqual({ taken: 0, remaining: 3 });
			expect(await deductions()).toEqual([]);
		});

		it('under a policy that requires sufficient balance, is refused when the employee has no balance', async () => {
			await requireSufficientBalance();
			await fileLeave();

			await expect(answerMovesLeave(ormType, 'APPROVED')).rejects.toThrow(/no leave balance is allocated/);

			expect(await leaveStatus()).toBe('REQUESTED');
			expect(await deductions()).toEqual([]);
		});
	});
});
