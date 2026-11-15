import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Marie billed 40 EUR an hour and was paid 25 through October; an admin raised her to 50 and 30 on 1 November. Her
 * October time stores the rates it was recorded with, so the weekly report, the owed amounts, the budgets and the
 * report rows still price it at 40 and 25, and her hour of 2 November at 50. Paul's time was written around the API
 * (it stores no rate) and keeps his current rate, 60 USD, as all time was priced before. Read on one SQLite database
 * with the tables TypeORM creates, through both ORMs.
 */

const TIMEOUT = 15 * 60 * 1000;

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const MARIE = '44444444-4444-4444-8444-444444444441';
const PAUL = '44444444-4444-4444-8444-444444444442';
const SOMEONE_ELSE = '44444444-4444-4444-8444-444444444443';
const PROJECT = '55555555-5555-4555-8555-555555555551';
const CLIENT = '66666666-6666-4666-8666-666666666661';

type Reads = Record<'weeklyOctober' | 'weeklyAll' | 'owed' | 'chart' | 'projectBudget' | 'clientBudget' | 'daily', any>;

interface Measurement {
	mikroOrm: Reads;
	typeOrm: Reads;
	/** The owed amounts for a caller who may not read Marie's pay rate. */
	managerOwed: any;
	genericReads: Record<string, any>;
}

async function measure(): Promise<Measurement> {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	process.env.DB_ORM = 'mikro-orm';
	process.env.DB_TYPE = 'better-sqlite3';
	const file = path.join(os.tmpdir(), `gauzy-time-log-stored-rates-${process.pid}-${Date.now()}.sqlite3`);
	const measurement = {} as Measurement;
	let dataSource: any;

	try {
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../../core/entities');
			const { dbMikroOrmConnectionConfig } = require('@gauzy/config');
			const { DataSource } = require('typeorm');
			const { MikroORM, wrap } = require('@mikro-orm/core');
			const { MultiORMEnum } = require('../../core/utils');
			const { CrudService } = require('../../core/crud/crud.service');
			const { RequestContext } = require('../../core/context');
			const { TimeLog } = require('./time-log.entity');
			const { TimeLogService } = require('./time-log.service');
			const { MikroOrmTimeLogRepository } = require('./repository/mikro-orm-time-log.repository');
			const { OrganizationProject } = require('../../organization-project/organization-project.entity');
			const { OrganizationContact } = require('../../organization-contact/organization-contact.entity');
			const { GetTimeLogGroupByDateCommand } = require('./commands');
			const { GetTimeLogGroupByDateHandler } = require('./commands/handlers/get-time-log-group-by-date.handler');
			const { PermissionsEnum } = require('@gauzy/contracts');

			dataSource = new DataSource({
				type: 'better-sqlite3',
				database: file,
				entities: coreEntities,
				synchronize: true
			});
			await dataSource.initialize();

			for (const table of ['employee', 'organization_project', 'organization_contact']) {
				const columns: any[] = await dataSource.query(`PRAGMA table_info("${table}")`);
				const hasPlaceholder = columns.some((column) => column.name === 'fix_relational_custom_fields');
				if (!hasPlaceholder) {
					await dataSource.query(`ALTER TABLE "${table}" ADD COLUMN "fix_relational_custom_fields" boolean`);
				}
			}

			/** A row with the columns given, and a placeholder in every other NOT NULL column without a default. */
			const insert = async (table: string, row: Record<string, unknown>) => {
				const columns: any[] = await dataSource.query(`PRAGMA table_info("${table}")`);
				const values: Record<string, unknown> = { ...row };
				for (const column of columns) {
					const needsPlaceholder =
						!(column.name in values) && column.notnull && column.dflt_value === null && !column.pk;
					if (!needsPlaceholder) continue;
					const type = String(column.type).toLowerCase();
					let placeholder: unknown = 'x';
					if (/date|time/.test(type)) placeholder = '2026-01-01 00:00:00';
					if (/int|bool|numeric|decimal|real|float/.test(type)) placeholder = 0;
					values[column.name] = placeholder;
				}
				const keys = Object.keys(values);
				const names = keys.map((key) => `"${key}"`).join(', ');
				const marks = keys.map(() => '?').join(', ');
				await dataSource.query(
					`INSERT INTO "${table}" (${names}) VALUES (${marks})`,
					keys.map((key) => values[key])
				);
			};

			const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
			await dataSource.query('PRAGMA foreign_keys = OFF');
			await insert('tenant', { id: TENANT, name: 'Tenant' });
			await insert('organization', { id: ORGANIZATION, tenantId: TENANT, name: 'Organization', currency: 'EUR' });
			await insert('user', { id: USER, tenantId: TENANT, firstName: 'Marie', lastName: 'Curie' });
			// Today's rates: Marie after her raise, Paul as he always was
			await insert('employee', {
				...scope,
				id: MARIE,
				userId: USER,
				billRateValue: 50,
				billRateCurrency: 'EUR',
				payRateValue: 30
			});
			await insert('employee', { ...scope, id: PAUL, userId: USER, billRateValue: 60, billRateCurrency: 'USD' });
			await insert('organization_contact', {
				...scope,
				id: CLIENT,
				name: 'Client A',
				budget: 2000,
				budgetType: 'cost'
			});
			await insert('organization_project', {
				...scope,
				id: PROJECT,
				name: 'Site',
				budget: 1000,
				budgetType: 'cost',
				organizationContactId: CLIENT
			});

			// Marie's October: two hours stored at 40 / 25; her hour of 2 November stored at 50 / 30
			const marieAtOctoberRates = {
				ratesStored: 1,
				billRateValue: 40,
				billRateCurrency: 'EUR',
				payRateValue: 25
			};
			const marieAtNovemberRates = {
				ratesStored: 1,
				billRateValue: 50,
				billRateCurrency: 'EUR',
				payRateValue: 30
			};
			const logs: Array<[string, string, string, string, Record<string, unknown>]> = [
				[
					'77777777-7777-4777-8777-777777777771',
					MARIE,
					'2026-10-05 09:00:00',
					'2026-10-05 11:00:00',
					marieAtOctoberRates
				],
				[
					'77777777-7777-4777-8777-777777777772',
					MARIE,
					'2026-11-02 09:00:00',
					'2026-11-02 10:00:00',
					marieAtNovemberRates
				],
				// Written around the API: no stored rate
				['77777777-7777-4777-8777-777777777773', PAUL, '2026-10-05 13:00:00', '2026-10-05 14:00:00', {}]
			];
			for (const [index, [id, employeeId, startedAt, stoppedAt, rates]] of logs.entries()) {
				await insert('time_log', {
					...scope,
					...rates,
					id,
					employeeId,
					projectId: PROJECT,
					organizationContactId: CLIENT,
					startedAt,
					stoppedAt
				});
				const slot = `88888888-8888-4888-8888-88888888888${index}`;
				await insert('time_slot', { ...scope, id: slot, employeeId, startedAt });
				await insert('time_slot_time_logs', { timeSlotId: slot, timeLogId: id });
			}

			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
				id: USER,
				tenantId: TENANT,
				employeeId: MARIE
			} as any);
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
			jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);

			// The daily report groups through the command bus: the real group-by-date handler answers it
			const groupByDate = new GetTimeLogGroupByDateHandler();
			const commandBus = {
				execute: async (command: unknown) => {
					if (command instanceof GetTimeLogGroupByDateCommand) {
						return groupByDate.execute(command as any);
					}
					throw new Error('unexpected command');
				}
			};

			const service = (mikroOrmRepository: unknown) =>
				new TimeLogService(
					dataSource.getRepository(TimeLog),
					mikroOrmRepository,
					{} as any,
					dataSource.getRepository(OrganizationProject),
					dataSource.getRepository(OrganizationContact),
					commandBus as any,
					{ canManageEmployees: async () => true } as any
				);

			const range = (startDate: string, endDate: string) =>
				({ organizationId: ORGANIZATION, startDate, endDate, timeZone: 'UTC' }) as any;
			const october = range('2026-10-05T00:00:00.000Z', '2026-10-11T23:59:59.000Z');
			const autumn = range('2026-10-01T00:00:00.000Z', '2026-11-30T23:59:59.000Z');

			const read = async (run: () => Promise<any>) => {
				try {
					return JSON.parse(JSON.stringify(await run()));
				} catch (error) {
					return { error: (error as Error).message };
				}
			};
			const reads = async (target: () => any): Promise<Reads> => ({
				weeklyOctober: await read(() => target().getWeeklyReport(october)),
				weeklyAll: await read(() => target().getWeeklyReport(autumn)),
				owed: await read(() => target().getOwedAmountReport(october)),
				chart: await read(() => target().getOwedAmountReportCharts(october)),
				projectBudget: await read(() => target().getProjectBudgetLimit(autumn)),
				clientBudget: await read(() => target().getClientBudgetLimit(autumn)),
				daily: await read(() => target().getDailyReport(autumn))
			});

			const mikroOrm = await MikroORM.init({
				...dbMikroOrmConnectionConfig,
				dbName: file,
				entities: coreEntities,
				allowGlobalContext: true,
				colors: false,
				discovery: { warnWhenNoEntities: false }
			});
			try {
				measurement.mikroOrm = await reads(() =>
					service(new MikroOrmTimeLogRepository(mikroOrm.em.fork(), TimeLog))
				);
				const rows = await mikroOrm.em.fork().find(TimeLog, { employeeId: MARIE });
				measurement.genericReads = { mikroOrmSerialized: rows.map((row: unknown) => wrap(row).toJSON()) };
			} finally {
				await mikroOrm.close(true);
			}

			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			measurement.typeOrm = await reads(() => service(undefined));
			const loaded = await dataSource.getRepository(TimeLog).findOne({ where: { employeeId: MARIE } });
			measurement.genericReads.typeOrmLoaded = {
				payRateValue: loaded.payRateValue,
				projectBillRateValue: loaded.projectBillRateValue,
				billRateValue: loaded.billRateValue
			};

			// Someone who may not read Marie's pay rate: her time is owed at the billing rate it stores
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
				id: USER,
				tenantId: TENANT,
				employeeId: SOMEONE_ELSE
			} as any);
			jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
				(permission: string) => permission !== PermissionsEnum.ORG_EMPLOYEES_EDIT
			);
			measurement.managerOwed = await read(() => service(undefined).getOwedAmountReport(october));
		});
	} finally {
		jest.restoreAllMocks();
		if (dataSource?.isInitialized) await dataSource.destroy();
		for (const [name, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[name];
			else process.env[name] = value;
		}
		try {
			fs.unlinkSync(file);
		} catch {
			// Nothing to remove: the database was never created.
		}
	}

	return measurement;
}

describe('TimeLogService prices each log at the rates it stores', () => {
	let measured: Measurement;

	beforeAll(async () => {
		measured = await measure();
	}, TIMEOUT);

	describe.each<['MikroORM' | 'TypeORM', 'mikroOrm' | 'typeOrm']>([
		['MikroORM', 'mikroOrm'],
		['TypeORM', 'typeOrm']
	])('%s', (_name, orm) => {
		const rowOf = (rows: any[], employeeId: string) => rows.find((row: any) => row.employee?.id === employeeId);

		it("prices Marie's October at 40 after her raise, and Paul's time at his current rate", () => {
			const weekly = measured[orm].weeklyOctober;
			expect(weekly.error).toBeUndefined();

			expect(rowOf(weekly, MARIE)).toMatchObject({
				spent: 80,
				currency: 'EUR',
				spentByCurrency: [{ currency: 'EUR', amount: 80 }]
			});
			expect(rowOf(weekly, PAUL)).toMatchObject({ spent: 60, currency: 'USD' });
		});

		it('prices her hour of 2 November at the new rate beside her October', () => {
			expect(rowOf(measured[orm].weeklyAll, MARIE)).toMatchObject({ spent: 130, currency: 'EUR' });
		});

		it('owes her October at the pay rate it stores, and Paul at his current billing rate', () => {
			const { owed } = measured[orm];
			expect(owed.error).toBeUndefined();
			const lines = owed[0].employees;

			expect(rowOf(lines, MARIE)).toMatchObject({
				amount: 50,
				rateSource: 'pay',
				currency: 'EUR',
				duration: 7200
			});
			expect(rowOf(lines, PAUL)).toMatchObject({ amount: 60, rateSource: 'billing', currency: 'USD' });
			expect(measured[orm].chart.find(({ date }: any) => date === '2026-10-05').value).toBe(110);
		});

		it('spends each log at the rate it stores against the project and client budgets', () => {
			const [project] = measured[orm].projectBudget;
			const [client] = measured[orm].clientBudget;

			// 2 h at 40, 1 h at 50, Paul's hour at 60
			expect(project).toMatchObject({ spent: 190, remainingBudget: 810 });
			expect(client).toMatchObject({ spent: 190, remainingBudget: 1810 });
		});

		it('states on each row of the daily report the billing rate that prices its entry', () => {
			const { daily } = measured[orm];
			expect(daily.error).toBeUndefined();
			const rows = daily.flatMap((day: any) =>
				day.logs.flatMap((byProject: any) =>
					byProject.employeeLogs.flatMap((byEmployee: any) =>
						byEmployee.tasks.map((task: any) => ({ employeeId: byEmployee.employee.id, ...task }))
					)
				)
			);
			const rates = rows.map((row: any) => [row.employeeId, row.billRateValue, row.billRateCurrency]);

			expect(rates).toEqual(
				expect.arrayContaining([
					[MARIE, 40, 'EUR'],
					[MARIE, 50, 'EUR'],
					[PAUL, 60, 'USD']
				])
			);
		});
	});

	it('owes her time at the billing rate it stores to someone who may not read her pay rate', () => {
		const line = measured.managerOwed[0].employees.find((row: any) => row.employee?.id === MARIE);

		expect(line).toMatchObject({ amount: 80, rateSource: 'billing', currency: 'EUR' });
	});

	it('never answers the pay rate or the client rates a log stores in a generic read', () => {
		const { typeOrmLoaded, mikroOrmSerialized } = measured.genericReads;

		expect(typeOrmLoaded.billRateValue).toBe(40);
		expect(typeOrmLoaded.payRateValue).toBeUndefined();
		expect(typeOrmLoaded.projectBillRateValue).toBeUndefined();
		for (const row of mikroOrmSerialized) {
			expect(row).not.toHaveProperty('payRateValue');
			expect(row).not.toHaveProperty('projectBillRateValue');
			expect(row).toHaveProperty('billRateValue');
		}
	});
});
