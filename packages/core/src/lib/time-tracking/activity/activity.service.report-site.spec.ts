import '../../core/entities/internal';

import { DatabaseTypeEnum, getConfig } from '@gauzy/config';
import { knex as createKnex, Knex } from 'knex';
import { DataSource, EntitySchema } from 'typeorm';
import { RequestContext } from '../../core/context';
import { CrudService } from '../../core/crud/crud.service';
import { MultiORMEnum } from '../../core/utils';
import { ActivityService } from './activity.service';

/**
 * ever-co/ever-teams#5023: a row of the daily reads (the report, and the daily list behind the Apps and Visited
 * sites tabs) says whether its activities are an app's or a site's, and gives a site's address, so a client can draw
 * its icon. The rows are grouped by title, and a site is often recorded under its page's title: the address comes
 * from the metadata of the row's URL activities, as a JSON string only. Never from an app's: on macOS the desktop
 * timer records the browser's current page in the browser's own entry too.
 *
 * Both reads run on both ORMs, on an in-memory SQLite store (the dialect the tests run on): the MikroORM branches
 * through knex as they run, the TypeORM branches through a DataSource whose schemas hold the columns and joins
 * their query uses.
 */

const PAGE = 'https://github.com/ever-co/ever-teams/pulls';

/** The activities of the day, each one minute. */
const ACTIVITIES: ReadonlyArray<{ title: string; type: string; metaData: string | null }> = [
	// The browser's own entry holds the page it showed
	{
		title: 'Google Chrome',
		type: 'APP',
		metaData: JSON.stringify({ title: 'Pull requests', url: PAGE, platform: 'macos' })
	},
	{
		title: 'Google Chrome',
		type: 'APP',
		metaData: JSON.stringify({ title: 'Pull requests', url: PAGE, platform: 'macos' })
	},
	// The site, recorded under its page's title
	{
		title: 'Pull requests · ever-co/ever-teams',
		type: 'URL',
		metaData: JSON.stringify({ title: 'Pull requests', url: PAGE })
	},
	{
		title: 'Pull requests · ever-co/ever-teams',
		type: 'URL',
		metaData: JSON.stringify({ title: 'Pull requests', url: PAGE })
	},
	{ title: 'Figma', type: 'APP', metaData: null },
	// Sites whose metadata holds no address: none at all, a JSON null, a number, and text that is not JSON
	{ title: 'example.net', type: 'URL', metaData: JSON.stringify({ title: 'Example' }) },
	{ title: 'null.example', type: 'URL', metaData: JSON.stringify({ title: 'Null', url: null }) },
	{ title: 'number.example', type: 'URL', metaData: JSON.stringify({ title: 'Number', url: 42 }) },
	{ title: 'docs.example.org', type: 'URL', metaData: 'not json' },
	// An app recorded under a site's title: `MAX` keeps the title one row, a site's
	{ title: 'example.net', type: 'APP', metaData: null }
];

const READS = ['getDailyActivitiesReport', 'getDailyActivities'] as const;
type Read = (typeof READS)[number];
type Rows = Map<string, any>;

/** The rows by title, once each title is known to be one row: a Map would hide a group the read split in two. */
function byTitle(rows: any[]): Rows {
	expect(new Set(rows.map((row) => row.title)).size).toBe(rows.length);
	return new Map(rows.map((row) => [row.title, row]));
}

function expectAppOrSite(rows: Rows) {
	expect(rows.size).toBe(7);
	expect(rows.get('Google Chrome')?.type).toBe('APP');
	expect(Number(rows.get('Google Chrome')?.sessions)).toBe(2);
	expect(rows.get('Pull requests · ever-co/ever-teams')?.type).toBe('URL');
	expect(rows.get('Figma')?.type).toBe('APP');
}

function expectSiteAddress(rows: Rows) {
	expect(rows.get('Pull requests · ever-co/ever-teams')?.url).toBe(PAGE);
	expect(rows.get('Google Chrome')?.url ?? null).toBeNull();
	expect(rows.get('Figma')?.url ?? null).toBeNull();
}

function expectNoAddress(rows: Rows) {
	for (const title of ['example.net', 'null.example', 'number.example', 'docs.example.org']) {
		expect(rows.get(title)?.type).toBe('URL');
		expect(rows.get(title)?.url ?? null).toBeNull();
	}
}

/** The service on the given repositories, as the reads use them; the employee and project lookups find none. */
function serviceOn(typeOrmRepository: unknown, mikroOrmRepository: unknown): ActivityService {
	return new ActivityService(
		typeOrmRepository as any,
		mikroOrmRepository as any,
		{ find: jest.fn(async () => []) } as any,
		{ find: jest.fn(async () => []) } as any,
		{} as any
	);
}

function actAs(ormType: MultiORMEnum) {
	// The stores here are SQLite: the reads must speak its dialect, whatever DB_TYPE the run was started with
	jest.replaceProperty(getConfig().dbConnectionOptions as { type: string }, 'type', DatabaseTypeEnum.betterSqlite3);
	jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(ormType);
	jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
	jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);
}

describe.each(READS)(
	'ActivityService.%s (MikroORM) tells an app from a site, with the site address',
	(method: Read) => {
		let db: Knex;

		beforeAll(async () => {
			db = createKnex({ client: 'better-sqlite3', connection: { filename: ':memory:' }, useNullAsDefault: true });
			await db.schema.createTable('employee', (table) => {
				table.string('id').primary();
				table.datetime('deletedAt').nullable();
			});
			await db.schema.createTable('time_slot', (table) => {
				table.string('id').primary();
				table.datetime('deletedAt').nullable();
			});
			await db.schema.createTable('time_slot_time_logs', (table) => {
				table.string('timeSlotId');
				table.string('timeLogId');
			});
			await db.schema.createTable('activity', (table) => {
				table.string('id').primary();
				table.string('tenantId');
				table.string('organizationId');
				table.string('employeeId');
				table.string('projectId').nullable();
				table.string('timeSlotId');
				table.string('date');
				table.string('title');
				table.integer('duration');
				table.string('type').nullable();
				// A text column on SQLite, as the entity declares it there
				table.text('metaData').nullable();
				table.datetime('deletedAt').nullable();
			});
			await db('employee').insert({ id: 'employee-1', deletedAt: null });
			await db('time_slot').insert({ id: 'slot-1', deletedAt: null });
			await db('time_slot_time_logs').insert({ timeSlotId: 'slot-1', timeLogId: 'log-1' });
			await db('activity').insert(
				ACTIVITIES.map((activity, index) => ({
					id: `activity-${index + 1}`,
					tenantId: 'tenant-1',
					organizationId: 'org-1',
					employeeId: 'employee-1',
					timeSlotId: 'slot-1',
					date: '2026-11-11',
					duration: 60,
					deletedAt: null,
					...activity
				}))
			);
		});

		afterAll(async () => {
			await db?.destroy();
		});

		beforeEach(() => actAs(MultiORMEnum.MikroORM));

		afterEach(() => jest.restoreAllMocks());

		const read = async (): Promise<Rows> => {
			const service = serviceOn({ metadata: { tableName: 'activity' } }, { getKnex: () => db });
			const rows: any[] = await service[method]({
				organizationId: 'org-1',
				startDate: '2026-11-11',
				endDate: '2026-11-11'
			} as any);
			return byTitle(rows);
		};

		it('says whether each row is an app or a site, the grouping by title kept', async () => {
			expectAppOrSite(await read());
		});

		it("gives a site its address, and an app none, even with the browser's page in its entry", async () => {
			expectSiteAddress(await read());
		});

		it('leaves the address out when the metadata holds none as a string or is not JSON, without failing the read', async () => {
			expectNoAddress(await read());
		});
	}
);

/** The columns and joins the TypeORM reads use (employee, time slot and its time logs), nothing more. */
const EmployeeSchema = new EntitySchema<any>({
	name: 'Employee',
	tableName: 'employee',
	columns: { id: { type: String, primary: true } }
});

const TimeLogSchema = new EntitySchema<any>({
	name: 'TimeLog',
	tableName: 'time_log',
	columns: {
		id: { type: String, primary: true },
		tenantId: { type: String },
		organizationId: { type: String },
		source: { type: String, nullable: true },
		logType: { type: String, nullable: true }
	}
});

const TimeSlotSchema = new EntitySchema<any>({
	name: 'TimeSlot',
	tableName: 'time_slot',
	columns: {
		id: { type: String, primary: true },
		tenantId: { type: String },
		organizationId: { type: String },
		overall: { type: Number, nullable: true }
	},
	relations: {
		timeLogs: {
			type: 'many-to-many',
			target: 'TimeLog',
			joinTable: {
				name: 'time_slot_time_logs',
				joinColumn: { name: 'timeSlotId', referencedColumnName: 'id' },
				inverseJoinColumn: { name: 'timeLogId', referencedColumnName: 'id' }
			}
		}
	}
});

const ActivitySchema = new EntitySchema<any>({
	name: 'Activity',
	tableName: 'activity',
	columns: {
		id: { type: String, primary: true },
		tenantId: { type: String },
		organizationId: { type: String },
		employeeId: { type: String },
		projectId: { type: String, nullable: true },
		timeSlotId: { type: String },
		title: { type: String },
		type: { type: String, nullable: true },
		// A text column on SQLite, as the entity declares it there
		metaData: { type: 'text', nullable: true },
		date: { type: String },
		time: { type: String },
		duration: { type: Number },
		recordedAt: { type: String }
	},
	relations: {
		employee: { type: 'many-to-one', target: 'Employee', joinColumn: { name: 'employeeId' } },
		timeSlot: { type: 'many-to-one', target: 'TimeSlot', joinColumn: { name: 'timeSlotId' } }
	}
});

describe.each(READS)('ActivityService.%s (TypeORM) tells an app from a site, with the site address', (method: Read) => {
	let dataSource: DataSource;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [EmployeeSchema, TimeLogSchema, TimeSlotSchema, ActivitySchema],
			synchronize: true,
			logging: false
		});
		await dataSource.initialize();
		const scope = { tenantId: 'tenant-1', organizationId: 'org-1' };
		await dataSource.getRepository('Employee').save({ id: 'employee-1' });
		await dataSource.getRepository('TimeLog').save({ id: 'log-1', ...scope });
		await dataSource.getRepository('TimeSlot').save({ id: 'slot-1', ...scope, timeLogs: [{ id: 'log-1' }] });
		await dataSource.getRepository('Activity').save(
			ACTIVITIES.map((activity, index) => ({
				id: `activity-${index + 1}`,
				...scope,
				employeeId: 'employee-1',
				timeSlotId: 'slot-1',
				date: '2026-11-11',
				time: '13:00:00',
				recordedAt: '2026-11-11 13:00:00',
				duration: 60,
				...activity
			}))
		);
	});

	afterAll(async () => {
		await dataSource?.destroy();
	});

	beforeEach(() => actAs(MultiORMEnum.TypeORM));

	afterEach(() => jest.restoreAllMocks());

	const read = async (): Promise<Rows> => {
		const service = serviceOn(dataSource.getRepository('Activity'), {});
		const rows: any[] = await service[method]({
			organizationId: 'org-1',
			startDate: '2026-11-11 00:00:00',
			endDate: '2026-11-11 23:59:59'
		} as any);
		return byTitle(rows);
	};

	it('says whether each row is an app or a site, the grouping by title kept', async () => {
		expectAppOrSite(await read());
	});

	it("gives a site its address, and an app none, even with the browser's page in its entry", async () => {
		expectSiteAddress(await read());
	});

	it('leaves the address out when the metadata holds none as a string or is not JSON, without failing the read', async () => {
		expectNoAddress(await read());
	});
});
