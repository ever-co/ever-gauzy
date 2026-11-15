import '../core/entities/internal';

import { DataSource, DataSourceOptions } from 'typeorm';
import { isPostgres } from '@gauzy/config';
import { TimeLogSourceEnum } from '@gauzy/contracts';
import { coreEntities } from '../core/entities';
import { TimeLog } from '../core/entities/internal';
import { isUniqueViolation } from '../core/errors/unique-violation';
import { AddTimeLogOneRunningTimerPerEmployee1791000018700 } from './migrations/1791000018700-AddTimeLogOneRunningTimerPerEmployee';

/**
 * `1791000018700-AddTimeLogOneRunningTimerPerEmployee` on a real SQLite database whose schema the entities build: one
 * running timer run per employee, the desktop's running uploads left out (ever-co/ever-gauzy#11826). Rows that already
 * break the key are stopped first, the latest run kept.
 */

const TIMEOUT = 15 * 60 * 1000;
const INDEX = 'UQ_time_log_running_timer_employee';
const EMPLOYEE = '11826000-0000-4000-8000-0000000000e1';
const OTHER_EMPLOYEE = '11826000-0000-4000-8000-0000000000e2';

/** A value for a NOT NULL column without a default that a row leaves out. */
function placeholder(type: unknown): unknown {
	const name = typeof type === 'function' ? type.name.toLowerCase() : String(type).toLowerCase();
	if (/uuid/.test(name)) return '11826000-0000-4000-8000-0000000000ff';
	if (/int|number|numeric|decimal|real|float|double/.test(name)) return 0;
	if (/bool/.test(name)) return false;
	if (/date|time/.test(name)) return new Date('2026-01-01T00:00:00Z');
	if (/json/.test(name)) return {};
	return 'x';
}

(isPostgres() ? describe.skip : describe)('AddTimeLogOneRunningTimerPerEmployee1791000018700 on SQLite', () => {
	let dataSource: DataSource;
	let next = 0;
	const migration = new AddTimeLogOneRunningTimerPerEmployee1791000018700();

	const runMigration = async (step: 'up' | 'down') => {
		const queryRunner = dataSource.createQueryRunner();
		try {
			await migration[step](queryRunner);
		} finally {
			await queryRunner.release();
		}
	};

	/** Writes a time log, with a placeholder in every other NOT NULL column without a default; its id. */
	const insertLog = async (row: Partial<TimeLog>): Promise<string> => {
		const id = `11826000-0000-4000-8000-${String(++next).padStart(12, '0')}`;
		const values: Record<string, unknown> = { id, ...row };
		for (const column of dataSource.getMetadata(TimeLog).columns) {
			const needsNoValue =
				column.isNullable ||
				column.default !== undefined ||
				column.isGenerated ||
				column.isCreateDate ||
				column.isUpdateDate ||
				column.isVirtual;
			if (column.propertyName in values || needsNoValue) continue;
			values[column.propertyName] = placeholder(column.type);
		}
		await dataSource.createQueryBuilder().insert().into(TimeLog).values(values).execute();
		return id;
	};

	const runOf = (employeeId: string, source: TimeLogSourceEnum, startedAt: string) =>
		insertLog({
			employeeId,
			source,
			isRunning: true,
			startedAt: new Date(startedAt),
			stoppedAt: new Date(startedAt)
		});

	/** The error a write raised, or undefined. */
	const failureOf = (write: Promise<unknown>) =>
		write.then(
			() => undefined,
			(error: unknown) => error
		);

	const isRunning = async (id: string) =>
		Boolean((await dataSource.getRepository(TimeLog).findOne({ where: { id }, withDeleted: true })).isRunning);

	/** Where a log ends, as stored. */
	const endOf = async (id: string) =>
		new Date(
			(await dataSource.getRepository(TimeLog).findOne({ where: { id }, withDeleted: true })).stoppedAt
		).toISOString();

	const hasIndex = async () =>
		(await dataSource.query(`SELECT name FROM sqlite_master WHERE type = 'index' AND name = '${INDEX}'`)).length >
		0;

	beforeAll(async () => {
		dataSource = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: coreEntities,
			synchronize: true,
			logging: false
		} as DataSourceOptions);
		await dataSource.initialize();
		// The rows written here name no employee, tenant or timesheet that exists
		await dataSource.query('PRAGMA foreign_keys = OFF');
		// The schema as before the migration
		await dataSource.query(`DROP INDEX IF EXISTS "${INDEX}"`);
	}, TIMEOUT);

	afterAll(async () => {
		await dataSource?.destroy();
	});

	beforeEach(() => jest.spyOn(console, 'log').mockImplementation(() => undefined));
	afterEach(() => jest.restoreAllMocks());

	it(
		"stops an employee's older timer runs where a start replacing them would, keeps the latest and the desktop's uploads",
		async () => {
			// A web timer, which sends no heartbeat, and an Ever Teams run that had none
			const webOld = await runOf(EMPLOYEE, TimeLogSourceEnum.WEB_TIMER, '2026-11-15T07:30:00Z');
			const older = await runOf(EMPLOYEE, TimeLogSourceEnum.TEAMS, '2026-11-15T08:00:00Z');
			const latest = await runOf(EMPLOYEE, TimeLogSourceEnum.WEB_TIMER, '2026-11-15T09:00:00Z');
			const upload = await runOf(EMPLOYEE, TimeLogSourceEnum.DESKTOP, '2026-11-15T07:00:00Z');
			const otherEmployeeRun = await runOf(OTHER_EMPLOYEE, TimeLogSourceEnum.MOBILE, '2026-11-15T06:00:00Z');

			await runMigration('up');
			// Running it again changes nothing
			await runMigration('up');

			expect(await hasIndex()).toBe(true);
			expect(await isRunning(older)).toBe(false);
			expect(await isRunning(webOld)).toBe(false);
			// The web timer ends where the next run started; the Ever Teams run, which posts a heartbeat each minute, at its
			// last one, its start (`TimerService.replacedRunEnd`)
			expect(await endOf(webOld)).toBe('2026-11-15T08:00:00.000Z');
			expect(await endOf(older)).toBe('2026-11-15T08:00:00.000Z');
			expect(await isRunning(latest)).toBe(true);
			expect(await isRunning(upload)).toBe(true);
			expect(await isRunning(otherEmployeeRun)).toBe(true);
		},
		TIMEOUT
	);

	it(
		"refuses a second running timer run of an employee, and lets the desktop's running uploads through",
		async () => {
			const second = await failureOf(runOf(EMPLOYEE, TimeLogSourceEnum.MOBILE, '2026-11-15T10:00:00Z'));
			expect(
				isUniqueViolation(second) || isUniqueViolation((second as { driverError?: unknown })?.driverError)
			).toBe(true);

			await runOf(EMPLOYEE, TimeLogSourceEnum.DESKTOP, '2026-11-15T10:00:00Z');
			await runOf(EMPLOYEE, TimeLogSourceEnum.DESKTOP, '2026-11-15T11:00:00Z');
			// A stopped run, and a deleted running one, are no running runs
			await insertLog({
				employeeId: EMPLOYEE,
				source: TimeLogSourceEnum.TEAMS,
				isRunning: false,
				startedAt: new Date()
			});
			await insertLog({
				employeeId: EMPLOYEE,
				source: TimeLogSourceEnum.TEAMS,
				isRunning: true,
				startedAt: new Date(),
				deletedAt: new Date()
			});
		},
		TIMEOUT
	);

	it(
		'drops the key on down, and builds it again on up',
		async () => {
			await runMigration('down');
			expect(await hasIndex()).toBe(false);
			const second = await runOf(EMPLOYEE, TimeLogSourceEnum.MOBILE, '2026-11-15T12:00:00Z');

			await runMigration('up');

			expect(await hasIndex()).toBe(true);
			expect(await isRunning(second)).toBe(true);
		},
		TIMEOUT
	);
});
