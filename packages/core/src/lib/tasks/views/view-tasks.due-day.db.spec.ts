/**
 * A view's due-date filters on a real database: SQLite in memory always, Postgres and MySQL when
 * `TASK_VIEWS_TEST_POSTGRES_URL` / `TASK_VIEWS_TEST_MYSQL_URL` point at a disposable database. The rows are written the
 * way the platform writes a `Date` column, and the service builds and runs the query itself: only the task table is a
 * stand-in (the columns the filter reads, under the alias the service queries).
 *
 * A due date that is a date only is midnight UTC of its day (`2026-11-14T00:00:00.000Z`), what the integrations and
 * the bulk toolbar write. Picked days come as the filter editor sends them in the reader's zone: the instant of the
 * day's start (or the last instant, for the upper bound of "between") and the day itself. A date only must fall on its
 * own day for a reader in UTC−4 and in UTC+2; a due date with a time of day falls on the reader's day, as before.
 */
jest.mock('../../core/context', () => ({ RequestContext: { currentTenantId: () => 'ten', currentUserId: () => 'u1' } }));

import { DataSource, EntitySchema } from 'typeorm';
import { ITaskViewFilterCondition, ITaskViewFilterGroup } from '@gauzy/contracts';
import { Task } from '../task.entity';
import { TaskViewService } from './view.service';
import { TaskViewTasksService } from './view-tasks.service';

type Target = { name: 'better-sqlite3' | 'postgres' | 'mysql'; url?: string };

const TARGETS: Target[] = [
	{ name: 'better-sqlite3' },
	...(process.env['TASK_VIEWS_TEST_POSTGRES_URL'] ? [{ name: 'postgres' as const, url: process.env['TASK_VIEWS_TEST_POSTGRES_URL'] }] : []),
	...(process.env['TASK_VIEWS_TEST_MYSQL_URL'] ? [{ name: 'mysql' as const, url: process.env['TASK_VIEWS_TEST_MYSQL_URL'] }] : [])
];

interface ITaskRow {
	id: string;
	tenantId: string;
	organizationId: string;
	isScreeningTask: boolean;
	dueDate: Date | null;
	createdAt: Date;
}

/** The columns of `task` the filter, the page and the scope read; a `Date` column as the platform's `dueDate` is. */
const TaskRow = new EntitySchema<ITaskRow>({
	name: 'TaskViewDueDaySpecRow',
	tableName: 'task_view_due_day_spec',
	columns: {
		id: { type: String, length: 36, primary: true },
		tenantId: { type: String, length: 36 },
		organizationId: { type: String, length: 36 },
		isScreeningTask: { type: Boolean, default: false },
		dueDate: { type: Date, nullable: true },
		createdAt: { type: Date }
	}
});

const DAY = 86_400_000;
/** Midnight UTC of a day: a date-only due date. */
const dateOnly = (day: string) => new Date(`${day}T00:00:00.000Z`);

/** A reader in a zone `offset` minutes east of UTC, and what the filter editor sends for a day they pick. */
function reader(offset: number) {
	const local = (day: string, hours: number, minutes: number) => new Date(Date.parse(`${day}T00:00:00.000Z`) + (hours * 60 + minutes - offset) * 60_000);
	const startOf = (day: string) => local(day, 0, 0).toISOString();
	const lastOf = (day: string) => new Date(local(day, 0, 0).getTime() + DAY - 1).toISOString();
	return {
		local,
		after: (day: string): ITaskViewFilterCondition => ({ field: 'dueDate', operator: 'after', from: startOf(day), fromDay: day }),
		before: (day: string): ITaskViewFilterCondition => ({ field: 'dueDate', operator: 'before', to: startOf(day), toDay: day }),
		between: (first: string, last: string): ITaskViewFilterCondition => ({ field: 'dueDate', operator: 'between', from: startOf(first), fromDay: first, to: lastOf(last), toDay: last })
	};
}

/** Without the days: what a view saved before them holds. */
function withoutDays(condition: ITaskViewFilterCondition): ITaskViewFilterCondition {
	const older = { ...condition };
	delete older.fromDay;
	delete older.toDay;
	return older;
}

describe.each(TARGETS)('due-date filters of a view on $name', (target) => {
	let dataSource: DataSource;
	let service: TaskViewTasksService;

	beforeAll(async () => {
		dataSource = new DataSource({ type: target.name, ...(target.url ? { url: target.url } : { database: ':memory:' }), entities: [TaskRow] } as never);
		await dataSource.initialize();
		await dataSource.query(`DROP TABLE IF EXISTS ${target.name === 'mysql' ? '`task_view_due_day_spec`' : '"task_view_due_day_spec"'}`);
		await dataSource.synchronize();
		// The service reads `Task`; the stand-in answers for it.
		const tasks = { getRepository: (entity: unknown) => (entity === Task ? dataSource.getRepository(TaskRow) : dataSource.getRepository(entity as never)) } as unknown as DataSource;
		const views = { findOneByIdString: async () => ({ id: 'v1', organizationId: 'org' }) } as unknown as TaskViewService;
		service = new TaskViewTasksService(tasks, views);
		// Each page's rows are the ids the query found, in its order; the relations are not under test.
		jest.spyOn(service as unknown as { rowsOf: (ids: string[]) => Promise<unknown[]> }, 'rowsOf').mockImplementation(async (ids: string[]) => ids.map((id) => ({ id })));
	});

	afterAll(async () => {
		if (!dataSource?.isInitialized) return;
		await dataSource.query(`DROP TABLE IF EXISTS ${target.name === 'mysql' ? '`task_view_due_day_spec`' : '"task_view_due_day_spec"'}`);
		await dataSource.destroy();
	});

	/** Writes the tasks (replacing the ones before) and answers the ids a filter finds, sorted. */
	async function seed(rows: Record<string, Date | null>): Promise<void> {
		const repository = dataSource.getRepository(TaskRow);
		await repository.clear();
		await repository.insert(Object.entries(rows).map(([id, dueDate], index) => ({ id, tenantId: 'ten', organizationId: 'org', isScreeningTask: false, dueDate, createdAt: new Date(Date.UTC(2026, 9, 1) + index * 60_000) })));
	}
	async function found(...conditions: Array<ITaskViewFilterCondition | ITaskViewFilterGroup>): Promise<string[]> {
		const page = await service.tasksOf('v1', { filter: { op: 'and', conditions }, limit: 200 });
		expect(page.invalidFilters).toEqual([]);
		return page.items.map((task) => String(task.id)).sort();
	}
	const sorted = (...ids: string[]) => [...ids].sort();

	/** Date-only due dates, and due dates with a time of day just inside and outside the reader's 14th and 20th. */
	function rowsFor(at: ReturnType<typeof reader>): Record<string, Date | null> {
		return {
			only13: dateOnly('2026-11-13'),
			only14: dateOnly('2026-11-14'),
			only15: dateOnly('2026-11-15'),
			only20: dateOnly('2026-11-20'),
			only21: dateOnly('2026-11-21'),
			lateOn13: at.local('2026-11-13', 23, 59),
			earlyOn14: at.local('2026-11-14', 0, 1),
			lateOn20: at.local('2026-11-20', 23, 59),
			earlyOn21: at.local('2026-11-21', 0, 1),
			none: null
		};
	}

	for (const [zone, offset] of [
		['UTC−4', -240],
		['UTC+2', 120]
	] as const) {
		describe(`for a reader in ${zone}`, () => {
			const at = reader(offset);
			beforeEach(async () => seed(rowsFor(at)));

			it('finds each due date on its own day in "on or after 14 Nov" and "before 14 Nov"', async () => {
				expect(await found(at.after('2026-11-14'))).toEqual(sorted('only14', 'only15', 'only20', 'only21', 'earlyOn14', 'lateOn20', 'earlyOn21'));
				expect(await found(at.before('2026-11-14'))).toEqual(sorted('only13', 'lateOn13'));
			});

			it('holds both edges of "between 14 and 20 Nov"', async () => {
				expect(await found(at.between('2026-11-14', '2026-11-20'))).toEqual(sorted('only14', 'only15', 'only20', 'earlyOn14', 'lateOn20'));
				// One day, both edges on it.
				expect(await found(at.between('2026-11-14', '2026-11-14'))).toEqual(sorted('only14', 'earlyOn14'));
			});

			it('keeps the bounds apart when they are combined: "on or after 14" and "before 21", or "before 14" or "after 21"', async () => {
				expect(await found(at.after('2026-11-14'), at.before('2026-11-21'))).toEqual(sorted('only14', 'only15', 'only20', 'earlyOn14', 'lateOn20'));
				expect(await found({ op: 'or', conditions: [at.before('2026-11-14'), at.after('2026-11-21')] })).toEqual(sorted('only13', 'lateOn13', 'only21', 'earlyOn21'));
			});
		});
	}

	it('leaves a view saved without the days on its instants, as before (west of UTC a date only lands a day early)', async () => {
		const west = reader(-240);
		await seed(rowsFor(west));
		expect(await found(withoutDays(west.after('2026-11-14')))).toEqual(sorted('only15', 'only20', 'only21', 'earlyOn14', 'lateOn20', 'earlyOn21'));
		expect(await found(withoutDays(west.between('2026-11-14', '2026-11-20')))).toEqual(sorted('only15', 'only20', 'only21', 'earlyOn14', 'lateOn20'));
	});

	it('finds today\'s date-only due date, not tomorrow\'s, in "due today" west of UTC', async () => {
		const west = reader(-240);
		await seed(rowsFor(west));
		const page = await service.tasksOf(
			'v1',
			{ filter: { op: 'and', conditions: [{ field: 'dueDate', operator: 'relative', relative: { unit: 'day', direction: 'current' } }] }, timeZone: 'America/Caracas', limit: 200 },
			west.local('2026-11-14', 15, 0)
		);
		expect(page.items.map((task) => String(task.id)).sort()).toEqual(sorted('only14', 'earlyOn14'));
	});
});
