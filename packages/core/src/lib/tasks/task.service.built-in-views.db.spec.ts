/**
 * The built-in views ("Overdue", "Due soon", "This week", "Mine") on a real database: SQLite in memory always, Postgres
 * (in a schema of its own) and MySQL when `TASK_VIEWS_TEST_POSTGRES_URL` / `TASK_VIEWS_TEST_MYSQL_URL` point at a
 * disposable database. `TaskService.findBuiltInView` builds and runs the page's query itself; only the task table is a
 * stand-in (the columns the view reads, under the alias the service queries), next to the `task_employee` join table
 * the membership subquery reads, and the rows of the page are the ids the query found.
 *
 * A due date that is a date only is midnight UTC of its day (`2026-11-18T00:00:00.000Z`), what the integrations and
 * the bulk toolbar write. It must count on its own day for a reader in UTC−4 and in UTC+2: due today is not overdue and
 * is due soon; a due date with a time of day counts on the reader's day, as before. "Today" is the reader's day in the
 * time zone the request names, as the clients send it.
 */
jest.mock('../core/context', () => ({
	RequestContext: {
		currentUser: () => ({ id: 'u1', employeeId: 'me' }),
		currentEmployeeId: () => 'me',
		currentTenantId: () => 'ten'
	}
}));

import { DataSource, EntitySchema } from 'typeorm';
import { TaskBuiltInViewEnum, TaskStatusEnum } from '@gauzy/contracts';
import { TaskService } from './task.service';

type Target = { name: 'better-sqlite3' | 'postgres' | 'mysql'; url?: string };

const TARGETS: Target[] = [
	{ name: 'better-sqlite3' },
	...(process.env['TASK_VIEWS_TEST_POSTGRES_URL'] ? [{ name: 'postgres' as const, url: process.env['TASK_VIEWS_TEST_POSTGRES_URL'] }] : []),
	...(process.env['TASK_VIEWS_TEST_MYSQL_URL'] ? [{ name: 'mysql' as const, url: process.env['TASK_VIEWS_TEST_MYSQL_URL'] }] : [])
];
const PG_SCHEMA = 'task_built_in_views_spec';
const TASKS = 'task_built_in_views_spec';

interface ITaskRow {
	id: string;
	tenantId: string;
	organizationId: string;
	isScreeningTask: boolean;
	status: string | null;
	dueDate: Date | null;
	createdAt: Date;
}

/** The columns of `task` a built-in view reads; a `Date` column as the platform's `dueDate` is. */
const TaskRow = new EntitySchema<ITaskRow>({
	name: 'BuiltInViewSpecTask',
	tableName: TASKS,
	columns: {
		id: { type: String, length: 36, primary: true },
		tenantId: { type: String, length: 36 },
		organizationId: { type: String, length: 36 },
		isScreeningTask: { type: Boolean, default: false },
		status: { type: String, length: 32, nullable: true },
		dueDate: { type: Date, nullable: true },
		createdAt: { type: Date }
	}
});

/** Who a task is assigned to, as the membership subquery reads it. */
const TaskEmployee = new EntitySchema<{ taskId: string; employeeId: string }>({
	name: 'BuiltInViewSpecTaskEmployee',
	tableName: 'task_employee',
	columns: {
		taskId: { type: String, length: 36, primary: true },
		employeeId: { type: String, length: 36, primary: true }
	}
});

/** Midnight UTC of a day: a date-only due date. */
const dateOnly = (day: string) => new Date(`${day}T00:00:00.000Z`);

/** A reader in a zone `offset` minutes east of UTC: an instant of their wall clock. */
const at = (offset: number) => (day: string, hours: number, minutes: number) =>
	new Date(Date.parse(`${day}T00:00:00.000Z`) + (hours * 60 + minutes - offset) * 60_000);

/**
 * Tasks around a Wednesday, 18 Nov 2026: the week runs Monday 16 to Sunday 22, "due soon" from the 18th to the 25th.
 * Date-only due dates on each edge, and due dates with a time of day just inside and outside each edge of the reader's
 * days; one done task, one assigned to somebody else, and one with no due date.
 */
function rowsFor(local: ReturnType<typeof at>): Array<Pick<ITaskRow, 'id' | 'dueDate'> & { status?: string; mine?: boolean }> {
	return [
		{ id: 'only15', dueDate: dateOnly('2026-11-15') },
		{ id: 'only16', dueDate: dateOnly('2026-11-16') },
		{ id: 'only17', dueDate: dateOnly('2026-11-17') },
		{ id: 'only18', dueDate: dateOnly('2026-11-18') },
		{ id: 'only22', dueDate: dateOnly('2026-11-22') },
		{ id: 'only23', dueDate: dateOnly('2026-11-23') },
		{ id: 'only25', dueDate: dateOnly('2026-11-25') },
		{ id: 'only26', dueDate: dateOnly('2026-11-26') },
		{ id: 'lateOn15', dueDate: local('2026-11-15', 23, 59) },
		{ id: 'earlyOn16', dueDate: local('2026-11-16', 0, 1) },
		{ id: 'lateOn17', dueDate: local('2026-11-17', 23, 59) },
		{ id: 'earlyOn18', dueDate: local('2026-11-18', 0, 1) },
		{ id: 'lateOn22', dueDate: local('2026-11-22', 23, 59) },
		{ id: 'earlyOn23', dueDate: local('2026-11-23', 0, 1) },
		{ id: 'lateOn25', dueDate: local('2026-11-25', 23, 59) },
		{ id: 'earlyOn26', dueDate: local('2026-11-26', 0, 1) },
		{ id: 'doneOn17', dueDate: dateOnly('2026-11-17'), status: TaskStatusEnum.DONE },
		{ id: 'theirsOn17', dueDate: dateOnly('2026-11-17'), mine: false },
		{ id: 'undated', dueDate: null }
	];
}

const sorted = (...ids: string[]) => [...ids].sort();

describe.each(TARGETS)('built-in views on $name', (target) => {
	let dataSource: DataSource;
	let service: TaskService;

	beforeAll(async () => {
		if (target.name === 'postgres') {
			const setup = new DataSource({ type: 'postgres', url: target.url } as never);
			await setup.initialize();
			await setup.query(`DROP SCHEMA IF EXISTS "${PG_SCHEMA}" CASCADE`);
			await setup.query(`CREATE SCHEMA "${PG_SCHEMA}"`);
			await setup.destroy();
		}
		const options =
			target.name === 'better-sqlite3'
				? { type: target.name, database: ':memory:' }
				: target.name === 'postgres'
					? { type: target.name, url: target.url, schema: PG_SCHEMA, extra: { options: `-c search_path=${PG_SCHEMA}` } }
					: { type: target.name, url: target.url };
		dataSource = new DataSource({ ...options, entities: [TaskRow, TaskEmployee] } as never);
		await dataSource.initialize();
		if (target.name === 'mysql') {
			await dataSource.query(`DROP TABLE IF EXISTS \`${TASKS}\`, \`task_employee\``);
		}
		await dataSource.synchronize();
		const tasks = dataSource.getRepository(TaskRow);
		// The service as the platform builds it, with the task repository it queries; the rows of a page are the ids.
		service = Object.create(TaskService.prototype) as TaskService;
		Object.assign(service, {
			typeOrmRepository: {
				createQueryBuilder: (alias: string) => tasks.createQueryBuilder(alias),
				find: async (options: { where: { id: { value: string[] } } }) => options.where.id.value.map((id) => ({ id }))
			},
			assertRelationsPermitted: () => undefined
		});
	});

	afterAll(async () => {
		if (!dataSource?.isInitialized) return;
		if (target.name === 'postgres') await dataSource.query(`DROP SCHEMA IF EXISTS "${PG_SCHEMA}" CASCADE`);
		else await dataSource.query(target.name === 'mysql' ? `DROP TABLE IF EXISTS \`${TASKS}\`, \`task_employee\`` : `DROP TABLE IF EXISTS "${TASKS}"`);
		await dataSource.destroy();
	});

	afterEach(() => jest.useRealTimers());

	async function seed(local: ReturnType<typeof at>): Promise<void> {
		const rows = rowsFor(local);
		await dataSource.getRepository(TaskEmployee).clear();
		await dataSource.getRepository(TaskRow).clear();
		await dataSource.getRepository(TaskRow).insert(
			rows.map((row, index) => ({
				id: row.id,
				tenantId: 'ten',
				organizationId: 'org',
				isScreeningTask: false,
				status: row.status ?? TaskStatusEnum.OPEN,
				dueDate: row.dueDate,
				createdAt: new Date(Date.UTC(2026, 9, 1) + index * 60_000)
			}))
		);
		await dataSource.getRepository(TaskEmployee).insert(rows.map((row) => ({ taskId: row.id, employeeId: row.mine === false ? 'them' : 'me' })));
	}

	/** The ids a built-in view lists at `now` for a reader in `timeZone` (none: the request names no zone). */
	async function listed(key: TaskBuiltInViewEnum, now: Date, timeZone: string | undefined): Promise<string[]> {
		// Only the clock is fixed: the database drivers keep their real timers.
		jest.useFakeTimers({ now, doNotFake: ['nextTick', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout', 'queueMicrotask', 'hrtime', 'performance'] });
		const page = await service.findBuiltInView(key, { tenantId: 'ten', organizationId: 'org', ...(timeZone ? { timeZone } : {}), take: 200 } as never);
		jest.useRealTimers();
		expect(page.total).toBe(page.items.length);
		return page.items.map((task) => String(task.id)).sort();
	}

	// A request that names no zone is read in UTC (not the server's zone): its reader's day is UTC's.
	for (const [label, zone, offset] of [
		['UTC−4', 'America/Caracas', -240],
		['UTC+2', 'Africa/Johannesburg', 120],
		['UTC, the request naming no zone', undefined, 0]
	] as const) {
		describe(`for a reader in ${label}`, () => {
			const local = at(offset);
			// Wednesday 18 Nov, 15:00 on the reader's clock.
			const now = local('2026-11-18', 15, 0);
			beforeEach(async () => seed(local));

			it('lists a task due today as due soon, not overdue, and a task due yesterday as overdue', async () => {
				expect(await listed(TaskBuiltInViewEnum.OVERDUE, now, zone)).toEqual(sorted('only15', 'only16', 'only17', 'lateOn15', 'earlyOn16', 'lateOn17'));
				expect(await listed(TaskBuiltInViewEnum.DUE_SOON, now, zone)).toEqual(sorted('only18', 'only22', 'only23', 'only25', 'earlyOn18', 'lateOn22', 'earlyOn23', 'lateOn25'));
			});

			it('holds both edges of this week, Monday to Sunday, done tasks included', async () => {
				expect(await listed(TaskBuiltInViewEnum.THIS_WEEK, now, zone)).toEqual(sorted('only16', 'only17', 'only18', 'only22', 'earlyOn16', 'lateOn17', 'earlyOn18', 'lateOn22', 'doneOn17'));
			});

			it('lists every task of mine, dated or not, in "Mine"', async () => {
				const mine = rowsFor(local)
					.filter((row) => row.mine !== false)
					.map((row) => row.id);
				expect(await listed(TaskBuiltInViewEnum.MINE, now, zone)).toEqual(sorted(...mine));
			});
		});
	}
});
