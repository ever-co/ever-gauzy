import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * The money reports over time logs — the owed-amount report and its chart, the project and client budget reports —
 * and the project colour on the time-log list, on one SQLite database with the tables TypeORM creates, read through
 * both ORMs.
 *
 * The other suites of this service answer from stand-ins, so they cannot see what a real database refuses. The
 * MikroORM budget read selected `time_log.duration`, which is no column: the entity works it out when it loads
 * (`afterEntityLoad`), and the raw knex read of that branch loads no entity. Its stand-in answered a `duration` anyway,
 * so the suite stayed green while both budget reports failed with `no such column` on every dialect.
 *
 * The entities are imported under `DB_ORM=mikro-orm` in a registry kept open while both ORMs build their metadata and
 * read (see `time-log.service.mikro-orm-joins.spec.ts`); everything is measured in `beforeAll` and asserted below.
 */

const TIMEOUT = 15 * 60 * 1000;

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const EURO_EMPLOYEE = '44444444-4444-4444-8444-444444444441';
const ORGANIZATION_CURRENCY_EMPLOYEE = '44444444-4444-4444-8444-444444444442';
const UNBILLED_EMPLOYEE = '44444444-4444-4444-8444-444444444443';
const PROJECT = '55555555-5555-4555-8555-555555555551';
const CONTACT = '66666666-6666-4666-8666-666666666661';
const DAY = '2026-01-10';

/** What each read answered through one ORM, or how it failed. */
type Reads = Record<'owed' | 'chart' | 'projectBudget' | 'clientBudget' | 'list' | 'listWithSlots', any>;

async function measure(): Promise<{ mikroOrm: Reads; typeOrm: Reads }> {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	process.env.DB_ORM = 'mikro-orm';
	// Whatever database the machine's environment names: both ORMs read the one SQLite file below
	process.env.DB_TYPE = 'better-sqlite3';
	const file = path.join(os.tmpdir(), `gauzy-time-log-reports-${process.pid}-${Date.now()}.sqlite3`);
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

			// The tables TypeORM creates, as the migrations create them for the running platform.
			dataSource = new DataSource({
				type: 'better-sqlite3',
				database: file,
				entities: coreEntities,
				synchronize: true
			});
			await dataSource.initialize();

			// The custom-fields placeholder column the migrations add (`AlterCustomFieldsDefaultColumn`), which
			// synchronize leaves out because the bootstrap registers custom fields with TypeORM, not the decorators.
			for (const table of ['employee', 'organization_project', 'organization_contact']) {
				const columns: any[] = await dataSource.query(`PRAGMA table_info("${table}")`);
				if (!columns.some((column) => column.name === 'fix_relational_custom_fields')) {
					await dataSource.query(`ALTER TABLE "${table}" ADD COLUMN "fix_relational_custom_fields" boolean`);
				}
			}

			// A row with the columns given, and a placeholder in every other NOT NULL column without a default.
			const insert = async (table: string, row: Record<string, unknown>) => {
				const columns: any[] = await dataSource.query(`PRAGMA table_info("${table}")`);
				const values: Record<string, unknown> = { ...row };
				for (const column of columns) {
					if (column.name in values || !column.notnull || column.dflt_value !== null || column.pk) continue;
					const type = String(column.type).toLowerCase();
					values[column.name] = /int|bool|numeric|decimal|real|float/.test(type)
						? 0
						: /date|time/.test(type)
							? '2026-01-01 00:00:00'
							: 'x';
				}
				const keys = Object.keys(values);
				await dataSource.query(
					`INSERT INTO "${table}" (${keys.map((key) => `"${key}"`).join(', ')}) VALUES (${keys
						.map(() => '?')
						.join(', ')})`,
					keys.map((key) => values[key])
				);
			};

			const scope = { tenantId: TENANT, organizationId: ORGANIZATION };
			await dataSource.query('PRAGMA foreign_keys = OFF');
			await insert('tenant', { id: TENANT, name: 'Tenant' });
			await insert('organization', { id: ORGANIZATION, tenantId: TENANT, name: 'Organization', currency: 'JPY' });
			await insert('user', { id: USER, tenantId: TENANT, firstName: 'Ada', lastName: 'Lovelace' });
			const employees: Array<[string, number | null, string | null]> = [
				[EURO_EMPLOYEE, 20.15, 'EUR'],
				[ORGANIZATION_CURRENCY_EMPLOYEE, 1501, null],
				[UNBILLED_EMPLOYEE, null, 'USD']
			];
			for (const [id, billRateValue, billRateCurrency] of employees) {
				await insert('employee', { ...scope, id, userId: USER, billRateValue, billRateCurrency });
			}
			await insert('organization_project', {
				...scope,
				id: PROJECT,
				name: 'Live',
				budget: 1000,
				budgetType: 'cost',
				currency: 'EUR',
				color: '#3366ff'
			});
			await insert('organization_contact', {
				...scope,
				id: CONTACT,
				name: 'Acme',
				budget: 2,
				budgetType: 'hours'
			});

			// Half an hour for each employee, on the same day
			for (const [index, [employeeId]] of employees.entries()) {
				const log = `77777777-7777-4777-8777-77777777777${index}`;
				const slot = `88888888-8888-4888-8888-88888888888${index}`;
				const startedAt = `${DAY} 0${index}:00:00`;
				await insert('time_log', {
					...scope,
					id: log,
					employeeId,
					projectId: PROJECT,
					organizationContactId: CONTACT,
					startedAt,
					stoppedAt: `${DAY} 0${index}:30:00`
				});
				await insert('time_slot', { ...scope, id: slot, employeeId, startedAt });
				await insert('time_slot_time_logs', { timeSlotId: slot, timeLogId: log });
			}

			// A caller who may read every employee's time, as the reports' own permission check sees one.
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
				id: USER,
				tenantId: TENANT,
				employeeId: EURO_EMPLOYEE
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
					chart: await read(() => target().getOwedAmountReportCharts(request)),
					projectBudget: await read(() => target().getProjectBudgetLimit(request)),
					clientBudget: await read(() => target().getClientBudgetLimit(request)),
					list: await read(() => target().getTimeLogs({ ...request, relations: ['project'] })),
					listWithSlots: await read(() =>
						target().getTimeLogs({ ...request, relations: ['project', 'timeSlots'] })
					)
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

			// TypeORM, on the same tables and rows.
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			try {
				measurement.typeOrm = await reads(() => service(undefined));
			} finally {
				jest.restoreAllMocks();
			}
		});
	} finally {
		jest.restoreAllMocks();
		// Here rather than after the reads, so a read that throws cannot leave the database file open
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

describe('TimeLogService money reports, on one database through both ORMs', () => {
	let measured: { mikroOrm: Reads; typeOrm: Reads };

	beforeAll(async () => {
		measured = await measure();
	}, TIMEOUT);

	describe.each<['MikroORM' | 'TypeORM', 'mikroOrm' | 'typeOrm']>([
		['MikroORM', 'mikroOrm'],
		['TypeORM', 'typeOrm']
	])('%s', (_name, orm) => {
		it('answers each amount owed to its currency, and the organization’s for a rate that states none', () => {
			const { owed } = measured[orm];
			expect(owed.error).toBeUndefined();
			expect(owed).toHaveLength(1);
			expect(owed[0].date).toBe(DAY);

			const amounts = new Map(owed[0].employees.map((line: any) => [line.employee.id, line.amount]));
			// Half an hour at 20.15 is exactly 10.075
			expect(amounts.get(EURO_EMPLOYEE)).toBe(10.08);
			// Half an hour at 1,501 is 750.5, and yen has no minor unit
			expect(amounts.get(ORGANIZATION_CURRENCY_EMPLOYEE)).toBe(751);
			expect(amounts.get(UNBILLED_EMPLOYEE)).toBe(0);
		});

		it('totals the day for the chart', () => {
			const { chart } = measured[orm];
			expect(chart.error).toBeUndefined();
			expect(chart.find(({ date }: any) => date === DAY).value).toBe(761.08);
		});

		it('answers the project’s currency and colour with its budget', () => {
			const { projectBudget } = measured[orm];
			expect(projectBudget.error).toBeUndefined();
			expect(projectBudget).toEqual([
				expect.objectContaining({
					budget: 1000,
					// Each half hour priced at its rate, and nothing for the employee without one
					spent: 760.58,
					project: expect.objectContaining({ id: PROJECT, currency: 'EUR', color: '#3366ff' })
				})
			]);
			expect(projectBudget[0].project).not.toHaveProperty('timeLogs');
		});

		it('answers a client’s budget in hours from the same logs', () => {
			const { clientBudget } = measured[orm];
			expect(clientBudget.error).toBeUndefined();
			expect(clientBudget).toEqual([expect.objectContaining({ budget: 2, spent: 1.5 })]);
		});

		it('answers the project’s colour with each listed log, also when only slot activity is read', () => {
			for (const list of [measured[orm].list, measured[orm].listWithSlots]) {
				expect(list.error).toBeUndefined();
				expect(list.map(({ project }: any) => project.color)).toEqual(['#3366ff', '#3366ff', '#3366ff']);
			}
		});
	});
});
