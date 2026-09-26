import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * The time-log list — `TimeLogService.getTimeLogs`, the read behind the `timeLogs` GraphQL field and
 * `GET /timesheet/time-log` — on one SQLite database with the tables TypeORM creates, read through both ORMs.
 *
 * Under `DB_ORM=mikro-orm` the field failed with SQLite's `at most 64 tables in a join`, while TypeORM answered on
 * the same database. The MikroORM branch populates six paths (`employee`, `employee.user`, `timeSlots`, `project`,
 * `task`, `organizationContact`), and MikroORM 6's `autoJoinRefsForFilters` (on by default) joined, besides those,
 * every to-one relation of the time log and of every populated or eager row — `createdByUser`, `updatedByUser`,
 * `deletedByUser`, `tenant`, `organization`, `timesheet`, `organizationTeam`… — because each of them points at an
 * entity with a default-on filter (the soft-delete filter every platform entity carries). One statement, 80 joins.
 * Loading `select-in` does not help: those reference joins stay in the root statement (72).
 *
 * TypeORM joins only what it is asked for: `employee` and `timeSlots`, which it filters on. The platform's MikroORM
 * configuration now does the same (`MIKRO_ORM_AUTO_JOIN_REFS_FOR_FILTERS` in `@gauzy/config`), and this suite
 * measures the read against it and against MikroORM's own default, and the TypeORM read beside it.
 *
 * The entities are imported under `DB_ORM=mikro-orm` in a registry kept open while both ORMs build their metadata
 * and read (see `dual-orm-mapping-parity.spec.ts`); everything is measured in `beforeAll` and asserted below.
 */

const TIMEOUT = 15 * 60 * 1000;

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const EMPLOYEE = '44444444-4444-4444-8444-444444444444';
const LIVE_PROJECT = '55555555-5555-4555-8555-555555555551';
const DELETED_PROJECT = '55555555-5555-4555-8555-555555555552';
const TASK = '66666666-6666-4666-8666-666666666666';
const FIRST_LOG = '77777777-7777-4777-8777-777777777771';
const SECOND_LOG = '77777777-7777-4777-8777-777777777772';
const FIRST_SLOT = '88888888-8888-4888-8888-888888888881';
const SECOND_SLOT = '88888888-8888-4888-8888-888888888882';

/** What one read answered, or how it failed. */
interface IRead {
	error?: string;
	/** The tables each statement joined, in order. */
	joins: string[][];
	rows: Array<{ id: string; project: unknown; user: unknown; task: unknown; timeSlots: number | undefined }>;
}

interface IMeasurement {
	autoJoinRefsForFilters: unknown;
	/** The service read under MikroORM's own default for `autoJoinRefsForFilters`. */
	mikroOrmDefault: IRead;
	/** The same populate under MikroORM's default, loaded `select-in`. */
	mikroOrmDefaultSelectIn: IRead;
	/** The service read under the platform's MikroORM configuration. */
	mikroOrm: IRead;
	/** …and with the caller naming `project`, as the REST route's query string may. */
	mikroOrmWithProject: IRead;
	/** The service read under TypeORM. */
	typeOrm: IRead;
	typeOrmWithProject: IRead;
}

/** The tables a statement joins, from its SQL: MikroORM quotes identifiers with backticks, TypeORM with quotes. */
function joinedTables(sql: string): string[] {
	return [...sql.matchAll(/\bjoin\s+[`"]([\w]+)[`"]/gi)].map((match) => match[1]);
}

/** The members of one answered row this suite compares: a relation is its loaded name, `null`, or its key. */
function summarize(row: any): IRead['rows'][number] {
	const loaded = (value: any, member: string) =>
		value === null || value === undefined ? value ?? null : typeof value === 'object' ? value[member] : value;
	return {
		id: row.id,
		project: loaded(row.project, 'name'),
		user: row.employee && typeof row.employee === 'object' ? loaded(row.employee.user, 'firstName') : undefined,
		task: loaded(row.task, 'title'),
		timeSlots: Array.isArray(row.timeSlots) ? row.timeSlots.length : undefined
	};
}

async function measure(): Promise<IMeasurement> {
	const previous = process.env.DB_ORM;
	process.env.DB_ORM = 'mikro-orm';
	const file = path.join(os.tmpdir(), `gauzy-time-log-joins-${process.pid}-${Date.now()}.sqlite3`);
	const measurement = {} as IMeasurement;

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

			measurement.autoJoinRefsForFilters = dbMikroOrmConnectionConfig.autoJoinRefsForFilters;

			// The tables TypeORM creates, as the migrations create them for the running platform.
			const typeOrmStatements: string[] = [];
			const dataSource = new DataSource({
				type: 'better-sqlite3',
				database: file,
				entities: coreEntities,
				synchronize: true,
				logging: ['query'],
				logger: {
					logQuery: (query: string) => typeOrmStatements.push(query),
					logQueryError: () => undefined,
					logQuerySlow: () => undefined,
					logSchemaBuild: () => undefined,
					logMigration: () => undefined,
					log: () => undefined
				}
			});
			await dataSource.initialize();

			// The custom-fields placeholder column the migrations add (`AlterCustomFieldsDefaultColumn`), which
			// synchronize leaves out because the bootstrap registers custom fields with TypeORM, not the decorators.
			for (const table of ['employee', 'organization_project']) {
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

			await dataSource.query('PRAGMA foreign_keys = OFF');
			await insert('tenant', { id: TENANT, name: 'Tenant' });
			await insert('organization', { id: ORGANIZATION, tenantId: TENANT, name: 'Organization' });
			await insert('user', { id: USER, tenantId: TENANT, firstName: 'Ada', lastName: 'Lovelace' });
			await insert('employee', { id: EMPLOYEE, tenantId: TENANT, organizationId: ORGANIZATION, userId: USER });
			await insert('organization_project', {
				id: LIVE_PROJECT,
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				name: 'Live'
			});
			await insert('organization_project', {
				id: DELETED_PROJECT,
				tenantId: TENANT,
				organizationId: ORGANIZATION,
				name: 'Deleted',
				deletedAt: '2026-01-02 00:00:00'
			});
			await insert('task', { id: TASK, tenantId: TENANT, organizationId: ORGANIZATION, title: 'Task' });
			for (const [log, project, slot, startedAt] of [
				[FIRST_LOG, LIVE_PROJECT, FIRST_SLOT, '2026-01-10 09:00:00'],
				[SECOND_LOG, DELETED_PROJECT, SECOND_SLOT, '2026-01-10 10:00:00']
			]) {
				await insert('time_log', {
					id: log,
					tenantId: TENANT,
					organizationId: ORGANIZATION,
					employeeId: EMPLOYEE,
					projectId: project,
					taskId: TASK,
					startedAt,
					stoppedAt: startedAt
				});
				await insert('time_slot', {
					id: slot,
					tenantId: TENANT,
					organizationId: ORGANIZATION,
					employeeId: EMPLOYEE,
					startedAt
				});
				await insert('time_slot_time_logs', { timeSlotId: slot, timeLogId: log });
			}

			// A caller who may read every employee's time, as the list's own permission check sees one.
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
				id: USER,
				tenantId: TENANT,
				employeeId: EMPLOYEE
			} as any);
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
			jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);

			const service = (mikroOrmRepository: unknown) =>
				new TimeLogService(
					dataSource.getRepository(TimeLog),
					mikroOrmRepository,
					{} as any,
					{} as any,
					{} as any,
					{} as any,
					{ canManageEmployees: async () => true } as any
				);

			// The arguments the `timeLogs` field hands the read, and the REST route's `relations` beside them.
			const request = { organizationId: ORGANIZATION };
			const withProject = { organizationId: ORGANIZATION, relations: ['project'] };

			const read = async (statements: string[], run: () => Promise<any[]>): Promise<IRead> => {
				statements.length = 0;
				try {
					const rows = await run();
					return { joins: statements.map(joinedTables), rows: rows.map(summarize) };
				} catch (error) {
					return { error: (error as Error).message, joins: statements.map(joinedTables), rows: [] };
				}
			};

			const mikroOrmStatements: string[] = [];
			const openMikroOrm = (options: Record<string, unknown>) =>
				MikroORM.init({
					...options,
					dbName: file,
					entities: coreEntities,
					allowGlobalContext: true,
					debug: ['query'],
					colors: false,
					logger: (message: string) => mikroOrmStatements.push(message),
					discovery: { warnWhenNoEntities: false }
				});

			// MikroORM's own default: the platform's configuration without the option.
			const { autoJoinRefsForFilters: _stated, ...mikroOrmDefaults } = dbMikroOrmConnectionConfig;
			const mikroOrmDefault = await openMikroOrm(mikroOrmDefaults);
			try {
				measurement.mikroOrmDefault = await read(mikroOrmStatements, () =>
					service(new MikroOrmTimeLogRepository(mikroOrmDefault.em.fork(), TimeLog)).getTimeLogs(request)
				);
				measurement.mikroOrmDefaultSelectIn = await read(mikroOrmStatements, () =>
					mikroOrmDefault.em.fork().find(
						TimeLog,
						{ tenantId: TENANT, organizationId: ORGANIZATION },
						{
							populate: ['employee', 'employee.user', 'timeSlots', 'project', 'task', 'organizationContact'],
							orderBy: { startedAt: 'ASC' },
							strategy: 'select-in'
						}
					)
				);
			} finally {
				await mikroOrmDefault.close(true);
			}

			// The platform's configuration.
			const mikroOrm = await openMikroOrm(dbMikroOrmConnectionConfig);
			try {
				measurement.mikroOrm = await read(mikroOrmStatements, () =>
					service(new MikroOrmTimeLogRepository(mikroOrm.em.fork(), TimeLog)).getTimeLogs(request)
				);
				measurement.mikroOrmWithProject = await read(mikroOrmStatements, () =>
					service(new MikroOrmTimeLogRepository(mikroOrm.em.fork(), TimeLog)).getTimeLogs(withProject)
				);
			} finally {
				await mikroOrm.close(true);
			}

			// TypeORM, on the same tables and rows.
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.TypeORM);
			try {
				measurement.typeOrm = await read(typeOrmStatements, () => service(undefined).getTimeLogs(request));
				measurement.typeOrmWithProject = await read(typeOrmStatements, () =>
					service(undefined).getTimeLogs(withProject)
				);
			} finally {
				jest.restoreAllMocks();
				await dataSource.destroy();
			}
		});
	} finally {
		jest.restoreAllMocks();
		if (previous === undefined) delete process.env.DB_ORM;
		else process.env.DB_ORM = previous;
		try {
			fs.unlinkSync(file);
		} catch {
			// Nothing to remove: the database was never created.
		}
	}

	return measurement;
}

describe('TimeLogService.getTimeLogs joins what it loads, on MikroORM as on TypeORM', () => {
	let measured: IMeasurement;

	beforeAll(async () => {
		measured = await measure();
	}, TIMEOUT);

	it('reproduces the defect under MikroORM’s own default: one statement joining more than 64 tables', () => {
		expect(measured.mikroOrmDefault.error).toMatch(/at most 64 tables in a join/);
		const [statement] = measured.mikroOrmDefault.joins;
		expect(statement.length).toBeGreaterThan(64);
		// References nobody populated, joined only to see whether the soft-delete filter hides their row.
		expect(statement).toEqual(expect.arrayContaining(['tenant', 'organization', 'timesheet', 'organization_team']));
	});

	it('is not cured by loading the populated relations select-in: the reference joins stay in the root statement', () => {
		expect(measured.mikroOrmDefaultSelectIn.error).toMatch(/at most 64 tables in a join/);
		expect(measured.mikroOrmDefaultSelectIn.joins[0].length).toBeGreaterThan(64);
	});

	it('runs with the platform’s MikroORM configuration, which joins only references a read loads', () => {
		expect(measured.autoJoinRefsForFilters).toBe(false);
		expect(measured.mikroOrm.error).toBeUndefined();

		// The six populated paths, the junction of `timeSlots`, and the eager image of the user, project and client.
		const [statement] = measured.mikroOrm.joins;
		expect(new Set(statement)).toEqual(
			new Set([
				'employee',
				'user',
				'image_asset',
				'time_slot_time_logs',
				'time_slot',
				'organization_project',
				'task',
				'organization_contact'
			])
		);
		expect(statement.length).toBeLessThanOrEqual(64);
	});

	it('answers the rows TypeORM answers, oldest first, with the relations populated', () => {
		expect(measured.typeOrm.error).toBeUndefined();
		expect(measured.mikroOrm.rows.map((row) => row.id)).toEqual([FIRST_LOG, SECOND_LOG]);
		expect(measured.typeOrm.rows.map((row) => row.id)).toEqual([FIRST_LOG, SECOND_LOG]);

		expect(measured.mikroOrm.rows).toEqual([
			{ id: FIRST_LOG, project: 'Live', user: 'Ada', task: 'Task', timeSlots: 1 },
			// A populated relation still leaves out a soft-deleted row: the filter is on its own join.
			{ id: SECOND_LOG, project: null, user: 'Ada', task: 'Task', timeSlots: 1 }
		]);
	});

	it('leaves out a soft-deleted related row on both ORMs when the caller names the relation', () => {
		expect(measured.mikroOrmWithProject.error).toBeUndefined();
		expect(measured.typeOrmWithProject.error).toBeUndefined();
		expect(measured.mikroOrmWithProject.rows.map((row) => row.project)).toEqual(['Live', null]);
		// TypeORM puts `deletedAt IS NULL` on the join, so the relation is not set.
		expect(measured.typeOrmWithProject.rows.map((row) => row.project)).toEqual(['Live', null]);
	});

	it('leaves the TypeORM statement as it was: the two relations it filters on, and nothing else', () => {
		expect(measured.typeOrm.joins).toHaveLength(1);
		expect(measured.typeOrm.joins[0]).toEqual(['employee', 'time_slot_time_logs', 'time_slot']);
	});
});
