/**
 * The due-date and start-date filters that remained instant-only on a real database: `GET /tasks/filter-by-date` and
 * the GraphQL `tasksByDate` (both `TaskService.getTasksByDateFilters`), and a saved view's `queryParams.dueDates` and
 * `queryParams.startDates` (`TaskService.findTasksByViewQuery`). SQLite always; Postgres and MySQL when `TASK_VIEWS_TEST_POSTGRES_URL` /
 * `TASK_VIEWS_TEST_MYSQL_URL` point at a disposable database. The service builds and runs each query itself, under
 * TypeORM and under MikroORM (`DB_ORM=mikro-orm`); only the task table is a stand-in (the columns the reads use), and
 * the rows are written by TypeORM, as the platform writes a `Date` column.
 *
 * A due date that is a date only is midnight UTC of its day. A caller that picks calendar days sends each end of the
 * range as the instant of the reader's day and as the day itself (`dueDateFromDay` / `dueDateToDay`, the contract of
 * the advanced filters): a date only must count on its own day for a reader in UTC−4 and in UTC+2, whatever zone the
 * server runs in, and a caller that sends the instants alone keeps comparing instants. A start date that is a date only
 * (as Ever Teams writes a picked start day) is filtered the same way, with `startDateFromDay` / `startDateToDay`.
 *
 * The server zone: the TypeORM reads run with the process in UTC (as the API container runs) and in UTC−4. MikroORM's
 * reads run in UTC, and in UTC−4 on SQLite only: on Postgres and MySQL MikroORM binds a date as UTC text while TypeORM
 * wrote the rows in the process's local time, so off UTC the two ORMs read each other's dates an offset apart (true of
 * every date filter under `DB_ORM=mikro-orm` with TypeORM-written rows, not of these ones).
 */
jest.mock('../core/context', () => ({
	RequestContext: {
		currentTenantId: () => 'ten',
		currentUser: () => null,
		currentUserId: () => null
	}
}));
// `prepareSQLQuery` reads the dialect from the configuration: here it is the database each run is on.
let mockDialect = 'better-sqlite3';
jest.mock('@gauzy/config', () => ({ ...jest.requireActual('@gauzy/config'), isMySQL: () => mockDialect === 'mysql' }));

import 'reflect-metadata';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInThisContext } from 'node:vm';
import { BadRequestException } from '@nestjs/common';
import { DataSource, EntitySchema } from 'typeorm';
import { EntitySchema as MikroEntitySchema, MikroORM } from '@mikro-orm/core';
import { MySqlDriver } from '@mikro-orm/mysql';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { IGetTasksByViewFilters, ITaskDateFilterInput } from '@gauzy/contracts';
import { TypeOrmCompatibleBetterSqliteDriver } from '@gauzy/config';
import { MultiORMEnum } from '../core/utils';
import { TaskService } from './task.service';

type Target = { name: 'better-sqlite3' | 'postgres' | 'mysql'; url?: string };

const TARGETS: Target[] = [
	{ name: 'better-sqlite3' },
	...(process.env['TASK_VIEWS_TEST_POSTGRES_URL']
		? [{ name: 'postgres' as const, url: process.env['TASK_VIEWS_TEST_POSTGRES_URL'] }]
		: []),
	...(process.env['TASK_VIEWS_TEST_MYSQL_URL']
		? [{ name: 'mysql' as const, url: process.env['TASK_VIEWS_TEST_MYSQL_URL'] }]
		: [])
];
const TABLE = 'task_date_filters_spec';

interface IRow {
	id: string;
	tenantId: string;
	organizationId: string;
	isScreeningTask: boolean;
	startDate: Date | null;
	dueDate: Date | null;
}

/** The columns of `task` the reads use, as TypeORM maps a `Date` column. */
const TypeOrmRow = new EntitySchema<IRow>({
	name: 'TaskDateFiltersSpecTask',
	tableName: TABLE,
	columns: {
		id: { type: String, length: 36, primary: true },
		tenantId: { type: String, length: 36 },
		organizationId: { type: String, length: 36 },
		isScreeningTask: { type: Boolean, default: false },
		startDate: { type: Date, nullable: true },
		dueDate: { type: Date, nullable: true }
	}
});

/** The same table as MikroORM reads it. */
const MikroRow = new MikroEntitySchema<IRow>({
	name: 'TaskDateFiltersSpecTaskMikro',
	tableName: TABLE,
	properties: {
		id: { type: 'string', primary: true },
		tenantId: { type: 'string', fieldName: 'tenantId' },
		organizationId: { type: 'string', fieldName: 'organizationId' },
		isScreeningTask: { type: 'boolean', fieldName: 'isScreeningTask' },
		startDate: { type: 'datetime', nullable: true, fieldName: 'startDate' },
		dueDate: { type: 'datetime', nullable: true, fieldName: 'dueDate' }
	}
});

const DAY = 86_400_000;
const dateOnly = (day: string) => new Date(`${day}T00:00:00.000Z`);

/** A reader `offset` minutes east of UTC: an instant of their wall clock, and the ranges they pick (Wed 18 Nov). */
function reader(offset: number) {
	const local = (day: string, hours: number, minutes: number) =>
		new Date(Date.parse(`${day}T00:00:00.000Z`) + (hours * 60 + minutes - offset) * 60_000);
	const startOf = (day: string) => local(day, 0, 0);
	const lastOf = (day: string) => new Date(startOf(day).getTime() + DAY - 1);
	const range = (first: string | null, last: string | null) => ({
		...(first ? { dueDateFrom: startOf(first), dueDateFromDay: first } : {}),
		...(last ? { dueDateTo: lastOf(last), dueDateToDay: last } : {})
	});
	return {
		local,
		today: range('2026-11-18', '2026-11-18'),
		overdue: range(null, '2026-11-17'),
		fromTomorrow: range('2026-11-19', null),
		week: range('2026-11-18', '2026-11-21')
	};
}

type Range = ReturnType<typeof reader>['today'];

/** Without the days: what a caller that sends the instants alone sends. */
function instantsOnly(range: Range): Range {
	const older = { ...range };
	delete older.dueDateFromDay;
	delete older.dueDateToDay;
	return older;
}

function rowsFor(at: ReturnType<typeof reader>): Array<Pick<IRow, 'id' | 'dueDate'> & Partial<IRow>> {
	return [
		{ id: 'only17', dueDate: dateOnly('2026-11-17') },
		{ id: 'only18', dueDate: dateOnly('2026-11-18') },
		{ id: 'only19', dueDate: dateOnly('2026-11-19') },
		{ id: 'only21', dueDate: dateOnly('2026-11-21') },
		{ id: 'only22', dueDate: dateOnly('2026-11-22') },
		{ id: 'lateOn17', dueDate: at.local('2026-11-17', 23, 59) },
		{ id: 'earlyOn18', dueDate: at.local('2026-11-18', 0, 1) },
		{ id: 'lateOn18', dueDate: at.local('2026-11-18', 23, 59) },
		{ id: 'earlyOn19', dueDate: at.local('2026-11-19', 0, 1) },
		{ id: 'lateOn21', dueDate: at.local('2026-11-21', 23, 59) },
		{ id: 'earlyOn22', dueDate: at.local('2026-11-22', 0, 1) },
		{ id: 'undated', dueDate: null },
		// Due on a day asked for, but not the caller's to read here: another organization's, and a screening task.
		{ id: 'theirs18', dueDate: dateOnly('2026-11-18'), organizationId: 'other' },
		{ id: 'screening18', dueDate: dateOnly('2026-11-18'), isScreeningTask: true }
	];
}

/** The same range of days as a start-date range: what a caller filtering by start date sends. */
function asStart(range: Range): Partial<ITaskDateFilterInput> {
	return {
		...(range.dueDateFrom ? { startDateFrom: range.dueDateFrom } : {}),
		...(range.dueDateFromDay ? { startDateFromDay: range.dueDateFromDay } : {}),
		...(range.dueDateTo ? { startDateTo: range.dueDateTo } : {}),
		...(range.dueDateToDay ? { startDateToDay: range.dueDateToDay } : {})
	};
}

const sorted = (...ids: string[]) => [...ids].sort();

// Jest hands each file a copy of `process.env`: the zone is the host process's.
const host = runInThisContext('process') as NodeJS.Process;
let zoneBefore: string | undefined;
let machineZone: string;
beforeAll(() => {
	zoneBefore = host.env['TZ'];
	machineZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
});
afterAll(() => {
	// Deleting `TZ` does not reset the clock's zone: set the one before first.
	host.env['TZ'] = zoneBefore ?? machineZone;
	if (zoneBefore === undefined) delete host.env['TZ'];
});

describe.each(TARGETS)('the remaining due-date filters on $name', (target) => {
	let dataSource: DataSource;
	let orm: MikroORM;
	let folder: string | undefined;
	let queryParams: IGetTasksByViewFilters;
	const quoted = target.name === 'mysql' ? `\`${TABLE}\`` : `"${TABLE}"`;

	/** The service as the platform builds it, reading the stand-in table under the ORM asked for. */
	function serviceOn(ormType: MultiORMEnum): TaskService {
		const service = Object.create(TaskService.prototype) as TaskService;
		Object.defineProperty(service, 'ormType', { value: ormType });
		Object.assign(service, {
			typeOrmRepository: dataSource.getRepository(TypeOrmRow),
			mikroOrmRepository: orm.em.fork().getRepository(MikroRow),
			_taskViewService: {
				findOneByWhereOptions: async () => ({ id: 'view', organizationId: 'org', queryParams })
			},
			assertRelationsPermitted: () => undefined,
			assertCallerColumnsPermitted: () => undefined
		});
		return service;
	}

	beforeAll(async () => {
		mockDialect = target.name;
		if (target.name === 'better-sqlite3') folder = mkdtempSync(join(tmpdir(), 'gauzy-date-filters-'));
		const file = folder ? join(folder, 'tasks.sqlite3') : undefined;
		dataSource = new DataSource({
			type: target.name,
			...(file ? { database: file } : { url: target.url }),
			entities: [TypeOrmRow]
		} as never);
		await dataSource.initialize();
		await dataSource.query(`DROP TABLE IF EXISTS ${quoted}`);
		await dataSource.synchronize();
		// MikroORM as the platform configures it for each database (`packages/config/src/lib/database.ts`).
		orm = await MikroORM.init(
			target.name === 'better-sqlite3'
				? {
						driver: TypeOrmCompatibleBetterSqliteDriver,
						dbName: file,
						forceUtcTimezone: true,
						entities: [MikroRow],
						allowGlobalContext: true
					}
				: ({
						driver: target.name === 'postgres' ? PostgreSqlDriver : MySqlDriver,
						clientUrl: target.url,
						entities: [MikroRow],
						allowGlobalContext: true
					} as never)
		);
	});

	afterAll(async () => {
		await orm?.close(true);
		if (dataSource?.isInitialized) {
			await dataSource.query(`DROP TABLE IF EXISTS ${quoted}`);
			await dataSource.destroy();
		}
		if (folder) rmSync(folder, { recursive: true, force: true });
	});

	async function seed(at: ReturnType<typeof reader>, startDate: Date | null = null): Promise<void> {
		const repository = dataSource.getRepository(TypeOrmRow);
		await repository.clear();
		await repository.insert(
			rowsFor(at).map((row) => ({
				tenantId: 'ten',
				organizationId: 'org',
				isScreeningTask: false,
				startDate,
				...row
			}))
		);
	}

	/** The same rows with those dates as their start dates, and one due date for all (none by default). */
	async function seedStarts(at: ReturnType<typeof reader>, dueDate: Date | null = null): Promise<void> {
		const repository = dataSource.getRepository(TypeOrmRow);
		await repository.clear();
		await repository.insert(
			rowsFor(at).map(({ dueDate: date, ...row }) => ({
				tenantId: 'ten',
				organizationId: 'org',
				isScreeningTask: false,
				...row,
				startDate: date,
				dueDate
			}))
		);
	}

	/** The ids `filter-by-date` / `tasksByDate` answer, under each ORM asked for; all must agree. */
	async function byDate(input: Partial<ITaskDateFilterInput>, orms: MultiORMEnum[]): Promise<string[]> {
		const answers = await Promise.all(
			orms.map(async (ormType) => {
				const page = await serviceOn(ormType).getTasksByDateFilters({
					organizationId: 'org',
					...input
				} as ITaskDateFilterInput);
				expect(page.total).toBe(page.items.length);
				return page.items.map((task) => String(task.id)).sort();
			})
		);
		answers.forEach((answer) => expect(answer).toEqual(answers[0]));
		return answers[0];
	}

	/** The ids a saved view whose `queryParams` hold `dueDates` lists, under each ORM asked for; all must agree. */
	async function byView(params: IGetTasksByViewFilters, orms: MultiORMEnum[]): Promise<string[]> {
		queryParams = params;
		const answers = await Promise.all(
			orms.map(async (ormType) => {
				const page = await serviceOn(ormType).findTasksByViewQuery('view');
				return page.items.map((task) => String(task.id)).sort();
			})
		);
		answers.forEach((answer) => expect(answer).toEqual(answers[0]));
		return answers[0];
	}

	/** A view's `dueDates` as a client writes a range of days into it: the two ends, and their days when it sends them. */
	const viewOf = (range: Range, withDays = true): IGetTasksByViewFilters => ({
		dueDates: [range.dueDateFrom, range.dueDateTo]
			.filter((end): end is Date => !!end)
			.map((end) => end.toISOString()) as unknown as Date[],
		...(withDays ? { dueDateFromDay: range.dueDateFromDay, dueDateToDay: range.dueDateToDay } : {})
	});

	/** A view's `startDates` as a client writes a range of days into it: the two ends, and their days when it sends them. */
	const startViewOf = (range: Range, withDays = true): IGetTasksByViewFilters => ({
		startDates: [range.dueDateFrom, range.dueDateTo]
			.filter((end): end is Date => !!end)
			.map((end) => end.toISOString()) as unknown as Date[],
		...(withDays ? { startDateFromDay: range.dueDateFromDay, startDateToDay: range.dueDateToDay } : {})
	});

	// The zone, and how many minutes it runs behind UTC (`getTimezoneOffset`).
	for (const [serverZone, minutesBehind] of [
		['UTC', 0],
		['America/Caracas', 240]
	] as const) {
		describe(`with the server in ${serverZone}`, () => {
			const orms =
				serverZone === 'UTC' || target.name === 'better-sqlite3'
					? [MultiORMEnum.TypeORM, MultiORMEnum.MikroORM]
					: [MultiORMEnum.TypeORM];

			beforeAll(() => {
				host.env['TZ'] = serverZone;
				expect(new Date(2026, 10, 18).getTimezoneOffset()).toBe(minutesBehind);
			});

			for (const [label, offset] of [
				['UTC−4', -240],
				['UTC+2', 120]
			] as const) {
				describe(`for a reader in ${label}`, () => {
					const at = reader(offset);
					beforeEach(async () => seed(at));

					it('finds today’s date-only due date in "due today" and not tomorrow’s, and yesterday’s before today', async () => {
						expect(await byDate(at.today, orms)).toEqual(sorted('only18', 'earlyOn18', 'lateOn18'));
						expect(await byDate(at.overdue, orms)).toEqual(sorted('only17', 'lateOn17'));
						expect(await byDate(at.fromTomorrow, orms)).toEqual(
							sorted('only19', 'only21', 'only22', 'earlyOn19', 'lateOn21', 'earlyOn22')
						);
					});

					it('holds both edges of a range of days, today to Saturday', async () => {
						expect(await byDate(at.week, orms)).toEqual(
							sorted('only18', 'only19', 'only21', 'earlyOn18', 'lateOn18', 'earlyOn19', 'lateOn21')
						);
					});

					it('compares the instants for a caller that sends them alone', async () => {
						const today = await byDate(instantsOnly(at.today), orms);
						if (offset < 0) {
							// West of UTC a date only lands a day early by the instants, as it always did for such a caller.
							expect(today).toEqual(sorted('only19', 'earlyOn18', 'lateOn18'));
						} else {
							expect(today).toEqual(sorted('only18', 'earlyOn18', 'lateOn18'));
						}
					});

					it('lists a view’s due dates on their own days when it stores the days of its ends, and by the instants when not', async () => {
						expect(await byView(viewOf(at.today), orms)).toEqual(
							sorted('only18', 'earlyOn18', 'lateOn18', 'screening18')
						);
						expect(await byView(viewOf(at.week), orms)).toEqual(
							sorted(
								'only18',
								'only19',
								'only21',
								'earlyOn18',
								'lateOn18',
								'earlyOn19',
								'lateOn21',
								'screening18'
							)
						);
						const byInstants = await byView(viewOf(at.today, false), orms);
						expect(byInstants).toEqual(
							offset < 0
								? sorted('only19', 'earlyOn18', 'lateOn18')
								: sorted('only18', 'earlyOn18', 'lateOn18', 'screening18')
						);
					});
				});

				describe(`by start date, for a reader in ${label}`, () => {
					const at = reader(offset);
					beforeEach(async () => seedStarts(at));

					it('finds today’s date-only start date in "starts today" and not tomorrow’s, and yesterday’s before today', async () => {
						expect(await byDate(asStart(at.today), orms)).toEqual(
							sorted('only18', 'earlyOn18', 'lateOn18')
						);
						expect(await byDate(asStart(at.overdue), orms)).toEqual(sorted('only17', 'lateOn17'));
						expect(await byDate(asStart(at.fromTomorrow), orms)).toEqual(
							sorted('only19', 'only21', 'only22', 'earlyOn19', 'lateOn21', 'earlyOn22')
						);
					});

					it('holds both edges of a range of start days, today to Saturday', async () => {
						expect(await byDate(asStart(at.week), orms)).toEqual(
							sorted('only18', 'only19', 'only21', 'earlyOn18', 'lateOn18', 'earlyOn19', 'lateOn21')
						);
					});

					it('compares the start instants for a caller that sends them alone', async () => {
						const today = await byDate(asStart(instantsOnly(at.today)), orms);
						// West of UTC a date only lands a day early by the instants, as it always did for such a caller.
						expect(today).toEqual(
							offset < 0
								? sorted('only19', 'earlyOn18', 'lateOn18')
								: sorted('only18', 'earlyOn18', 'lateOn18')
						);
					});

					it('lists a view’s start dates on their own days when it stores the days of its ends, and by the instants when not', async () => {
						expect(await byView(startViewOf(at.today), orms)).toEqual(
							sorted('only18', 'earlyOn18', 'lateOn18', 'screening18')
						);
						expect(await byView(startViewOf(at.week), orms)).toEqual(
							sorted(
								'only18',
								'only19',
								'only21',
								'earlyOn18',
								'lateOn18',
								'earlyOn19',
								'lateOn21',
								'screening18'
							)
						);
						expect(await byView(startViewOf(at.today, false), orms)).toEqual(
							offset < 0
								? sorted('only19', 'earlyOn18', 'lateOn18')
								: sorted('only18', 'earlyOn18', 'lateOn18', 'screening18')
						);
					});
				});
			}

			it('refuses a due-date range that ends before it starts, under either ORM', async () => {
				const west = reader(-240);
				await seed(west);
				for (const ormType of orms) {
					await expect(
						serviceOn(ormType).getTasksByDateFilters({
							organizationId: 'org',
							dueDateFrom: west.today.dueDateTo,
							dueDateTo: west.today.dueDateFrom
						} as ITaskDateFilterInput)
					).rejects.toBeInstanceOf(BadRequestException);
				}
			});

			it('refuses a start-date range that ends before it starts, under either ORM', async () => {
				const west = reader(-240);
				await seedStarts(west);
				for (const ormType of orms) {
					await expect(
						serviceOn(ormType).getTasksByDateFilters({
							organizationId: 'org',
							startDateFrom: west.today.dueDateTo,
							startDateTo: west.today.dueDateFrom
						} as ITaskDateFilterInput)
					).rejects.toBeInstanceOf(BadRequestException);
				}
			});

			it('compares a range of start days and a range of due days each with its own column', async () => {
				const west = reader(-240);
				await seedStarts(west, dateOnly('2026-11-18'));
				expect(await byDate({ ...asStart(west.today), ...west.today }, orms)).toEqual(
					sorted('only18', 'earlyOn18', 'lateOn18')
				);
				expect(await byDate({ ...asStart(west.today), ...west.fromTomorrow }, orms)).toEqual([]);
				expect(await byDate({ ...asStart(west.fromTomorrow), ...west.today }, orms)).toEqual(
					sorted('only19', 'only21', 'only22', 'earlyOn19', 'lateOn21', 'earlyOn22')
				);
			});

			it('keeps a start-date window of its own next to a due-date window', async () => {
				const west = reader(-240);
				await seed(west, west.local('2026-11-10', 12, 0));
				const startWindow = {
					startDateFrom: new Date('2026-11-01T00:00:00.000Z'),
					startDateTo: new Date('2026-11-30T23:59:59.999Z')
				};
				expect(await byDate({ ...startWindow, ...west.today }, orms)).toEqual(
					sorted('only18', 'earlyOn18', 'lateOn18')
				);
				expect(await byDate({ ...startWindow, ...instantsOnly(west.today) }, orms)).toEqual(
					sorted('only19', 'earlyOn18', 'lateOn18')
				);
			});
		});
	}
});
