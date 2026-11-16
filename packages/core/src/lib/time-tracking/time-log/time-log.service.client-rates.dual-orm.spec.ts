import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Marie worked on Client Portal in October at the project's client rate of 90; on 1 November an admin raised it to 110
 * "from now on", so her October logs keep 90. An admin reading the entry list or the daily report with
 * `withClientRates` reads the 90 each log keeps; Paul, who manages Client Portal only, reads them when he names it; an
 * employee who manages nothing is refused. Without the opt-in every answer is the one it was. Read on one SQLite
 * database with the tables TypeORM creates, through both ORMs.
 */

const TIMEOUT = 15 * 60 * 1000;

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const MARIE = '44444444-4444-4444-8444-444444444441';
const PAUL = '44444444-4444-4444-8444-444444444442';
const NOBODY = '44444444-4444-4444-8444-444444444443';
const PORTAL = '55555555-5555-4555-8555-555555555551';
const OTHER = '55555555-5555-4555-8555-555555555552';
const MARIE_OCTOBER = '77777777-7777-4777-8777-777777777771';
const MARIE_OTHER = '77777777-7777-4777-8777-777777777772';
const KEEPS_NONE = '77777777-7777-4777-8777-777777777773';
const PAUL_OCTOBER = '77777777-7777-4777-8777-777777777774';

type Answer = any;

interface OrmReads {
	adminList: Answer;
	adminDaily: Answer;
	plainList: Answer;
	plainDaily: Answer;
	adminListSerialized: Answer;
	employeeList: Answer;
	employeeDaily: Answer;
	managerNamingPortal: Answer;
	managerNamingBoth: Answer;
	managerNamingNone: Answer;
}

async function measure(): Promise<Record<'mikroOrm' | 'typeOrm', OrmReads>> {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	process.env.DB_ORM = 'mikro-orm';
	process.env.DB_TYPE = 'better-sqlite3';
	const file = path.join(os.tmpdir(), `gauzy-time-log-client-rates-${process.pid}-${Date.now()}.sqlite3`);
	const measurement = {} as Record<'mikroOrm' | 'typeOrm', OrmReads>;
	let dataSource: any;

	try {
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../../core/entities');
			const { dbMikroOrmConnectionConfig } = require('@gauzy/config');
			const { DataSource } = require('typeorm');
			const { MikroORM } = require('@mikro-orm/core');
			const { instanceToPlain } = require('class-transformer');
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
			await insert('user_organization', { ...scope, id: '99999999-9999-4999-8999-999999999991', userId: USER });
			for (const id of [MARIE, PAUL, NOBODY]) {
				await insert('employee', { ...scope, id, userId: USER, billRateValue: 50, billRateCurrency: 'EUR' });
			}
			// Today's client rates: Client Portal at 110 since 1 November
			await insert('organization_project', { ...scope, id: PORTAL, name: 'Client Portal', billRateValue: 110 });
			await insert('organization_project', { ...scope, id: OTHER, name: 'Other', billRateValue: 70 });
			// Paul manages Client Portal, and only it
			await insert('organization_project_employee', {
				...scope,
				id: '99999999-9999-4999-8999-999999999992',
				organizationProjectId: PORTAL,
				employeeId: PAUL,
				isManager: 1
			});

			const keptAt = (projectBillRateValue: number) => ({
				ratesStored: 1,
				billRateValue: 50,
				billRateCurrency: 'EUR',
				projectBillRateValue,
				projectBillRateCurrency: 'EUR',
				projectMemberBillRateCurrency: 'EUR'
			});
			const logs: Array<[string, string, string, string, Record<string, unknown>]> = [
				[MARIE_OCTOBER, MARIE, PORTAL, '2026-10-05 09:00:00', keptAt(90)],
				[MARIE_OTHER, MARIE, OTHER, '2026-10-06 09:00:00', keptAt(70)],
				// Written around the API: it keeps no rate
				[KEEPS_NONE, MARIE, PORTAL, '2026-10-07 09:00:00', {}],
				[PAUL_OCTOBER, PAUL, PORTAL, '2026-10-08 09:00:00', keptAt(90)]
			];
			for (const [index, [id, employeeId, projectId, startedAt, rates]] of logs.entries()) {
				const stoppedAt = startedAt.replace('09:00', '11:00');
				await insert('time_log', { ...scope, ...rates, id, employeeId, projectId, startedAt, stoppedAt });
				const slot = `88888888-8888-4888-8888-88888888888${index}`;
				await insert('time_slot', { ...scope, id: slot, employeeId, startedAt });
				await insert('time_slot_time_logs', { timeSlotId: slot, timeLogId: id });
			}

			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
			jest.spyOn(RequestContext, 'currentUserId').mockReturnValue(USER);
			jest.spyOn(RequestContext, 'currentOrganizationId').mockReturnValue(ORGANIZATION);
			/** Who asks: an admin of the organization, or an employee who holds no right over the others. */
			const actAs = (employeeId: string, isAdmin: boolean) => {
				jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
					id: USER,
					tenantId: TENANT,
					employeeId
				} as any);
				jest.spyOn(RequestContext, 'currentEmployeeId').mockReturnValue(employeeId);
				jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(isAdmin);
				jest.spyOn(RequestContext, 'hasRoles').mockReturnValue(isAdmin);
			};

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

			const october = {
				organizationId: ORGANIZATION,
				startDate: '2026-10-01T00:00:00.000Z',
				endDate: '2026-10-31T23:59:59.000Z',
				timeZone: 'UTC'
			};
			const withRates = { ...october, withClientRates: true };
			// As the API answers: through class-transformer (TransformInterceptor), then as JSON
			const read = async (run: () => Promise<any>) => {
				try {
					return JSON.parse(JSON.stringify(instanceToPlain(await run())));
				} catch (error) {
					return { error: (error as Error).message, status: (error as { status?: number }).status };
				}
			};
			const reads = async (target: () => any): Promise<OrmReads> => {
				actAs(MARIE, true);
				const adminList = await read(() => target().getTimeLogs(withRates));
				const adminListSerialized = await read(async () =>
					instanceToPlain(await target().getTimeLogs(withRates))
				);
				const adminDaily = await read(() => target().getDailyReport(withRates));
				const plainList = await read(() => target().getTimeLogs(october));
				const plainDaily = await read(() => target().getDailyReport(october));
				actAs(NOBODY, false);
				const employeeList = await read(() => target().getTimeLogs(withRates));
				const employeeDaily = await read(() => target().getDailyReport({ ...withRates, projectIds: [PORTAL] }));
				actAs(PAUL, false);
				const managerNamingPortal = await read(() => target().getTimeLogs({ ...withRates, projectIds: [PORTAL] }));
				const managerNamingBoth = await read(() =>
					target().getTimeLogs({ ...withRates, projectIds: [PORTAL, OTHER] })
				);
				const managerNamingNone = await read(() => target().getTimeLogs(withRates));
				return {
					adminList,
					adminDaily,
					plainList,
					plainDaily,
					adminListSerialized,
					employeeList,
					employeeDaily,
					managerNamingPortal,
					managerNamingBoth,
					managerNamingNone
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
			measurement.typeOrm = await reads(() => service(undefined));
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

/** The task rows of a daily report grouped by date, each with its employee. */
function dailyRowsOf(daily: any[]): any[] {
	return daily.flatMap((day: any) =>
		day.logs.flatMap((byProject: any) =>
			byProject.employeeLogs.flatMap((byEmployee: any) =>
				byEmployee.tasks.map((task: any) => ({ employeeId: byEmployee.employee.id, ...task }))
			)
		)
	);
}

const keptNinety = {
	projectBillRateValue: 90,
	projectMemberBillRateValue: null,
	projectBillRateCurrency: 'EUR',
	projectMemberBillRateCurrency: 'EUR'
};
const keepsNoRate = {
	projectBillRateValue: null,
	projectMemberBillRateValue: null,
	projectBillRateCurrency: null,
	projectMemberBillRateCurrency: null
};

describe('TimeLogService answers the client rates each log keeps, on request', () => {
	let measured: Record<'mikroOrm' | 'typeOrm', OrmReads>;

	beforeAll(async () => {
		measured = await measure();
	}, TIMEOUT);

	describe.each<['MikroORM' | 'TypeORM', 'mikroOrm' | 'typeOrm']>([
		['MikroORM', 'mikroOrm'],
		['TypeORM', 'typeOrm']
	])('%s', (_name, orm) => {
		const byId = (logs: any[], id: string) => logs.find((log: any) => log.id === id);

		it("tells the admin the 90 Marie's October keeps, though the project is at 110 today", () => {
			const { adminList } = measured[orm];
			expect(adminList.error).toBeUndefined();

			expect(byId(adminList, MARIE_OCTOBER)).toMatchObject({ ratesStored: true, clientRates: keptNinety });
			expect(byId(adminList, MARIE_OTHER).clientRates).toMatchObject({ projectBillRateValue: 70 });
			expect(byId(adminList, KEEPS_NONE).clientRates).toEqual(keepsNoRate);
		});

		it('keeps the client rates in the serialized answer, and nothing else the log hides', () => {
			const log = byId(measured[orm].adminListSerialized, MARIE_OCTOBER);

			expect(log.clientRates).toEqual(keptNinety);
			expect(log).not.toHaveProperty('projectBillRateValue');
			expect(log).not.toHaveProperty('payRateValue');
		});

		it('states the kept client rates on each row of the daily report', () => {
			const rows = dailyRowsOf(measured[orm].adminDaily);

			expect(rows).toEqual(
				expect.arrayContaining([
					expect.objectContaining({ employeeId: MARIE, ratesStored: true, clientRates: keptNinety }),
					expect.objectContaining({ employeeId: MARIE, ratesStored: false, clientRates: keepsNoRate })
				])
			);
		});

		it('answers as before without the opt-in', () => {
			const { plainList, plainDaily } = measured[orm];

			for (const log of plainList) {
				expect(log).not.toHaveProperty('clientRates');
			}
			for (const row of dailyRowsOf(plainDaily)) {
				expect(row).not.toHaveProperty('clientRates');
				expect(row).not.toHaveProperty('ratesStored');
			}
		});

		it('refuses an employee who manages no project, rather than leaving the rates out', () => {
			expect(measured[orm].employeeList).toMatchObject({ status: 403 });
			expect(measured[orm].employeeDaily).toMatchObject({ status: 403 });
		});

		it('answers a manager the projects he manages when he names them, and refuses any other', () => {
			const { managerNamingPortal, managerNamingBoth, managerNamingNone } = measured[orm];

			expect(managerNamingPortal.error).toBeUndefined();
			expect(byId(managerNamingPortal, PAUL_OCTOBER).clientRates).toEqual(keptNinety);
			expect(managerNamingBoth).toMatchObject({ status: 403 });
			expect(managerNamingNone).toMatchObject({ status: 403 });
		});
	});
});
