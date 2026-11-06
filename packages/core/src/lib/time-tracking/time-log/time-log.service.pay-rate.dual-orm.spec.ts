import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * A client is billed at an employee's billing rate and the employee is paid at their pay rate. The owed-amount report
 * and its chart price each employee's day at their pay rate once a rate editor sets it, in its own currency or the
 * organization's, and at their billing rate until then, as before pay rates existed. Each line says which rate priced
 * it and in which currency.
 *
 * A pay rate is salary data. A generic read never returns it: TypeORM leaves it out unless asked, MikroORM never
 * serializes it, and a caller who asks for it by `select`, at the top or through a relation, gets it removed from the
 * response. Read on one SQLite database with the tables TypeORM creates, through both ORMs.
 */

const TIMEOUT = 15 * 60 * 1000;

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const PAID = '44444444-4444-4444-8444-444444444441';
const PAID_IN_ORGANIZATION_CURRENCY = '44444444-4444-4444-8444-444444444442';
const NOT_PAID_YET = '44444444-4444-4444-8444-444444444443';
const PROJECT = '55555555-5555-4555-8555-555555555551';
const DAY = '2026-01-10';

/** Billed 80 an hour and paid 30; billed 80 and paid 7 in the organization's euro; billed 40, no pay rate yet. */
const EMPLOYEES: Array<[string, number, string, number | null, string | null]> = [
	[PAID, 80, 'USD', 30, 'USD'],
	[PAID_IN_ORGANIZATION_CURRENCY, 80, 'USD', 7, null],
	[NOT_PAID_YET, 40, 'USD', null, null]
];

type Reads = Record<'owed' | 'chart', any>;

interface Measurement {
	mikroOrm: Reads;
	typeOrm: Reads;
	genericReads: Record<string, any>;
	/** The same reports for a manager who holds CHANGE_SELECTED_EMPLOYEE but not ORG_EMPLOYEES_EDIT, employee PAID. */
	managerReads: Reads;
}

async function measure(): Promise<Measurement> {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	process.env.DB_ORM = 'mikro-orm';
	process.env.DB_TYPE = 'better-sqlite3';
	const file = path.join(os.tmpdir(), `gauzy-time-log-pay-rates-${process.pid}-${Date.now()}.sqlite3`);
	const measurement = {} as Measurement;
	let dataSource: any;

	try {
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../../core/entities');
			const { dbMikroOrmConnectionConfig } = require('@gauzy/config');
			const { DataSource } = require('typeorm');
			const { MikroORM } = require('@mikro-orm/core');
			const { MultiORMEnum } = require('../../core/utils');
			const { CrudService } = require('../../core/crud/crud.service');
			const { RequestContext } = require('../../core/context');
			const { TimeLog } = require('./time-log.entity');
			const { TimeLogService } = require('./time-log.service');
			const { MikroOrmTimeLogRepository } = require('./repository/mikro-orm-time-log.repository');
			const { OrganizationProject } = require('../../organization-project/organization-project.entity');
			const { OrganizationContact } = require('../../organization-contact/organization-contact.entity');
			const { Employee } = require('../../employee/employee.entity');
			const { TransformInterceptor } = require('../../core/interceptors/transform.interceptor');
			const { wrap } = require('@mikro-orm/core');
			const { of, firstValueFrom } = require('rxjs');

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
			await insert('user', { id: USER, tenantId: TENANT, firstName: 'Ada', lastName: 'Lovelace' });
			for (const [id, billRateValue, billRateCurrency, payRateValue, payRateCurrency] of EMPLOYEES) {
				await insert('employee', {
					...scope,
					id,
					userId: USER,
					billRateValue,
					billRateCurrency,
					payRateValue,
					payRateCurrency
				});
			}
			await insert('organization_project', { ...scope, id: PROJECT, name: 'Client work' });

			// Half an hour each
			for (const [index, [employeeId]] of EMPLOYEES.entries()) {
				const log = `77777777-7777-4777-8777-77777777777${index}`;
				const slot = `88888888-8888-4888-8888-88888888888${index}`;
				const startedAt = `${DAY} 0${index}:00:00`;
				await insert('time_log', {
					...scope,
					id: log,
					employeeId,
					projectId: PROJECT,
					startedAt,
					stoppedAt: `${DAY} 0${index}:30:00`
				});
				await insert('time_slot', { ...scope, id: slot, employeeId, startedAt });
				await insert('time_slot_time_logs', { timeSlotId: slot, timeLogId: log });
			}

			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
				id: USER,
				tenantId: TENANT,
				employeeId: PAID
			} as any);
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
			jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);

			const service = (mikroOrmRepository: unknown) =>
				new TimeLogService(
					dataSource.getRepository(TimeLog),
					mikroOrmRepository,
					{} as any,
					dataSource.getRepository(OrganizationProject),
					dataSource.getRepository(OrganizationContact),
					{} as any,
					{ canManageEmployees: async () => true } as any
				);

			const request = {
				organizationId: ORGANIZATION,
				startDate: '2026-01-01T00:00:00.000Z',
				endDate: '2026-01-31T00:00:00.000Z',
				timeZone: 'UTC'
			} as any;

			const reads = async (target: () => any): Promise<Reads> => {
				const read = async (run: () => Promise<any>) => {
					try {
						return JSON.parse(JSON.stringify(await run()));
					} catch (error) {
						return { error: (error as Error).message };
					}
				};
				return {
					owed: await read(() => target().getOwedAmountReport(request)),
					chart: await read(() => target().getOwedAmountReportCharts(request))
				};
			};

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
			} finally {
				await mikroOrm.close(true);
			}

			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			try {
				measurement.typeOrm = await reads(() => service(undefined));
			} finally {
				jest.restoreAllMocks();
			}

			const { PermissionsEnum } = require('@gauzy/contracts');
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
				id: USER,
				tenantId: TENANT,
				employeeId: PAID
			} as any);
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
			jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
				(permission: string) => permission !== PermissionsEnum.ORG_EMPLOYEES_EDIT
			);
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			try {
				measurement.managerReads = await reads(() => service(undefined));
			} finally {
				jest.restoreAllMocks();
			}

			// Generic reads, as a caller could shape them, sent through the response interceptor every route uses
			const respond = async (body: unknown) => {
				const interceptor = new TransformInterceptor();
				const handled = interceptor.intercept({} as any, { handle: () => of(body) });
				return JSON.parse(JSON.stringify(await firstValueFrom(handled)));
			};
			const employees = dataSource.getRepository(Employee);
			const timeLogs = dataSource.getRepository(TimeLog);
			const selectsPayRate = { id: true, payRateValue: true, payRateCurrency: true };
			const selected = await employees.find({ where: { id: PAID }, select: selectsPayRate });
			const nested = await timeLogs.find({
				where: { employeeId: PAID },
				relations: { employee: true },
				select: { id: true, employee: selectsPayRate }
			});
			const defaultRead = await employees.findOne({ where: { id: PAID } });
			// The loaded rows themselves, before any serialization: what a route would hand to the response
			measurement.genericReads = {
				defaultReadLoaded: {
					payRateValue: defaultRead.payRateValue,
					payRateCurrency: defaultRead.payRateCurrency
				},
				selectedLoaded: {
					payRateValue: selected[0].payRateValue,
					payRateCurrency: selected[0].payRateCurrency
				},
				nestedLoaded: { payRateValue: nested[0].employee.payRateValue },
				selected: await respond(selected),
				nested: await respond(nested)
			};
			const mikroOrmReader = await MikroORM.init({
				...dbMikroOrmConnectionConfig,
				dbName: file,
				entities: coreEntities,
				allowGlobalContext: true,
				colors: false,
				discovery: { warnWhenNoEntities: false }
			});
			try {
				const em = mikroOrmReader.em.fork();
				const rows = await em.find(
					Employee,
					{ id: PAID },
					{ fields: ['id', 'payRateValue', 'payRateCurrency'] }
				);
				measurement.genericReads.mikroOrmSerialized = rows.map((row: unknown) => wrap(row).toJSON());
			} finally {
				await mikroOrmReader.close(true);
			}
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

describe('TimeLogService owed amounts at the pay rate, and pay rates kept out of generic reads', () => {
	let measured: Measurement;

	beforeAll(async () => {
		measured = await measure();
	}, TIMEOUT);

	describe.each<['MikroORM' | 'TypeORM', 'mikroOrm' | 'typeOrm']>([
		['MikroORM', 'mikroOrm'],
		['TypeORM', 'typeOrm']
	])('%s', (_name, orm) => {
		it('owes each employee their pay rate once set, else their billing rate, and says which and in what currency', () => {
			const { owed } = measured[orm];
			expect(owed.error).toBeUndefined();
			expect(owed).toHaveLength(1);

			const lines = new Map(owed[0].employees.map((line: any) => [line.employee.id, line]));
			expect(lines.get(PAID)).toMatchObject({ amount: 15, rateSource: 'pay', currency: 'USD' });
			expect(lines.get(PAID_IN_ORGANIZATION_CURRENCY)).toMatchObject({
				amount: 3.5,
				rateSource: 'pay',
				currency: 'EUR'
			});
			expect(lines.get(NOT_PAID_YET)).toMatchObject({ amount: 20, rateSource: 'billing', currency: 'USD' });
		});

		it('never puts the pay rate in the report lines', () => {
			const { owed } = measured[orm];

			for (const line of owed[0].employees) {
				expect(line.employee).not.toHaveProperty('payRateValue');
				expect(line.employee).not.toHaveProperty('payRateCurrency');
			}
		});

		it("totals the chart's day from the same amounts, as develop adds each employee's amount", () => {
			const { chart } = measured[orm];
			expect(chart.error).toBeUndefined();
			expect(chart.find(({ date }: any) => date === DAY).value).toBe(38.5);
		});
	});

	describe('a manager without ORG_EMPLOYEES_EDIT', () => {
		it("gets their own day at their pay rate and the others' at their billing rate, so no amount tells a pay rate", () => {
			const { owed, chart } = measured.managerReads;
			expect(owed.error).toBeUndefined();

			const lines = new Map(owed[0].employees.map((line: any) => [line.employee.id, line]));
			expect(lines.get(PAID)).toMatchObject({ amount: 15, rateSource: 'pay', currency: 'USD' });
			expect(lines.get(PAID_IN_ORGANIZATION_CURRENCY)).toMatchObject({
				amount: 40,
				rateSource: 'billing',
				currency: 'USD'
			});
			expect(lines.get(NOT_PAID_YET)).toMatchObject({ amount: 20, rateSource: 'billing', currency: 'USD' });
			expect(chart.find(({ date }: any) => date === DAY).value).toBe(75);
		});
	});

	describe('generic reads', () => {
		it('leave the pay rate out of a TypeORM read that does not name it', () => {
			expect(measured.genericReads.defaultReadLoaded).toEqual({
				payRateValue: undefined,
				payRateCurrency: undefined
			});
		});

		it('remove a pay rate a caller selects by name, at the top or through a relation, from the response', () => {
			expect(measured.genericReads.selectedLoaded).toEqual({ payRateValue: 30, payRateCurrency: 'USD' });
			expect(measured.genericReads.nestedLoaded).toEqual({ payRateValue: 30 });

			expect(measured.genericReads.selected[0]).toEqual({ id: PAID });
			expect(measured.genericReads.nested[0].employee).toEqual({ id: PAID });
		});

		it('never serialize the pay rate on MikroORM, even when the read loads it', () => {
			expect(measured.genericReads.mikroOrmSerialized[0]).not.toHaveProperty('payRateValue');
			expect(measured.genericReads.mikroOrmSerialized[0]).not.toHaveProperty('payRateCurrency');
		});
	});
});
