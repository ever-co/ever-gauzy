import '../../core/entities/internal';

import { knex as createKnex, Knex } from 'knex';
import { RequestContext } from '../../core/context';
import { CrudService } from '../../core/crud/crud.service';
import { MultiORMEnum } from '../../core/utils';
import { ActivityService } from './activity.service';

/**
 * ever-co/ever-teams#5023: a row of the daily reads (the report, and the daily list behind the Apps and Visited
 * sites tabs) says whether its activities are an app's or a site's, and gives a site's address, so a client can draw
 * its icon. The rows are grouped by title, and a site is often recorded under its page's title: the address comes
 * from the metadata of the row's URL activities. Never from an app's: on macOS the desktop timer records the
 * browser's current page in the browser's own entry too.
 *
 * Run as the MikroORM aggregations run, through knex, on an in-memory SQLite store (the dialect the tests run on).
 */
describe.each(['getDailyActivitiesReport', 'getDailyActivities'] as const)(
	'ActivityService.%s tells an app from a site, with the site address',
	(method) => {
		let db: Knex;
		const PAGE = 'https://github.com/ever-co/ever-teams/pulls';

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

			let count = 0;
			const activity = (title: string, type: string | null, metaData: string | null) => ({
				id: `activity-${++count}`,
				tenantId: 'tenant-1',
				organizationId: 'org-1',
				employeeId: 'employee-1',
				timeSlotId: 'slot-1',
				date: '2026-11-11',
				title,
				duration: 60,
				type,
				metaData,
				deletedAt: null
			});
			await db('activity').insert([
				// The browser's own entry holds the page it showed
				activity(
					'Google Chrome',
					'APP',
					JSON.stringify({ title: 'Pull requests', url: PAGE, platform: 'macos' })
				),
				activity(
					'Google Chrome',
					'APP',
					JSON.stringify({ title: 'Pull requests', url: PAGE, platform: 'macos' })
				),
				// The site, recorded under its page's title
				activity(
					'Pull requests · ever-co/ever-teams',
					'URL',
					JSON.stringify({ title: 'Pull requests', url: PAGE })
				),
				activity(
					'Pull requests · ever-co/ever-teams',
					'URL',
					JSON.stringify({ title: 'Pull requests', url: PAGE })
				),
				activity('Figma', 'APP', null),
				// A site whose metadata holds no address, and one whose metadata is not JSON
				activity('example.net', 'URL', JSON.stringify({ title: 'Example' })),
				activity('docs.example.org', 'URL', 'not json')
			]);
		});

		afterAll(async () => {
			await db?.destroy();
		});

		beforeEach(() => {
			jest.spyOn(CrudService.prototype, 'ormType', 'get').mockReturnValue(MultiORMEnum.MikroORM);
			jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue('tenant-1');
			jest.spyOn(RequestContext, 'hasPermission').mockReturnValue(true);
		});

		afterEach(() => jest.restoreAllMocks());

		const report = async () => {
			const service = new ActivityService(
				{ metadata: { tableName: 'activity' } } as any,
				{ getKnex: () => db } as any,
				{ find: jest.fn(async () => []) } as any,
				{ find: jest.fn(async () => []) } as any,
				{} as any
			);
			const rows: any[] = await service[method]({
				organizationId: 'org-1',
				startDate: '2026-11-11',
				endDate: '2026-11-11'
			} as any);
			return new Map(rows.map((row) => [row.title, row]));
		};

		it('says whether each row is an app or a site, the grouping by title kept', async () => {
			const rows = await report();

			expect(rows.size).toBe(5);
			expect(rows.get('Google Chrome')?.type).toBe('APP');
			expect(Number(rows.get('Google Chrome')?.sessions)).toBe(2);
			expect(rows.get('Pull requests · ever-co/ever-teams')?.type).toBe('URL');
			expect(rows.get('Figma')?.type).toBe('APP');
		});

		it("gives a site its address, and an app none, even with the browser's page in its entry", async () => {
			const rows = await report();

			expect(rows.get('Pull requests · ever-co/ever-teams')?.url).toBe(PAGE);
			expect(rows.get('Google Chrome')?.url ?? null).toBeNull();
			expect(rows.get('Figma')?.url ?? null).toBeNull();
		});

		it('leaves the address out when the metadata holds none or is not JSON, without failing the report', async () => {
			const rows = await report();

			expect(rows.get('example.net')?.url ?? null).toBeNull();
			expect(rows.get('docs.example.org')?.url ?? null).toBeNull();
			expect(rows.get('docs.example.org')?.type).toBe('URL');
		});
	}
);
