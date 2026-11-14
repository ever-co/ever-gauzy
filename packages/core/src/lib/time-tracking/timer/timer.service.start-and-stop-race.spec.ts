// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { RequestTimeoutException } from '@nestjs/common';
import { DatabaseTypeEnum, defineConfig } from '@gauzy/config';
import { ITimeSlot, ITimerToggleInput, TimeLogSourceEnum } from '@gauzy/contracts';
import { MultiORMEnum } from '../../core/utils';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import {
	DeleteTimeSpanCommand,
	IGetConflictTimeLogCommand,
	ScheduleTimeLogEntriesCommand,
	TimeLogCreateCommand,
	TimeLogUpdateCommand
} from '../time-log/commands';
import { ScheduleTimeLogEntriesHandler } from '../time-log/commands/handlers/schedule-time-log-entries.handler';
import { EMPLOYEE_TURN_FAILSAFE_MS, TimerService } from './timer.service';

const EMPLOYEE_ID = 'employee-1';
const NOW = new Date('2026-10-24T02:00:00.000Z');
const ONE_HOUR_AGO = new Date('2026-10-24T01:00:00.000Z');
const TWO_HOURS_AGO = new Date('2026-10-24T00:00:00.000Z');

/** A time log as the table holds it. */
interface TimeLogRow {
	id: string;
	employeeId: string;
	tenantId: string;
	organizationId: string;
	source: TimeLogSourceEnum;
	isRunning: boolean;
	startedAt: Date;
	stoppedAt: Date | null;
	createdAt: Date;
	timeSlots?: Partial<ITimeSlot>[];
}

/** The employee's status, as the start and the stop write it. */
interface EmployeeStatus {
	isOnline: boolean;
	isTrackingTime: boolean;
}

/** What the stand-ins do around a command, as another client or a slow handler would. */
interface Hooks {
	/** Runs when a `TimeLogUpdateCommand` arrives, before its input is written. */
	onUpdate?: (command: TimeLogUpdateCommand, employee: EmployeeStatus) => Promise<void> | void;
	/** Runs when a `TimeLogCreateCommand` arrives, before the run is written. */
	onCreate?: (command: TimeLogCreateCommand) => Promise<void> | void;
	/** Runs when an `IGetConflictTimeLogCommand` arrives, before the overlapping logs are read. */
	onConflictLookup?: () => Promise<void> | void;
	/** Runs when the cleanup (`ScheduleTimeLogEntriesCommand`) reads the pending logs, before they are read. */
	onPendingRead?: () => Promise<void> | void;
}

const time = (value: Date | string | null): number => new Date(value).getTime();

/** Lets the event loop turn once, as a database round trip does. */
const roundTrip = () => new Promise<void>((resolve) => setImmediate(resolve));

/** The rows a `where` of plain values matches: the running-log reads of either ORM build no other. */
function matching(rows: TimeLogRow[], where: Record<string, unknown>): TimeLogRow[] {
	return rows.filter((row) =>
		Object.entries(where).every(([key, value]) => {
			const isOperator = value !== null && typeof value === 'object' && !(value instanceof Date);
			if (isOperator) {
				throw new Error(`Unexpected operator on ${key}`);
			}
			return row[key as keyof TimeLogRow] === value;
		})
	);
}

/** The rows by `startedAt DESC, createdAt DESC`, the order every running-log read asks for. */
function latestFirst(rows: TimeLogRow[]): TimeLogRow[] {
	return [...rows].sort((a, b) => time(b.startedAt) - time(a.startedAt) || time(b.createdAt) - time(a.createdAt));
}

/** A row as a read hands it out: a copy, so that the specs check the table. */
const copyOf = (row: TimeLogRow): TimeLogRow => ({ ...row });

/** A MikroORM-loaded row: `wrapSerialize` calls its `toJSON`. */
const loaded = (row: TimeLogRow) => ({ ...row, toJSON: () => ({ ...row }) });

/**
 * A `TimerService` for `employeeId` over `rows`, on the given ORM, with its real start and stop. The repositories
 * answer from the table. The cleanup runs through the real `ScheduleTimeLogEntriesHandler`, whose pending-log query
 * (raw SQL, knex) is replaced by the same predicate over the table: every log of the employee running with a
 * `stoppedAt`, or with none, whatever the command names. `TimeLogUpdateCommand` writes its input on the row; the rest
 * of it (time slots, timesheet, worked hours) is the handler's and does not run here. `TimeLogCreateCommand` adds a
 * run. The conflict lookup returns the other logs overlapping the range, with their time slots.
 */
function createService(
	ormType: MultiORMEnum,
	ids: { tenantId: string; organizationId: string },
	rows: TimeLogRow[],
	hooks: Hooks = {},
	employeeId: string = EMPLOYEE_ID
) {
	const employee: EmployeeStatus = { isOnline: true, isTrackingTime: true };
	const employeeUpdates = jest.fn(async (_employeeId: string, status: EmployeeStatus) =>
		Object.assign(employee, status)
	);
	const updates: TimeLogUpdateCommand[] = [];
	const timeSpanDeletes: DeleteTimeSpanCommand[] = [];
	const logger = { debug: jest.fn(), warn: jest.fn() };

	const write = (partial: Partial<TimeLogRow> & { id: string }): TimeLogRow => {
		const row = rows.find((candidate) => candidate.id === partial.id);
		if (!row) {
			throw new Error(`No time log "${partial.id}"`);
		}
		return Object.assign(row, partial);
	};

	const cleanup: ScheduleTimeLogEntriesHandler = Object.assign(
		Object.create(ScheduleTimeLogEntriesHandler.prototype),
		{
			ormType,
			typeOrmTimeLogRepository: {
				save: async (partial: Partial<TimeLogRow> & { id: string }) => write(partial)
			},
			mikroOrmTimeLogRepository: {
				getEntityManager: () => ({
					getReference: (_entityName: string, id: string) => ({ id }),
					assign: (entity: object, partial: object) => Object.assign(entity, partial),
					persistAndFlush: async (entity: Partial<TimeLogRow> & { id: string }) => {
						write(entity);
					}
				})
			},
			getPendingTimeLogs: async (tenantId: string, organizationId: string, employeeId: string) => {
				await hooks.onPendingRead?.();
				return rows
					.filter(
						(row) =>
							row.tenantId === tenantId &&
							row.organizationId === organizationId &&
							row.employeeId === employeeId &&
							((row.stoppedAt !== null && row.isRunning) || row.stoppedAt === null)
					)
					.map((row) => ({ ...row, timeSlots: row.timeSlots ?? [] }));
			}
		}
	);

	let createdRuns = 0;
	const execute = async (command: unknown) => {
		if (command instanceof TimeLogUpdateCommand) {
			updates.push(command);
			await hooks.onUpdate?.(command, employee);
			// The timer names the log by its id
			return copyOf(write({ ...(command.input as Partial<TimeLogRow>), id: command.id as string }));
		}
		if (command instanceof TimeLogCreateCommand) {
			await hooks.onCreate?.(command);
			createdRuns += 1;
			const row = {
				...command.input,
				id: `run-${createdRuns}`,
				createdAt: new Date(NOW.getTime() + createdRuns)
			} as unknown as TimeLogRow;
			rows.push(row);
			return copyOf(row);
		}
		if (command instanceof IGetConflictTimeLogCommand) {
			await hooks.onConflictLookup?.();
			const { ignoreId, startDate, endDate } = command.input;
			return rows
				.filter(
					(row) =>
						row.id !== ignoreId &&
						row.stoppedAt !== null &&
						time(row.startedAt) < time(endDate) &&
						time(row.stoppedAt) > time(startDate)
				)
				.map((row) => ({ ...copyOf(row), timeSlots: row.timeSlots ?? [] }));
		}
		if (command instanceof DeleteTimeSpanCommand) {
			timeSpanDeletes.push(command);
			return true;
		}
		if (command instanceof ScheduleTimeLogEntriesCommand) {
			return cleanup.execute(command);
		}
		throw new Error(`Unexpected command ${(command as object)?.constructor?.name}`);
	};

	const service: TimerService = Object.assign(Object.create(TimerService.prototype), {
		ormType,
		logger,
		typeOrmTimeLogRepository: {
			find: async ({ where }: { where: Record<string, unknown> }) =>
				latestFirst(matching(rows, where)).map(copyOf),
			findOne: async ({ where }: { where: Record<string, unknown> }) => {
				const [row] = latestFirst(matching(rows, where));
				return row ? copyOf(row) : null;
			}
		},
		mikroOrmTimeLogRepository: {
			findAll: async ({ where }: { where: Record<string, unknown> }) =>
				latestFirst(matching(rows, where)).map(loaded),
			findOne: async (where: Record<string, unknown>) => {
				const [row] = latestFirst(matching(rows, where));
				return row ? loaded(row) : null;
			}
		},
		findEmployee: jest.fn(async () => ({
			id: employeeId,
			organizationId: ids.organizationId,
			tenantId: ids.tenantId,
			isTrackingEnabled: true
		})),
		_employeeService: { update: employeeUpdates },
		_commandBus: { execute }
	});

	return { service, employee, employeeUpdates, updates, timeSpanDeletes, logger };
}

/**
 * A stop read the running log, ran its update (time slots, timesheet and worked hours, which can take a while), marked
 * the employee as not tracking, then closed every run still going and cut the logs overlapping the stopped one. A run
 * another client started meanwhile (the employee switching devices) was closed with it, at its own start, and the
 * employee showed as not tracking while it ran. The stop now reads the runs going as it begins, closes only those, and
 * marks the employee as not tracking only when nothing runs any more.
 */
describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])(
	'TimerService.stopTimer while another client starts a timer (%s)',
	(ormType) => {
		const fixture = createTenantFixture();

		/** A run of the employee, as a timer start writes it: running, its `stoppedAt` at its start until a heartbeat. */
		const run = (
			id: string,
			source: TimeLogSourceEnum,
			startedAt: Date,
			overrides: Partial<TimeLogRow> = {}
		): TimeLogRow => ({
			id,
			employeeId: EMPLOYEE_ID,
			tenantId: fixture.tenantId,
			organizationId: fixture.organizationId,
			source,
			isRunning: true,
			startedAt,
			stoppedAt: startedAt,
			createdAt: startedAt,
			...overrides
		});

		const setup = (rows: TimeLogRow[], hooks: Hooks = {}) => createService(ormType, fixture, rows, hooks);

		/**
		 * While the stop's update of `stoppedId` runs, another client starts `started` through another API process: the
		 * run is written and the employee marked as tracking.
		 */
		const startedElsewhereDuringUpdateOf = (stoppedId: string, rows: TimeLogRow[], started: TimeLogRow): Hooks => ({
			onUpdate: (command, employee) => {
				const isStopsUpdate = command.id === stoppedId && !rows.includes(started);
				if (isStopsUpdate) {
					rows.push(started);
					Object.assign(employee, { isOnline: true, isTrackingTime: true });
				}
			}
		});

		const stop = (service: TimerService) => service.stopTimer({ stoppedAt: NOW } as ITimerToggleInput);

		let restore: () => void;

		beforeAll(() => defineConfig({ dbConnectionOptions: { type: DatabaseTypeEnum.postgres } }));

		beforeEach(() => {
			({ restore } = asTenantUser(fixture));
			jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
			jest.spyOn(console, 'log').mockImplementation(() => undefined);
		});

		afterEach(() => {
			restore();
			jest.restoreAllMocks();
		});

		it.each([TimeLogSourceEnum.WEB_TIMER, TimeLogSourceEnum.TEAMS, TimeLogSourceEnum.DESKTOP])(
			'leaves going a %s run started while its update ran, and the employee tracking',
			async (source) => {
				const rows = [run('stopped', TimeLogSourceEnum.TEAMS, ONE_HOUR_AGO)];
				const started = run('started-elsewhere', source, NOW);
				const { service, employee, updates, logger } = setup(
					rows,
					startedElsewhereDuringUpdateOf('stopped', rows, started)
				);

				await stop(service);

				expect(rows[0]).toMatchObject({ id: 'stopped', isRunning: false, stoppedAt: NOW });
				// Not closed at its own start, as a run left going beside the stopped one would be
				expect(started).toMatchObject({ isRunning: true, startedAt: NOW, stoppedAt: NOW });
				expect(updates.map((command) => command.id)).toEqual(['stopped']);
				expect(employee).toEqual({ isOnline: true, isTrackingTime: true });
				expect(logger.warn).not.toHaveBeenCalled();
			}
		);

		it('leaves it going when its device dates its start before the stopped run started', async () => {
			// The stopped run started two seconds ago; the other device's clock is three seconds behind
			const rows = [run('stopped', TimeLogSourceEnum.TEAMS, new Date('2026-10-24T01:59:58.000Z'))];
			const startedAt = new Date('2026-10-24T01:59:57.000Z');
			const started = run('started-elsewhere', TimeLogSourceEnum.WEB_TIMER, startedAt);
			const { service, employee, updates } = setup(
				rows,
				startedElsewhereDuringUpdateOf('stopped', rows, started)
			);

			await stop(service);

			expect(started).toMatchObject({ isRunning: true, stoppedAt: startedAt });
			expect(updates.map((command) => command.id)).toEqual(['stopped']);
			expect(employee).toEqual({ isOnline: true, isTrackingTime: true });
		});

		it.each([
			[TimeLogSourceEnum.WEB_TIMER, new Date('2026-10-24T01:00:00.000Z')],
			[TimeLogSourceEnum.DESKTOP, new Date('2026-10-24T00:00:10.000Z')]
		])(
			'still closes a %s run left going beside the stopped one, and only that one',
			async (leftGoingSource, leftGoingEnd) => {
				const leftGoing = run('left-going', leftGoingSource, TWO_HOURS_AGO);
				const rows = [leftGoing, run('stopped', TimeLogSourceEnum.TEAMS, ONE_HOUR_AGO)];
				// A desktop run: the cleanup's command closes it too, unless it names the runs it may close
				const started = run('started-elsewhere', TimeLogSourceEnum.DESKTOP, NOW);
				const { service, employee } = setup(rows, startedElsewhereDuringUpdateOf('stopped', rows, started));

				await stop(service);

				// As before: where the stopped run started, or the ten-second end of a desktop run with no time slot
				expect(leftGoing).toMatchObject({ isRunning: false, stoppedAt: leftGoingEnd });
				expect(started).toMatchObject({ isRunning: true, stoppedAt: NOW });
				expect(employee).toEqual({ isOnline: true, isTrackingTime: true });
			}
		);

		it('leaves alone the time slots of a run synced while it ran, though they fall in the stopped run', async () => {
			const rows = [run('stopped', TimeLogSourceEnum.TEAMS, ONE_HOUR_AGO)];
			// A desktop run started offline a minute back, synced with its first time slot while the stop ran
			const oneMinuteAgo = new Date('2026-10-24T01:59:00.000Z');
			const started = run('started-elsewhere', TimeLogSourceEnum.DESKTOP, oneMinuteAgo, {
				stoppedAt: NOW,
				timeSlots: [{ startedAt: oneMinuteAgo, duration: 60 }]
			});
			const { service, timeSpanDeletes } = setup(rows, startedElsewhereDuringUpdateOf('stopped', rows, started));

			await stop(service);

			// The stopped run ends at 02:00, over the synced run's minute: that minute stays the synced run's
			expect(timeSpanDeletes).toEqual([]);
			expect(started).toMatchObject({ isRunning: true, stoppedAt: NOW });
		});

		describe('with logs the stopped run overlaps', () => {
			const syncedStart = new Date('2026-10-24T01:40:00.000Z');
			const syncedEnd = new Date('2026-10-24T01:50:00.000Z');
			const olderStart = new Date('2026-10-24T01:20:00.000Z');

			/** Ten minutes from the desktop, started and stopped while the stop's update ran, with its time slot. */
			const syncedLog = () =>
				run('synced', TimeLogSourceEnum.DESKTOP, syncedStart, {
					isRunning: false,
					stoppedAt: syncedEnd,
					timeSlots: [{ startedAt: syncedStart, duration: 600 }]
				});

			/** A finished web timer log from before the stop, inside the run it ends, with its time slot. */
			const olderLog = () =>
				run('older', TimeLogSourceEnum.WEB_TIMER, olderStart, {
					isRunning: false,
					stoppedAt: new Date('2026-10-24T01:30:00.000Z'),
					timeSlots: [{ startedAt: olderStart, duration: 600 }]
				});

			/** While the stop's update runs, another client writes `log`. */
			const writtenDuringUpdate = (rows: TimeLogRow[], log: TimeLogRow): Hooks => ({
				onUpdate: (command) => {
					const isStopsUpdate = command.id === 'stopped' && !rows.includes(log);
					if (isStopsUpdate) {
						rows.push(log);
					}
				}
			});

			it('leaves alone a desktop log started and stopped while its update ran', async () => {
				const rows = [run('stopped', TimeLogSourceEnum.TEAMS, ONE_HOUR_AGO)];
				const synced = syncedLog();
				const { service, timeSpanDeletes } = setup(rows, writtenDuringUpdate(rows, synced));

				await stop(service);

				// The stopped run ends at 02:00, over the synced log's ten minutes: they stay the synced log's
				expect(timeSpanDeletes).toEqual([]);
				expect(synced).toEqual(syncedLog());
			});

			it('still cuts an older finished log, as before', async () => {
				const older = olderLog();
				const rows = [older, run('stopped', TimeLogSourceEnum.TEAMS, ONE_HOUR_AGO)];
				const { service, timeSpanDeletes } = setup(rows);

				await stop(service);

				expect(timeSpanDeletes).toEqual([
					expect.objectContaining({
						newTime: { start: ONE_HOUR_AGO, end: NOW },
						timeLog: expect.objectContaining({ id: 'older' }),
						timeSlot: older.timeSlots[0]
					})
				]);
			});

			it('cuts only the older one when a desktop log is synced over the same run during its update', async () => {
				const older = olderLog();
				const rows = [older, run('stopped', TimeLogSourceEnum.TEAMS, ONE_HOUR_AGO)];
				const { service, timeSpanDeletes } = setup(rows, writtenDuringUpdate(rows, syncedLog()));

				await stop(service);

				expect(timeSpanDeletes.map((command) => command.timeLog.id)).toEqual(['older']);
			});

			it('leaves alone the time slots of a run started between its read of the runs and of the overlaps', async () => {
				const rows = [run('stopped', TimeLogSourceEnum.TEAMS, ONE_HOUR_AGO)];
				// Started on another pod whose clock runs two minutes behind, with a heartbeat and its first time slot
				const startedAt = new Date('2026-10-24T01:57:00.000Z');
				const timeSlots = [{ startedAt, duration: 60 }];
				const lastHeartbeat = new Date('2026-10-24T01:58:00.000Z');
				const started = run('started-between', TimeLogSourceEnum.WEB_TIMER, startedAt, {
					stoppedAt: lastHeartbeat,
					timeSlots
				});
				const { service, timeSpanDeletes } = setup(rows, {
					// The stop has read the runs going; the run is written before it reads the logs it overlaps
					onConflictLookup: () => {
						const isFirstLookup = !rows.includes(started);
						if (isFirstLookup) {
							rows.push(started);
						}
					}
				});

				await stop(service);

				// The stopped run ends at 02:00, over the started run's minute: that minute stays the started run's
				expect(timeSpanDeletes).toEqual([]);
				expect(started).toMatchObject({ isRunning: true, startedAt, stoppedAt: lastHeartbeat, timeSlots });
			});
		});

		it('marks the employee as not tracking when nothing else runs, as before', async () => {
			const rows = [run('stopped', TimeLogSourceEnum.TEAMS, ONE_HOUR_AGO)];
			const { service, employee } = setup(rows);

			await stop(service);

			expect(rows[0]).toMatchObject({ isRunning: false, stoppedAt: NOW });
			expect(employee).toEqual({ isOnline: false, isTrackingTime: false });
		});

		it('marks the employee as not tracking, as before, when the running timers cannot be read after the stop', async () => {
			const rows = [run('stopped', TimeLogSourceEnum.TEAMS, ONE_HOUR_AGO)];
			const { service, employee, logger } = setup(rows);
			const reads = service as unknown as { findTimeLogsWhere: () => Promise<unknown> };
			jest.spyOn(reads, 'findTimeLogsWhere').mockRejectedValue(new Error('connection reset'));

			await stop(service);

			expect(employee).toEqual({ isOnline: false, isTrackingTime: false });
			expect(logger.warn).toHaveBeenCalledWith(
				expect.stringContaining('Failed to read the running timers of employee employee-1')
			);
		});
	}
);

/**
 * A start closed the runs going, then created its own; a stop read the running log, then closed it. Two of them for
 * one employee at once interleaved: two starts both found nothing going and both created a run, and a start read the
 * run a stop was closing as still going and closed it a second time. In one API process they now run one after the
 * other, each once the one before it has settled; another employee's start or stop does not wait.
 */
describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])(
	'TimerService start and stop of one employee in one API process (%s)',
	(ormType) => {
		const fixture = createTenantFixture();

		const setup = (rows: TimeLogRow[], hooks: Hooks = {}, employeeId: string = EMPLOYEE_ID) =>
			createService(ormType, fixture, rows, hooks, employeeId);

		/** The employee's running timer, started an hour ago from Ever Teams. */
		const runningForAnHour = (): TimeLogRow => ({
			id: 'stopped',
			employeeId: EMPLOYEE_ID,
			tenantId: fixture.tenantId,
			organizationId: fixture.organizationId,
			source: TimeLogSourceEnum.TEAMS,
			isRunning: true,
			startedAt: ONE_HOUR_AGO,
			stoppedAt: ONE_HOUR_AGO,
			createdAt: ONE_HOUR_AGO
		});

		const start = (service: TimerService, source: TimeLogSourceEnum) =>
			service.startTimer({ source } as ITimerToggleInput);

		let restore: () => void;

		beforeAll(() => defineConfig({ dbConnectionOptions: { type: DatabaseTypeEnum.postgres } }));

		beforeEach(() => {
			({ restore } = asTenantUser(fixture));
			jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
			jest.spyOn(console, 'log').mockImplementation(() => undefined);
		});

		afterEach(() => {
			restore();
			jest.restoreAllMocks();
		});

		it('leaves one running log after two starts sent at once', async () => {
			const rows: TimeLogRow[] = [];
			const { service, employee } = setup(rows, { onCreate: roundTrip });

			await Promise.all([start(service, TimeLogSourceEnum.WEB_TIMER), start(service, TimeLogSourceEnum.DESKTOP)]);

			// The second start closed the first one's run, as a start after it would
			expect(rows.filter((row) => row.isRunning)).toHaveLength(1);
			expect(rows).toHaveLength(2);
			expect(rows[0]).toMatchObject({ id: 'run-1', isRunning: false, stoppedAt: NOW });
			expect(employee).toEqual({ isOnline: true, isTrackingTime: true });
		});

		it('runs a start sent while a stop runs once the stop is done', async () => {
			const rows = [runningForAnHour()];
			const events: string[] = [];
			let starting: Promise<unknown> | undefined;
			const { service, employee, employeeUpdates } = setup(rows, {
				onUpdate: async (command) => {
					events.push(`update ${command.id}`);
					const isStopsUpdate = !starting;
					if (isStopsUpdate) {
						// Another device starts the timer while the stop's update runs
						starting = start(service, TimeLogSourceEnum.DESKTOP);
					}
					await roundTrip();
					events.push(`updated ${command.id}`);
				},
				onCreate: () => {
					events.push('create');
				}
			});

			await service.stopTimer({ stoppedAt: NOW } as ITimerToggleInput);
			await starting;

			// The stopped run is updated once, by the stop: the start found it stopped
			expect(events).toEqual(['update stopped', 'updated stopped', 'create']);
			expect(employeeUpdates.mock.calls.map(([, status]) => status)).toEqual([
				{ isOnline: false, isTrackingTime: false },
				{ isOnline: true, isTrackingTime: true }
			]);
			expect(rows[0]).toMatchObject({ id: 'stopped', isRunning: false, stoppedAt: NOW });
			expect(rows[1]).toMatchObject({ id: 'run-1', isRunning: true, startedAt: NOW });
			expect(employee).toEqual({ isOnline: true, isTrackingTime: true });
		});

		it('lets the next start go on after one that failed', async () => {
			const rows: TimeLogRow[] = [];
			let creates = 0;
			const { service } = setup(rows, {
				onCreate: async () => {
					creates += 1;
					const isFirstCreate = creates === 1;
					await roundTrip();
					if (isFirstCreate) {
						throw new Error('connection reset');
					}
				}
			});

			const [failed, started] = await Promise.allSettled([
				start(service, TimeLogSourceEnum.WEB_TIMER),
				start(service, TimeLogSourceEnum.DESKTOP)
			]);

			expect(failed).toMatchObject({
				status: 'rejected',
				reason: expect.objectContaining({ message: 'connection reset' })
			});
			expect(started).toMatchObject({ status: 'fulfilled', value: { id: 'run-1', isRunning: true } });
			expect(rows).toEqual([expect.objectContaining({ id: 'run-1', isRunning: true })]);
		});

		it('lets the next start go on once the one before it has hung for the failsafe time, and not before', async () => {
			// Only the timers: the clock stays mocked, and a round trip still turns the event loop
			jest.useFakeTimers({ doNotFake: ['Date', 'nextTick', 'setImmediate', 'queueMicrotask'] });
			try {
				const rows: TimeLogRow[] = [];
				let creates = 0;
				const { service } = setup(rows, {
					onCreate: () => {
						creates += 1;
						// The first start's write never answers
						return creates === 1 ? new Promise<void>(() => undefined) : undefined;
					}
				});

				void start(service, TimeLogSourceEnum.WEB_TIMER);
				const second = start(service, TimeLogSourceEnum.DESKTOP);

				await jest.advanceTimersByTimeAsync(EMPLOYEE_TURN_FAILSAFE_MS - 1);
				expect(creates).toBe(1);

				await jest.advanceTimersByTimeAsync(1);
				await expect(second).resolves.toMatchObject({ id: 'run-1', isRunning: true });
				expect(rows).toEqual([expect.objectContaining({ id: 'run-1', isRunning: true })]);
			} finally {
				jest.useRealTimers();
			}
		});

		it('lets the starts after one that hung go one at a time, and the one that hung creates no run when it comes back', async () => {
			jest.useFakeTimers({ doNotFake: ['Date', 'nextTick', 'setImmediate', 'queueMicrotask'] });
			try {
				const rows = [runningForAnHour()];
				const events: string[] = [];
				let updates = 0;
				let creates = 0;
				let finishFirstUpdate: () => void = () => undefined;
				let finishFirstCreate: () => void = () => undefined;
				const { service, logger } = setup(rows, {
					onUpdate: (command) => {
						updates += 1;
						events.push(`update ${command.id}`);
						// The first start's update of the run going hangs until the spec lets it finish
						return updates === 1
							? new Promise<void>((resolve) => (finishFirstUpdate = resolve))
							: undefined;
					},
					onCreate: () => {
						creates += 1;
						events.push(`create ${creates}`);
						// The first run written, the second start's, takes a while
						return creates === 1
							? new Promise<void>((resolve) => (finishFirstCreate = resolve))
							: undefined;
					}
				});

				const first = start(service, TimeLogSourceEnum.WEB_TIMER).then(
					() => 'started',
					(error: Error) => error
				);
				const second = start(service, TimeLogSourceEnum.DESKTOP);
				await jest.advanceTimersByTimeAsync(60_000);
				const third = start(service, TimeLogSourceEnum.WEB_TIMER);

				// The first has run for the failsafe time: the second goes on, ends the run going and writes its own
				await jest.advanceTimersByTimeAsync(EMPLOYEE_TURN_FAILSAFE_MS - 60_000);
				expect(events).toEqual(['update stopped', 'update stopped', 'create 1']);

				// The first comes back once the second has begun: the update it had sent lands, and it creates no run
				finishFirstUpdate();
				await expect(first).resolves.toBeInstanceOf(RequestTimeoutException);

				// The third arrived a minute after the others, and its two minutes have passed: it still waits for the
				// second, which has not hung for the failsafe time
				await jest.advanceTimersByTimeAsync(EMPLOYEE_TURN_FAILSAFE_MS - 1);
				expect(events).toEqual(['update stopped', 'update stopped', 'create 1']);

				finishFirstCreate();
				await expect(second).resolves.toMatchObject({ id: 'run-1' });
				await expect(third).resolves.toMatchObject({ id: 'run-2', isRunning: true });

				// The third closed the second's run, as a start after it would: one run goes on
				expect(rows.filter((row) => row.isRunning)).toEqual([expect.objectContaining({ id: 'run-2' })]);
				expect(rows).toHaveLength(3);
				expect(logger.warn).toHaveBeenCalledWith(
					expect.stringContaining(`has run for over ${EMPLOYEE_TURN_FAILSAFE_MS} ms and the next one goes on`)
				);
			} finally {
				jest.useRealTimers();
			}
		});

		it('closes again a run whose create was on its way when the next start went on, and answers 408', async () => {
			jest.useFakeTimers({ doNotFake: ['Date', 'nextTick', 'setImmediate', 'queueMicrotask'] });
			try {
				const rows: TimeLogRow[] = [];
				let creates = 0;
				let finishFirstCreate: () => void = () => undefined;
				const { service, employee, employeeUpdates } = setup(rows, {
					onCreate: () => {
						creates += 1;
						// The first start's create is sent, and its row is written only when the spec lets it
						return creates === 1
							? new Promise<void>((resolve) => (finishFirstCreate = resolve))
							: undefined;
					}
				});

				const first = start(service, TimeLogSourceEnum.WEB_TIMER).then(
					() => 'started',
					(error: Error) => error
				);
				const second = start(service, TimeLogSourceEnum.DESKTOP);

				// The second goes on after the failsafe time, finds nothing going and starts its run
				await jest.advanceTimersByTimeAsync(EMPLOYEE_TURN_FAILSAFE_MS);
				await expect(second).resolves.toMatchObject({ id: 'run-1', isRunning: true });

				// The first create lands after that: its run is closed where it started, and the first start answers 408
				finishFirstCreate();
				await expect(first).resolves.toBeInstanceOf(RequestTimeoutException);

				expect(rows.filter((row) => row.isRunning)).toEqual([expect.objectContaining({ id: 'run-1' })]);
				expect(rows.find((row) => row.id === 'run-2')).toMatchObject({ isRunning: false, stoppedAt: NOW });
				// Only the second start marked the employee as tracking
				expect(employeeUpdates).toHaveBeenCalledTimes(1);
				expect(employee).toEqual({ isOnline: true, isTrackingTime: true });
			} finally {
				jest.useRealTimers();
			}
		});

		it("leaves the next start's run going when the cleanup of the start before reads the pending logs after it", async () => {
			jest.useFakeTimers({ doNotFake: ['Date', 'nextTick', 'setImmediate', 'queueMicrotask'] });
			try {
				// A desktop run, which the cleanup ends
				const rows = [{ ...runningForAnHour(), id: 'desktop', source: TimeLogSourceEnum.DESKTOP }];
				let pendingReads = 0;
				let finishFirstRead: () => void = () => undefined;
				const { service } = setup(rows, {
					onPendingRead: () => {
						pendingReads += 1;
						// The first start's cleanup is sent, and reads the pending logs only when the spec lets it
						return pendingReads === 1
							? new Promise<void>((resolve) => (finishFirstRead = resolve))
							: undefined;
					}
				});

				const first = start(service, TimeLogSourceEnum.WEB_TIMER).then(
					() => 'started',
					(error: Error) => error
				);
				const second = start(service, TimeLogSourceEnum.WEB_TIMER);

				// The second goes on after the failsafe time, ends the desktop run and starts its own
				await jest.advanceTimersByTimeAsync(EMPLOYEE_TURN_FAILSAFE_MS);
				await expect(second).resolves.toMatchObject({ id: 'run-1', isRunning: true });

				// The first cleanup reads the pending logs now: it ends none of the runs it did not read
				finishFirstRead();
				await expect(first).resolves.toBeInstanceOf(RequestTimeoutException);

				expect(rows.find((row) => row.id === 'run-1')).toMatchObject({ isRunning: true });
				expect(rows.find((row) => row.id === 'desktop')).toMatchObject({ isRunning: false });
				expect(rows).toHaveLength(2);
			} finally {
				jest.useRealTimers();
			}
		});

		it('lets a start that outlives the failsafe time finish as usual when no other start or stop waits', async () => {
			jest.useFakeTimers({ doNotFake: ['Date', 'nextTick', 'setImmediate', 'queueMicrotask'] });
			try {
				const rows = [runningForAnHour()];
				let finishUpdate: () => void = () => undefined;
				const { service, employee, logger } = setup(rows, {
					// Its update of the run going takes longer than the failsafe time
					onUpdate: () => new Promise<void>((resolve) => (finishUpdate = resolve))
				});

				const starting = start(service, TimeLogSourceEnum.WEB_TIMER);
				await jest.advanceTimersByTimeAsync(EMPLOYEE_TURN_FAILSAFE_MS + 10_000);
				finishUpdate();

				await expect(starting).resolves.toMatchObject({ id: 'run-1', isRunning: true });
				expect(rows[0]).toMatchObject({ id: 'stopped', isRunning: false });
				expect(employee).toEqual({ isOnline: true, isTrackingTime: true });
				expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('the next one goes on'));
			} finally {
				jest.useRealTimers();
			}
		});

		it('leaves the run to the start that went on when a stop that hung comes back', async () => {
			jest.useFakeTimers({ doNotFake: ['Date', 'nextTick', 'setImmediate', 'queueMicrotask'] });
			try {
				const rows = [runningForAnHour()];
				let lookups = 0;
				let finishStopsLookup: () => void = () => undefined;
				const { service, employee } = setup(rows, {
					onConflictLookup: () => {
						lookups += 1;
						// The stop's read of the logs its run overlaps hangs until the spec lets it finish
						return lookups === 1
							? new Promise<void>((resolve) => (finishStopsLookup = resolve))
							: undefined;
					}
				});

				const stopping = service.stopTimer({ stoppedAt: NOW } as ITimerToggleInput).then(
					() => 'stopped',
					(error: Error) => error
				);
				const starting = start(service, TimeLogSourceEnum.DESKTOP);

				await jest.advanceTimersByTimeAsync(EMPLOYEE_TURN_FAILSAFE_MS);
				await expect(starting).resolves.toMatchObject({ id: 'run-1', isRunning: true });
				// The start ended the Ever Teams run, which never had a heartbeat, at its own start
				expect(rows[0]).toMatchObject({ id: 'stopped', isRunning: false, stoppedAt: ONE_HOUR_AGO });

				finishStopsLookup();
				await expect(stopping).resolves.toBeInstanceOf(RequestTimeoutException);

				// The stop wrote nothing: the run keeps the start's end, and the new run goes on
				expect(rows[0]).toMatchObject({ id: 'stopped', isRunning: false, stoppedAt: ONE_HOUR_AGO });
				expect(rows[1]).toMatchObject({ id: 'run-1', isRunning: true });
				expect(employee).toEqual({ isOnline: true, isTrackingTime: true });
			} finally {
				jest.useRealTimers();
			}
		});

		it("does not hold up another employee's start while this one's stop runs", async () => {
			const events: string[] = [];
			let otherStarting: Promise<unknown> | undefined;
			const other = setup(
				[],
				{
					onCreate: () => {
						events.push('other employee: create');
					}
				},
				'employee-2'
			);
			const { service } = setup([runningForAnHour()], {
				onUpdate: async () => {
					events.push('update begins');
					otherStarting = start(other.service, TimeLogSourceEnum.WEB_TIMER);
					await roundTrip();
					events.push('update ends');
				}
			});

			await service.stopTimer({ stoppedAt: NOW } as ITimerToggleInput);
			await otherStarting;

			expect(events).toEqual(['update begins', 'other employee: create', 'update ends']);
		});
	}
);
