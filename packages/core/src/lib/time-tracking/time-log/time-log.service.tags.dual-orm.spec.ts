import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Tags on time logs (ever-co/ever-gauzy#12029) on one SQLite database with the tables TypeORM creates, read through
 * both ORMs: the list's `tags` relation, the `tagIds` and `untagged` filters on the list and the reports, each daily
 * report row with its tags, the weekly report's filter, and the change of a log's tags.
 *
 * Marie's Tuesday: 2 h of "meeting", 3 h filed under "support" and "design", 3 h without a tag, whose only link is to a
 * deleted tag. The entities are imported under `DB_ORM=mikro-orm` in a registry kept open while both ORMs build their
 * metadata and read (see `time-log.service.mikro-orm-joins.spec.ts`); everything is measured in `beforeAll`.
 */

const TIMEOUT = 15 * 60 * 1000;

const TENANT = '11111111-1111-4111-8111-111111111111';
const ORGANIZATION = '22222222-2222-4222-8222-222222222222';
const OTHER_ORGANIZATION = '22222222-2222-4222-8222-222222222229';
const USER = '33333333-3333-4333-8333-333333333333';
const MARIE = '44444444-4444-4444-8444-444444444441';
const MEETING = '99999999-9999-4999-8999-9999999999a1';
const SUPPORT = '99999999-9999-4999-8999-9999999999a2';
const DESIGN = '99999999-9999-4999-8999-9999999999a3';
const DELETED = '99999999-9999-4999-8999-9999999999a4';
const THEIRS = '99999999-9999-4999-8999-9999999999b1';
const MEETING_LOG = '77777777-7777-4777-8777-777777777771';
const SUPPORT_LOG = '77777777-7777-4777-8777-777777777772';
const UNTAGGED_LOG = '77777777-7777-4777-8777-777777777773';
const TUESDAY = '2026-11-10';

/** What each read answered through one ORM, or how it failed. */
type Reads = Record<
	| 'list'
	| 'byMeeting'
	| 'bySupport'
	| 'untagged'
	| 'meetingOrUntagged'
	| 'daily'
	| 'dailyByMeeting'
	| 'chartByMeeting'
	| 'weekly'
	| 'weeklyByMeeting'
	| 'changed'
	| 'refused'
	| 'afterRefusal',
	any
>;

async function measure(): Promise<{ mikroOrm: Reads; typeOrm: Reads }> {
	const previous = { DB_ORM: process.env.DB_ORM, DB_TYPE: process.env.DB_TYPE };
	process.env.DB_ORM = 'mikro-orm';
	// Whatever database the machine's environment names: both ORMs read the one SQLite file below
	process.env.DB_TYPE = 'better-sqlite3';
	const file = path.join(os.tmpdir(), `gauzy-time-log-tags-${process.pid}-${Date.now()}.sqlite3`);
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
			const { GetTimeLogGroupByDateHandler } = require('./commands/handlers/get-time-log-group-by-date.handler');

			// The tables TypeORM creates, as the migrations create them for the running platform.
			dataSource = new DataSource({
				type: 'better-sqlite3',
				database: file,
				entities: coreEntities,
				synchronize: true
			});
			await dataSource.initialize();

			// The custom-fields placeholder column the migrations add, which synchronize leaves out.
			for (const table of ['employee', 'organization_project', 'organization_contact', 'tag']) {
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
			await insert('organization', { id: ORGANIZATION, tenantId: TENANT, name: 'Organization', currency: 'EUR' });
			await insert('user', { id: USER, tenantId: TENANT, firstName: 'Marie', lastName: 'Curie' });
			await insert('employee', { ...scope, id: MARIE, userId: USER });

			const tags: Array<[string, string, string, string | null]> = [
				[MEETING, 'meeting', '#f59e0b', ORGANIZATION],
				[SUPPORT, 'support', '#10b981', ORGANIZATION],
				[DESIGN, 'design', '#6366f1', null],
				[DELETED, 'deleted', '#999999', ORGANIZATION],
				[THEIRS, 'theirs', '#000000', OTHER_ORGANIZATION]
			];
			for (const [id, name, color, organizationId] of tags) {
				await insert('tag', { id, name, color, tenantId: TENANT, organizationId, isSystem: false });
			}
			await dataSource.query(`UPDATE "tag" SET "deletedAt" = '2026-11-01 00:00:00' WHERE "id" = ?`, [DELETED]);

			// 2 h of meeting, 3 h of support and design, 3 h whose only tag was deleted since
			const logs: Array<[string, string, string, string[]]> = [
				[MEETING_LOG, '08:00:00', '10:00:00', [MEETING]],
				[SUPPORT_LOG, '10:00:00', '13:00:00', [SUPPORT, DESIGN]],
				[UNTAGGED_LOG, '14:00:00', '17:00:00', [DELETED]]
			];
			for (const [index, [id, from, until, linked]] of logs.entries()) {
				const slot = `88888888-8888-4888-8888-88888888888${index}`;
				await insert('time_log', {
					...scope,
					id,
					employeeId: MARIE,
					startedAt: `${TUESDAY} ${from}`,
					stoppedAt: `${TUESDAY} ${until}`,
					logType: 'MANUAL',
					source: 'TEAMS',
					isActive: true,
					isArchived: false
				});
				await insert('time_slot', { ...scope, id: slot, employeeId: MARIE, startedAt: `${TUESDAY} ${from}` });
				await insert('time_slot_time_logs', { timeSlotId: slot, timeLogId: id });
				for (const tagId of linked) {
					await insert('tag_time_log', { timeLogId: id, tagId });
				}
			}

			// A caller who may read and write every employee's time, as the reports' own permission check sees one.
			jest.spyOn(RequestContext, 'currentUser').mockReturnValue({
				id: USER,
				tenantId: TENANT,
				employeeId: MARIE
			} as any);
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT);
			jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);

			const groupByDate = new GetTimeLogGroupByDateHandler();
			const service = (mikroOrmRepository: unknown) => {
				const built = new TimeLogService(
					dataSource.getRepository(TimeLog),
					mikroOrmRepository,
					{} as any,
					dataSource.getRepository(OrganizationProject),
					dataSource.getRepository(OrganizationContact),
					{ execute: (command: any) => groupByDate.execute(command) } as any,
					{ canManageEmployees: async () => true, canManageEmployee: async () => true } as any
				);
				// A read by id is bounded by the caller's organizations, which this spec does not model: the change of
				// tags reads its log as stored
				built.findOneByIdString = (async (id: string) =>
					dataSource.getRepository(TimeLog).findOneByOrFail({ id })) as any;
				return built;
			};

			const request = {
				organizationId: ORGANIZATION,
				startDate: '2026-11-01T00:00:00.000Z',
				endDate: '2026-11-30T00:00:00.000Z',
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
				const listed = (filter: Record<string, unknown>) =>
					read(() => target().getTimeLogs({ ...request, ...filter, relations: ['tags'] }));
				const result = {
					list: await listed({}),
					byMeeting: await listed({ tagIds: [MEETING] }),
					bySupport: await listed({ tagIds: [SUPPORT] }),
					untagged: await listed({ untagged: true }),
					meetingOrUntagged: await listed({ tagIds: [MEETING], untagged: true }),
					daily: await read(() => target().getDailyReport(request)),
					dailyByMeeting: await read(() => target().getDailyReport({ ...request, tagIds: [MEETING] })),
					chartByMeeting: await read(() => target().getDailyReportCharts({ ...request, tagIds: [MEETING] })),
					weekly: await read(() => target().getWeeklyReport(request)),
					weeklyByMeeting: await read(() => target().getWeeklyReport({ ...request, tagIds: [MEETING] })),
					changed: await read(() =>
						target().updateTimeLogTags(MEETING_LOG, { organizationId: ORGANIZATION, tags: [SUPPORT] })
					),
					refused: await read(() =>
						target().updateTimeLogTags(MEETING_LOG, {
							organizationId: ORGANIZATION,
							tags: [MEETING, THEIRS]
						})
					),
					afterRefusal: await listed({})
				};
				// Back as it was for the next ORM
				await dataSource.query(`DELETE FROM "tag_time_log" WHERE "timeLogId" = ?`, [MEETING_LOG]);
				await dataSource.query(`INSERT INTO "tag_time_log" ("timeLogId", "tagId") VALUES (?, ?)`, [
					MEETING_LOG,
					MEETING
				]);
				return result;
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

/** The names of a log's tags, in the order they are answered. */
const tagNames = (log: any): string[] => (log?.tags ?? []).map((tag: any) => tag.name);

/** The ids of the logs a list answered, in its order. */
const logIds = (list: any[]): string[] => list.map((log) => log.id);

/** Every task row of a daily report, flattened. */
const dailyRows = (report: any[]): any[] =>
	report.flatMap((day) =>
		day.logs.flatMap((byProject: any) => byProject.employeeLogs.flatMap((row: any) => row.tasks))
	);

describe('TimeLogService tags, on one database through both ORMs', () => {
	let measured: { mikroOrm: Reads; typeOrm: Reads };

	beforeAll(async () => {
		measured = await measure();
	}, TIMEOUT);

	describe.each<['MikroORM' | 'TypeORM', 'mikroOrm' | 'typeOrm']>([
		['MikroORM', 'mikroOrm'],
		['TypeORM', 'typeOrm']
	])('%s', (_name, orm) => {
		it('answers each listed log with its live tags (id, name, color), by name', () => {
			const { list } = measured[orm];
			expect(list.error).toBeUndefined();
			expect(list.map(tagNames)).toEqual([['meeting'], ['design', 'support'], []]);
			expect(list[0].tags).toEqual([{ id: MEETING, name: 'meeting', color: '#f59e0b' }]);
		});

		it('keeps the logs that carry one of the tags asked for', () => {
			expect(logIds(measured[orm].byMeeting)).toEqual([MEETING_LOG]);
			expect(logIds(measured[orm].bySupport)).toEqual([SUPPORT_LOG]);
		});

		it('keeps the time that carries no live tag, alone or beside a tag', () => {
			expect(logIds(measured[orm].untagged)).toEqual([UNTAGGED_LOG]);
			expect(logIds(measured[orm].meetingOrUntagged)).toEqual([MEETING_LOG, UNTAGGED_LOG]);
		});

		it("answers Tuesday's 8 h without the filter, each row with its tags", () => {
			const { daily } = measured[orm];
			expect(daily.error).toBeUndefined();
			expect(daily.map((day: any) => [day.date, day.sum])).toEqual([[TUESDAY, 8 * 3600]]);
			expect(dailyRows(daily).map((row) => row.tags.map((tag: any) => tag.name))).toEqual([
				['meeting'],
				['design', 'support'],
				[]
			]);
		});

		it("answers Tuesday's 2 h of meeting with the filter, in the report and its chart", () => {
			const { dailyByMeeting, chartByMeeting } = measured[orm];
			expect(dailyByMeeting.map((day: any) => [day.date, day.sum])).toEqual([[TUESDAY, 2 * 3600]]);
			expect(chartByMeeting.find(({ date }: any) => date === TUESDAY).value.MANUAL).toBe(2);
		});

		it('counts in the week the logs of the tag asked for', () => {
			const { weekly, weeklyByMeeting } = measured[orm];
			expect(weekly.error).toBeUndefined();
			expect(weekly[0].dates[TUESDAY].sum).toBe(8 * 3600);
			expect(weeklyByMeeting[0].dates[TUESDAY].sum).toBe(2 * 3600);
		});

		it("changes a log's tags and nothing else, and refuses a tag of another organization", () => {
			const { changed, refused, afterRefusal } = measured[orm];
			expect(changed.error).toBeUndefined();
			expect(tagNames(changed)).toEqual(['support']);
			expect(changed.startedAt).toBeDefined();
			expect(refused.error).toMatch(/another organization or tenant/);
			// The refused change wrote nothing: the log keeps the tag of the change before it
			expect(tagNames(afterRefusal.find((log: any) => log.id === MEETING_LOG))).toEqual(['support']);
		});
	});
});
