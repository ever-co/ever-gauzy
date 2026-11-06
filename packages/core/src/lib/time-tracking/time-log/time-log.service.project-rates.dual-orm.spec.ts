import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * A project's rate and a member's rate on a project are what the client is billed for the time. What the organization
 * owes an employee stays their own rate times their time: setting either changes nothing in the owed-amount report or
 * its chart. Read on one SQLite database with the tables TypeORM creates, through both ORMs, as
 * `time-log.service.reports.dual-orm.spec.ts` reads the same reports without any project rate.
 */

const TIMEOUT = 15 * 60 * 1000;

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const MEMBER_RATE_EMPLOYEE = '44444444-4444-4444-8444-444444444441';
const PROJECT_RATE_EMPLOYEE = '44444444-4444-4444-8444-444444444442';
const UNBILLED_EMPLOYEE = '44444444-4444-4444-8444-444444444443';
const RATED_PROJECT = '55555555-5555-4555-8555-555555555551';
const UNRATED_PROJECT = '55555555-5555-4555-8555-555555555552';
const DAY = '2026-01-10';

/** The members' client rates on the rated project. */
const MEMBER_RATES = new Map<string, number>([[MEMBER_RATE_EMPLOYEE, 30]]);

type Reads = Record<'owed' | 'chart', any>;

async function measure(): Promise<{ mikroOrm: Reads; typeOrm: Reads }> {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	process.env.DB_ORM = 'mikro-orm';
	process.env.DB_TYPE = 'better-sqlite3';
	const file = path.join(os.tmpdir(), `gauzy-time-log-project-rates-${process.pid}-${Date.now()}.sqlite3`);
	const measurement = {} as { mikroOrm: Reads; typeOrm: Reads };
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
			const employees: Array<[string, number | null, string | null]> = [
				[MEMBER_RATE_EMPLOYEE, 20.15, 'EUR'],
				[PROJECT_RATE_EMPLOYEE, 25, null],
				[UNBILLED_EMPLOYEE, null, 'EUR']
			];
			for (const [id, billRateValue, billRateCurrency] of employees) {
				await insert('employee', { ...scope, id, userId: USER, billRateValue, billRateCurrency });
			}
			await insert('organization_project', {
				...scope,
				id: RATED_PROJECT,
				name: 'Rated',
				currency: 'EUR',
				billRateValue: 40
			});
			await insert('organization_project', { ...scope, id: UNRATED_PROJECT, name: 'Unrated' });
			for (const [, [employeeId]] of employees.entries()) {
				const rate = MEMBER_RATES.get(employeeId) ?? null;
				await insert('organization_project_employee', {
					...scope,
					id: `99999999-9999-4999-8999-${employeeId.slice(-12)}`,
					organizationProjectId: RATED_PROJECT,
					employeeId,
					billRateValue: rate
				});
			}

			// Half an hour each on the rated project, and half an hour more for the unbilled employee on the other one
			const logs: Array<[string, string, string]> = [
				[MEMBER_RATE_EMPLOYEE, RATED_PROJECT, '00'],
				[PROJECT_RATE_EMPLOYEE, RATED_PROJECT, '01'],
				[UNBILLED_EMPLOYEE, RATED_PROJECT, '02'],
				[UNBILLED_EMPLOYEE, UNRATED_PROJECT, '03']
			];
			for (const [index, [employeeId, projectId, hour]] of logs.entries()) {
				const log = `77777777-7777-4777-8777-77777777777${index}`;
				const slot = `88888888-8888-4888-8888-88888888888${index}`;
				const startedAt = `${DAY} ${hour}:00:00`;
				await insert('time_log', {
					...scope,
					id: log,
					employeeId,
					projectId,
					startedAt,
					stoppedAt: `${DAY} ${hour}:30:00`
				});
				await insert('time_slot', { ...scope, id: slot, employeeId, startedAt });
				await insert('time_slot_time_logs', { timeSlotId: slot, timeLogId: log });
			}

			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
				id: USER,
				tenantId: TENANT,
				employeeId: MEMBER_RATE_EMPLOYEE
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

describe('TimeLogService owed amounts at project and member rates, through both ORMs', () => {
	let measured: { mikroOrm: Reads; typeOrm: Reads };

	beforeAll(async () => {
		measured = await measure();
	}, TIMEOUT);

	describe.each<['MikroORM' | 'TypeORM', 'mikroOrm' | 'typeOrm']>([
		['MikroORM', 'mikroOrm'],
		['TypeORM', 'typeOrm']
	])('%s', (_name, orm) => {
		it("owes each employee their own rate times their time, whatever the project's and members' client rates", () => {
			const { owed } = measured[orm];
			expect(owed.error).toBeUndefined();
			expect(owed).toHaveLength(1);

			const amounts = new Map(owed[0].employees.map((line: any) => [line.employee.id, line.amount]));
			// Half an hour at their own 20.15, not at the 30 the client is billed for them on the project
			expect(amounts.get(MEMBER_RATE_EMPLOYEE)).toBe(10.08);
			// Half an hour at their own 25, not at the project's 40
			expect(amounts.get(PROJECT_RATE_EMPLOYEE)).toBe(12.5);
			// Nothing without a rate of their own, though the client is billed 40 for the rated half hour
			expect(amounts.get(UNBILLED_EMPLOYEE)).toBe(0);
		});

		it('totals the day for the chart from the same amounts', () => {
			const { chart } = measured[orm];
			expect(chart.error).toBeUndefined();
			expect(chart.find(({ date }: any) => date === DAY).value).toBe(22.58);
		});
	});
});
