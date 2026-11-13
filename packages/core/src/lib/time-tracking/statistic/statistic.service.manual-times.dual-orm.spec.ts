import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * The dashboard's manual time list (`StatisticService.manualTimes`), on one SQLite database with the tables TypeORM
 * creates, read through both ORMs.
 *
 * The other suites of this method answer from stand-ins: a recorded knex that returns canned rows, or an in-memory
 * table written for the test. Both gave `time_log` a `duration` column, which the real table does not have: the entity
 * works the duration out when it loads (`afterEntityLoad`), and the raw knex read of the MikroORM branch loads no
 * entity. So that branch selected `time_log.duration` and failed with `no such column` on every dialect while its
 * suites stayed green. Same bug class as the budget reads fixed in #11633
 * (`time-log.service.reports.dual-orm.spec.ts`), whose set-up this follows.
 *
 * The entities are imported under `DB_ORM=mikro-orm` in a registry kept open while both ORMs build their metadata and
 * read (see `time-log.service.mikro-orm-joins.spec.ts`); everything is measured in `beforeAll` and asserted below.
 */

const TIMEOUT = 15 * 60 * 1000;

const TENANT = '11111111-1111-4111-8111-111111111112';
const ORGANIZATION = '22222222-2222-4222-8222-222222222223';
const USER = '33333333-3333-4333-8333-333333333334';
const EMPLOYEE = '44444444-4444-4444-8444-444444444445';
const PROJECT = '55555555-5555-4555-8555-555555555556';
const DAY = '2026-01-10';

/** The logs: two manual ones of different lengths, and a tracked one the list leaves out. */
const LOGS = [
	{ id: '77777777-7777-4777-8777-777777777771', logType: 'MANUAL', from: '09:00:00', to: '09:30:00' },
	{ id: '77777777-7777-4777-8777-777777777772', logType: 'MANUAL', from: '11:00:00', to: '12:30:00' },
	{ id: '77777777-7777-4777-8777-777777777773', logType: 'TRACKED', from: '14:00:00', to: '15:00:00' }
];

/** What the read answered through one ORM, or how it failed. */
type Read = any;

async function measure(): Promise<{ mikroOrm: Read; typeOrm: Read }> {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	process.env.DB_ORM = 'mikro-orm';
	// Whatever database the machine's environment names: both ORMs read the one SQLite file below
	process.env.DB_TYPE = 'better-sqlite3';
	const file = path.join(os.tmpdir(), `gauzy-manual-times-${process.pid}-${Date.now()}.sqlite3`);
	const measurement = {} as { mikroOrm: Read; typeOrm: Read };
	let dataSource: any;

	try {
		await jest.isolateModulesAsync(async () => {
			const { coreEntities } = require('../../core/entities');
			const { dbMikroOrmConnectionConfig } = require('@gauzy/config');
			const { DataSource } = require('typeorm');
			const { MikroORM } = require('@mikro-orm/core');
			const { MultiORMEnum } = require('../../core/utils');
			const { RequestContext } = require('../../core/context');
			const { TimeLog } = require('../time-log/time-log.entity');
			const { MikroOrmTimeLogRepository } = require('../time-log/repository/mikro-orm-time-log.repository');
			const { StatisticService } = require('./statistic.service');

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
			for (const table of ['employee', 'organization_project', 'user']) {
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
			await insert('organization', { id: ORGANIZATION, tenantId: TENANT, name: 'Organization' });
			await insert('user', { id: USER, tenantId: TENANT, firstName: 'Ada', lastName: 'Lovelace' });
			await insert('employee', { ...scope, id: EMPLOYEE, userId: USER });
			await insert('organization_project', { ...scope, id: PROJECT, name: 'Live' });

			for (const [index, { id, logType, from, to }] of LOGS.entries()) {
				const slot = `88888888-8888-4888-8888-88888888888${index}`;
				await insert('time_log', {
					...scope,
					id,
					employeeId: EMPLOYEE,
					projectId: PROJECT,
					logType,
					source: 'BROWSER',
					startedAt: `${DAY} ${from}`,
					stoppedAt: `${DAY} ${to}`
				});
				await insert('time_slot', { ...scope, id: slot, employeeId: EMPLOYEE, startedAt: `${DAY} ${from}` });
				await insert('time_slot_time_logs', { timeSlotId: slot, timeLogId: id });
			}

			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);

			const service = (orm: unknown, mikroOrmRepository: unknown) => {
				const statistics = new StatisticService(
					{} as any,
					{} as any,
					{} as any,
					dataSource.getRepository(TimeLog),
					mikroOrmRepository,
					{} as any,
					{} as any,
					{ filterAccessibleEmployeeIds: async (employeeIds: string[]) => employeeIds } as any
				);
				statistics.ormType = orm;
				return statistics;
			};

			const request = {
				organizationId: ORGANIZATION,
				startDate: '2026-01-01T00:00:00.000Z',
				endDate: '2026-01-31T00:00:00.000Z'
			} as any;

			const read = async (run: () => Promise<any>) => {
				try {
					return JSON.parse(JSON.stringify(await run()));
				} catch (error) {
					return { error: (error as Error).message };
				}
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
				measurement.mikroOrm = await read(() =>
					service(
						MultiORMEnum.MikroORM,
						new MikroOrmTimeLogRepository(mikroOrm.em.fork(), TimeLog)
					).manualTimes(request)
				);
			} finally {
				await mikroOrm.close(true);
			}

			// TypeORM, on the same tables and rows.
			measurement.typeOrm = await read(() => service(MultiORMEnum.TypeORM, undefined).manualTimes(request));
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

describe('StatisticService.manualTimes, on one database through both ORMs', () => {
	let measured: { mikroOrm: Read; typeOrm: Read };

	beforeAll(async () => {
		measured = await measure();
	}, TIMEOUT);

	describe.each<['MikroORM' | 'TypeORM', 'mikroOrm' | 'typeOrm']>([
		['MikroORM', 'mikroOrm'],
		['TypeORM', 'typeOrm']
	])('%s', (_name, orm) => {
		it('lists the manual logs only, newest first, each with its duration in seconds', () => {
			const manualTimes = measured[orm];
			expect(manualTimes.error).toBeUndefined();
			expect(manualTimes.map(({ id, duration }: any) => ({ id, duration }))).toEqual([
				// 11:00 to 12:30
				{ id: LOGS[1].id, duration: 5400 },
				// 09:00 to 09:30
				{ id: LOGS[0].id, duration: 1800 }
			]);
		});

		// The user's display name is left out: TypeORM's comes from the user subscriber, which this data source
		// does not register.
		it('answers the employee and the project of each log', () => {
			const [newest] = measured[orm];
			expect(newest.employeeId).toBe(EMPLOYEE);
			expect(newest.project.name).toBe('Live');
		});
	});
});
