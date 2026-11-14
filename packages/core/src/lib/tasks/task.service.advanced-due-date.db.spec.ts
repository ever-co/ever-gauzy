/**
 * The task list's advanced due-date filters (`filters[dueDateFrom]` / `filters[dueDateTo]`, what the Project Management
 * dashboard's "Overdue", "Due today" and "Due this week" send) on a real database: SQLite always, Postgres and MySQL
 * when `TASK_VIEWS_TEST_POSTGRES_URL` / `TASK_VIEWS_TEST_MYSQL_URL` point at a disposable database. Every read path is
 * run, and all must find the same tasks: the TypeORM `where` (`buildAdvancedWhereCondition`) as TypeORM runs it; the
 * same `where` translated for MikroORM (`convertTypeORMWhereToMikroORM`, what the base `paginate` behind
 * `/tasks/pagination` does under `DB_ORM=mikro-orm`); and the MikroORM employee query's own column filters
 * (`mikroOrmColumnFilters`). The rows are written by TypeORM, as the platform writes a `Date` column.
 *
 * A due date that is a date only is midnight UTC of its day. The dashboard sends each end of a range as the instant of
 * the reader's day and as the day itself: a date only must count on its own day for a reader in UTC−4 and in UTC+2,
 * and a caller that sends the instants alone gets what it got before.
 *
 * The process runs in UTC, as the API does: MikroORM's Postgres driver binds a date as UTC text and TypeORM's as the
 * process's local time, so on a `timestamp` column the two ORMs read each other's dates an offset apart anywhere else
 * (true of every date filter, not of these ones).
 */
import 'reflect-metadata';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInThisContext } from 'node:vm';
import { DataSource, EntitySchema } from 'typeorm';
import { EntitySchema as MikroEntitySchema, MikroORM } from '@mikro-orm/core';
import { MySqlDriver } from '@mikro-orm/mysql';
import { PostgreSqlDriver } from '@mikro-orm/postgresql';
import { ITaskAdvancedFilter } from '@gauzy/contracts';
import { TypeOrmCompatibleBetterSqliteDriver } from '@gauzy/config';
import { convertTypeORMWhereToMikroORM } from '../core/utils';
import { TaskService } from './task.service';

type Target = { name: 'better-sqlite3' | 'postgres' | 'mysql'; url?: string };

const TARGETS: Target[] = [
	{ name: 'better-sqlite3' },
	...(process.env['TASK_VIEWS_TEST_POSTGRES_URL'] ? [{ name: 'postgres' as const, url: process.env['TASK_VIEWS_TEST_POSTGRES_URL'] }] : []),
	...(process.env['TASK_VIEWS_TEST_MYSQL_URL'] ? [{ name: 'mysql' as const, url: process.env['TASK_VIEWS_TEST_MYSQL_URL'] }] : [])
];
const TABLE = 'task_advanced_due_date_spec';

interface IRow {
	id: string;
	tenantId: string;
	dueDate: Date | null;
}

/** The task table's columns the filter reads, as TypeORM maps a `Date` column. */
const TypeOrmRow = new EntitySchema<IRow>({
	name: 'AdvancedDueDateSpecTask',
	tableName: TABLE,
	columns: {
		id: { type: String, length: 36, primary: true },
		tenantId: { type: String, length: 36 },
		dueDate: { type: Date, nullable: true }
	}
});

/** The same table as MikroORM reads it. */
const MikroRow = new MikroEntitySchema<IRow>({
	name: 'AdvancedDueDateSpecTaskMikro',
	tableName: TABLE,
	properties: {
		id: { type: 'string', primary: true },
		tenantId: { type: 'string', fieldName: 'tenantId' },
		dueDate: { type: 'datetime', nullable: true, fieldName: 'dueDate' }
	}
});

const DAY = 86_400_000;
const dateOnly = (day: string) => new Date(`${day}T00:00:00.000Z`);

/** A reader `offset` minutes east of UTC: an instant of their wall clock, and the ends the dashboard sends. */
function reader(offset: number) {
	const local = (day: string, hours: number, minutes: number) => new Date(Date.parse(`${day}T00:00:00.000Z`) + (hours * 60 + minutes - offset) * 60_000);
	const startOf = (day: string) => local(day, 0, 0);
	const lastOf = (day: string) => new Date(startOf(day).getTime() + DAY - 1);
	return {
		local,
		// As `advancedFilters()` builds them, Wednesday 18 Nov: "Overdue", "Due today", "Due this week" (to Saturday).
		overdue: { dueDateTo: lastOf('2026-11-17'), dueDateToDay: '2026-11-17' } as ITaskAdvancedFilter,
		today: { dueDateFrom: startOf('2026-11-18'), dueDateFromDay: '2026-11-18', dueDateTo: lastOf('2026-11-18'), dueDateToDay: '2026-11-18' } as ITaskAdvancedFilter,
		week: { dueDateFrom: startOf('2026-11-18'), dueDateFromDay: '2026-11-18', dueDateTo: lastOf('2026-11-21'), dueDateToDay: '2026-11-21' } as ITaskAdvancedFilter
	};
}

/** Without the days: what a caller that sends the instants alone sends. */
function instantsOnly(filters: ITaskAdvancedFilter): ITaskAdvancedFilter {
	const older = { ...filters };
	delete older.dueDateFromDay;
	delete older.dueDateToDay;
	return older;
}

function rowsFor(at: ReturnType<typeof reader>): Array<Pick<IRow, 'id' | 'dueDate'> & { tenantId?: string }> {
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
		// Another tenant's task, due on every day asked for: the date conditions must never widen the tenant scope.
		{ id: 'theirs18', dueDate: dateOnly('2026-11-18'), tenantId: 'other' },
		{ id: 'theirs17', dueDate: dateOnly('2026-11-17'), tenantId: 'other' }
	];
}

const sorted = (...ids: string[]) => [...ids].sort();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service: any = Object.create(TaskService.prototype);

// Jest hands each file a copy of `process.env`: the zone is the host process's.
const host = runInThisContext('process') as NodeJS.Process;
let zoneBefore: string | undefined;
let machineZone: string;
beforeAll(() => {
	zoneBefore = host.env['TZ'];
	machineZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	host.env['TZ'] = 'UTC';
});
afterAll(() => {
	// Deleting `TZ` does not reset the clock's zone: set the one before first.
	host.env['TZ'] = zoneBefore ?? machineZone;
	if (zoneBefore === undefined) delete host.env['TZ'];
});

describe.each(TARGETS)('advanced due-date filters on $name', (target) => {
	let dataSource: DataSource;
	let orm: MikroORM;
	let folder: string | undefined;

	beforeAll(async () => {
		expect(new Date(2026, 10, 18).getTimezoneOffset()).toBe(0);
		if (target.name === 'better-sqlite3') folder = mkdtempSync(join(tmpdir(), 'gauzy-due-date-'));
		const file = folder ? join(folder, 'tasks.sqlite3') : undefined;
		dataSource = new DataSource({ type: target.name, ...(file ? { database: file } : { url: target.url }), entities: [TypeOrmRow] } as never);
		await dataSource.initialize();
		await dataSource.query(`DROP TABLE IF EXISTS ${target.name === 'mysql' ? `\`${TABLE}\`` : `"${TABLE}"`}`);
		await dataSource.synchronize();
		// MikroORM as the platform configures it for each database (`packages/config/src/lib/database.ts`).
		orm = await MikroORM.init(
			target.name === 'better-sqlite3'
				? { driver: TypeOrmCompatibleBetterSqliteDriver, dbName: file, forceUtcTimezone: true, entities: [MikroRow], allowGlobalContext: true }
				: ({ driver: target.name === 'postgres' ? PostgreSqlDriver : MySqlDriver, clientUrl: target.url, entities: [MikroRow], allowGlobalContext: true } as never)
		);
	});

	afterAll(async () => {
		await orm?.close(true);
		if (dataSource?.isInitialized) {
			await dataSource.query(`DROP TABLE IF EXISTS ${target.name === 'mysql' ? `\`${TABLE}\`` : `"${TABLE}"`}`);
			await dataSource.destroy();
		}
		if (folder) rmSync(folder, { recursive: true, force: true });
	});

	async function seed(at: ReturnType<typeof reader>): Promise<void> {
		const repository = dataSource.getRepository(TypeOrmRow);
		await repository.clear();
		await repository.insert(rowsFor(at).map((row) => ({ ...row, tenantId: row.tenantId ?? 'ten' })));
	}

	/** The ids each read path finds for the filters; all must agree. */
	async function found(filters: ITaskAdvancedFilter): Promise<string[]> {
		const where = { tenantId: 'ten', ...service.buildAdvancedWhereCondition(filters, {}) };
		const byTypeOrm = (await dataSource.getRepository(TypeOrmRow).find({ where })).map((row) => row.id).sort();
		const translated = convertTypeORMWhereToMikroORM(where as never);
		const byPaginate = (await orm.em.fork().find(MikroRow, translated as never)).map((row) => row.id).sort();
		const mikroWhere: Record<string, unknown> = { tenantId: 'ten' };
		Object.assign(mikroWhere, service.mikroOrmColumnFilters(filters, mikroWhere));
		const byEmployeeQuery = (await orm.em.fork().find(MikroRow, mikroWhere as never)).map((row) => row.id).sort();
		expect({ byPaginate, byEmployeeQuery }).toEqual({ byPaginate: byTypeOrm, byEmployeeQuery: byTypeOrm });
		return byTypeOrm;
	}

	for (const [label, offset] of [
		['UTC−4', -240],
		['UTC+2', 120]
	] as const) {
		describe(`for a reader in ${label}`, () => {
			const at = reader(offset);
			beforeEach(async () => seed(at));

			it('finds today’s date-only due date in "Due today" and not tomorrow’s, and yesterday’s in "Overdue"', async () => {
				expect(await found(at.today)).toEqual(sorted('only18', 'earlyOn18', 'lateOn18'));
				expect(await found(at.overdue)).toEqual(sorted('only17', 'lateOn17'));
			});

			it('holds both edges of "Due this week", today to Saturday', async () => {
				expect(await found(at.week)).toEqual(sorted('only18', 'only19', 'only21', 'earlyOn18', 'lateOn18', 'earlyOn19', 'lateOn21'));
			});

			it('leaves a caller that sends the instants alone where it was', async () => {
				const today = await found(instantsOnly(at.today));
				const overdue = await found(instantsOnly(at.overdue));
				if (offset < 0) {
					// West of UTC a date only lands a day early by the instants, as it always did for such a caller.
					expect(today).toEqual(sorted('only19', 'earlyOn18', 'lateOn18'));
					expect(overdue).toEqual(sorted('only17', 'only18', 'lateOn17'));
				} else {
					expect(today).toEqual(sorted('only18', 'earlyOn18', 'lateOn18'));
					expect(overdue).toEqual(sorted('only17', 'lateOn17'));
				}
			});
		});
	}
});
