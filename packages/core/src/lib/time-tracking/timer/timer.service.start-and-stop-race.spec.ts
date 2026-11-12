// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

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
import { TimerService } from './timer.service';

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
}

const time = (value: Date | string | null): number => new Date(value).getTime();

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
 * A `TimerService` over `rows`, on the given ORM, with its real start and stop. The repositories answer from the
 * table. The cleanup runs through the real `ScheduleTimeLogEntriesHandler`, whose pending-log query (raw SQL, knex)
 * is replaced by the same predicate over the table: every log of the employee running with a `stoppedAt`, or with
 * none, whatever the command names. `TimeLogUpdateCommand` writes its input on the row; the rest of it (time slots,
 * timesheet, worked hours) is the handler's and does not run here. `TimeLogCreateCommand` adds a run. The conflict
 * lookup returns the other logs overlapping the range, with their time slots.
 */
function createService(
	ormType: MultiORMEnum,
	ids: { tenantId: string; organizationId: string },
	rows: TimeLogRow[],
	hooks: Hooks = {}
) {
	const employee: EmployeeStatus = { isOnline: true, isTrackingTime: true };
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
			getPendingTimeLogs: async (tenantId: string, organizationId: string, employeeId: string) =>
				rows
					.filter(
						(row) =>
							row.tenantId === tenantId &&
							row.organizationId === organizationId &&
							row.employeeId === employeeId &&
							((row.stoppedAt !== null && row.isRunning) || row.stoppedAt === null)
					)
					.map((row) => ({ ...row, timeSlots: row.timeSlots ?? [] }))
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
			id: EMPLOYEE_ID,
			organizationId: ids.organizationId,
			tenantId: ids.tenantId,
			isTrackingEnabled: true
		})),
		_employeeService: {
			update: jest.fn(async (_employeeId: string, status: EmployeeStatus) => Object.assign(employee, status))
		},
		_commandBus: { execute }
	});

	return { service, employee, updates, timeSpanDeletes, logger };
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
