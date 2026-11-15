import '../core/entities/internal';

import { DataSource, DataSourceOptions } from 'typeorm';
import { isPostgres } from '@gauzy/config';
import { TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { coreEntities } from '../core/entities';
import { TimeLog, TimeSlot } from '../core/entities/internal';
import { isUniqueViolation } from '../core/errors/unique-violation';
import { AddTimeLogOneRunningTimerPerEmployee1791000018700 } from './migrations/1791000018700-AddTimeLogOneRunningTimerPerEmployee';

/**
 * `1791000018700-AddTimeLogOneRunningTimerPerEmployee` on a real SQLite database whose schema the entities build: one
 * running timer run per employee, the desktop's running uploads left out (ever-co/ever-gauzy#11826). Rows that already
 * break the key are stopped first, where a start replacing them would have ended them, the latest run kept. Each test
 * starts from a database of its own, as before the migration.
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

	/** Writes a row of `entity`, with a placeholder in every other NOT NULL column without a default; its id. */
	const insert = async (entity: typeof TimeLog | typeof TimeSlot, row: Record<string, unknown>): Promise<string> => {
		const id = `11826000-0000-4000-8000-${String(++next).padStart(12, '0')}`;
		const values: Record<string, unknown> = { id, ...row };
		for (const column of dataSource.getMetadata(entity).columns) {
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
		await dataSource.createQueryBuilder().insert().into(entity).values(values).execute();
		return id;
	};

	/** A run of `source`, running since `startedAt`, its stored end its start unless given. */
	const runOf = (
		employeeId: string,
		source: TimeLogSourceEnum,
		startedAt: string | null,
		{
			stoppedAt = startedAt,
			logType = TimeLogType.TRACKED
		}: { stoppedAt?: string | null; logType?: TimeLogType } = {}
	) =>
		insert(TimeLog, {
			employeeId,
			source,
			logType,
			isRunning: true,
			startedAt: startedAt ? new Date(startedAt) : null,
			stoppedAt: stoppedAt ? new Date(stoppedAt) : null
		});

	/** A time slot of `logId`, from `startedAt`, `duration` seconds long. */
	const slotOf = async (logId: string, startedAt: string, duration: number) => {
		const slotId = await insert(TimeSlot, { employeeId: EMPLOYEE, startedAt: new Date(startedAt), duration });
		await dataSource.query(`INSERT INTO "time_slot_time_logs" ("timeSlotId", "timeLogId") VALUES (?, ?)`, [
			slotId,
			logId
		]);
	};

	/** The error a write raised, or undefined. */
	const failureOf = (write: Promise<unknown>) =>
		write.then(
			() => undefined,
			(error: unknown) => error
		);

	const read = async (id: string) =>
		await dataSource.getRepository(TimeLog).findOne({ where: { id }, withDeleted: true });
	const isRunning = async (id: string) => Boolean((await read(id)).isRunning);
	const endOf = async (id: string) => new Date((await read(id)).stoppedAt).toISOString();

	const hasIndex = async () => {
		const found = await dataSource.query(
			`SELECT name FROM sqlite_master WHERE type = 'index' AND name = '${INDEX}'`
		);
		return found.length > 0;
	};

	// A database of its own for each test, built by the entities, then set back to before the migration
	beforeEach(async () => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
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
		await dataSource.query(`DROP INDEX IF EXISTS "${INDEX}"`);
	}, TIMEOUT);

	afterEach(async () => {
		await dataSource?.destroy();
		jest.restoreAllMocks();
	});

	it(
		"stops an employee's older timer runs where a start replacing them would, keeps the latest and the desktop's uploads",
		async () => {
			// A web timer, which sends no heartbeat; an Ever Teams run whose last time slot ends at 08:30; a break
			const webOld = await runOf(EMPLOYEE, TimeLogSourceEnum.WEB_TIMER, '2026-11-15T07:30:00Z');
			const teamsOld = await runOf(EMPLOYEE, TimeLogSourceEnum.TEAMS, '2026-11-15T08:00:00Z');
			await slotOf(teamsOld, '2026-11-15T08:20:00Z', 600);
			const breakOld = await runOf(EMPLOYEE, TimeLogSourceEnum.WEB_TIMER, '2026-11-15T08:40:00Z', {
				logType: TimeLogType.BREAK
			});
			const latest = await runOf(EMPLOYEE, TimeLogSourceEnum.WEB_TIMER, '2026-11-15T09:00:00Z');
			const upload = await runOf(EMPLOYEE, TimeLogSourceEnum.DESKTOP, '2026-11-15T07:00:00Z');
			const otherEmployeeRun = await runOf(OTHER_EMPLOYEE, TimeLogSourceEnum.MOBILE, '2026-11-15T06:00:00Z');

			await runMigration('up');

			expect(await hasIndex()).toBe(true);
			for (const stopped of [webOld, teamsOld, breakOld]) {
				expect(await isRunning(stopped)).toBe(false);
			}
			// `TimerService.replacedRunEnd`: where the next run started, at the end of the last time slot, and where the
			// next run started for a break
			expect(await endOf(webOld)).toBe('2026-11-15T08:00:00.000Z');
			expect(await endOf(teamsOld)).toBe('2026-11-15T08:30:00.000Z');
			expect(await endOf(breakOld)).toBe('2026-11-15T09:00:00.000Z');
			expect(await isRunning(latest)).toBe(true);
			expect(await isRunning(upload)).toBe(true);
			expect(await isRunning(otherEmployeeRun)).toBe(true);
		},
		TIMEOUT
	);

	it(
		'stops a running timer row without a start, which no client can read or stop, and then builds the key',
		async () => {
			const startless = await runOf(EMPLOYEE, TimeLogSourceEnum.TEAMS, null);
			const running = await runOf(EMPLOYEE, TimeLogSourceEnum.WEB_TIMER, '2026-11-15T09:00:00Z');

			await runMigration('up');

			expect(await hasIndex()).toBe(true);
			expect(await isRunning(startless)).toBe(false);
			expect(await isRunning(running)).toBe(true);
		},
		TIMEOUT
	);

	it(
		"refuses a second running timer run of an employee, and lets the desktop's running uploads through",
		async () => {
			await runOf(EMPLOYEE, TimeLogSourceEnum.WEB_TIMER, '2026-11-15T09:00:00Z');
			await runMigration('up');

			const second = await failureOf(runOf(EMPLOYEE, TimeLogSourceEnum.MOBILE, '2026-11-15T10:00:00Z'));
			expect(
				isUniqueViolation(second) || isUniqueViolation((second as { driverError?: unknown })?.driverError)
			).toBe(true);

			await runOf(EMPLOYEE, TimeLogSourceEnum.DESKTOP, '2026-11-15T10:00:00Z');
			await runOf(EMPLOYEE, TimeLogSourceEnum.DESKTOP, '2026-11-15T11:00:00Z');
			// A stopped run, and a deleted running one, are no running runs
			await insert(TimeLog, {
				employeeId: EMPLOYEE,
				source: TimeLogSourceEnum.TEAMS,
				isRunning: false,
				startedAt: new Date()
			});
			await insert(TimeLog, {
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
		'drops the key on down, and builds it again on up, up again changing nothing',
		async () => {
			const first = await runOf(EMPLOYEE, TimeLogSourceEnum.WEB_TIMER, '2026-11-15T09:00:00Z');
			await runMigration('up');
			await runMigration('up');
			expect(await hasIndex()).toBe(true);

			await runMigration('down');
			expect(await hasIndex()).toBe(false);
			const second = await runOf(EMPLOYEE, TimeLogSourceEnum.MOBILE, '2026-11-15T12:00:00Z');

			await runMigration('up');

			expect(await hasIndex()).toBe(true);
			expect(await isRunning(second)).toBe(true);
			expect(await isRunning(first)).toBe(false);
		},
		TIMEOUT
	);
});
