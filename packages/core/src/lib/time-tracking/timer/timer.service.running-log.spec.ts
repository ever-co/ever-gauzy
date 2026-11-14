// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { DatabaseTypeEnum, defineConfig } from '@gauzy/config';
import {
	ITimeLog,
	ITimerStatus,
	ITimerStatusInput,
	ITimerToggleInput,
	TimeLogSourceEnum,
	TimeLogType
} from '@gauzy/contracts';
import { FindOperator } from 'typeorm';
import { TimeLog } from '../../core/entities/internal';
import { MultiORMEnum } from '../../core/utils';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { IGetConflictTimeLogCommand, TimeLogCreateCommand, TimeLogUpdateCommand } from '../time-log/commands';
import { ScheduleTimeLogEntriesCommand } from '../time-log/commands/schedule-time-log-entries.command';
import { ScheduleTimeLogEntriesHandler } from '../time-log/commands/handlers/schedule-time-log-entries.handler';
import { TimerService } from './timer.service';

/**
 * A running time log could be stored with `isRunning: true` and a null `stoppedAt` (`TimeLogCreateHandler` gave a
 * desktop-source log `isRunning: true` by default, and `IntegrationMapSyncTimeLogHandler` passes its entity as-is),
 * while the status read (`getTimerStatus`) and stop / toggle (`getRunningLogs`) both asked for `stoppedAt IS NOT
 * NULL`. Such a row ran with neither read seeing it: the status said "stopped", toggle started a second timer
 * beside it, and nothing stopped it. New rows get `stoppedAt = startedAt` at create (time-log-create.handler.spec.ts);
 * the reads now agree on "running" as `isRunning`, whatever `stoppedAt` holds, so a row stored before still shows.
 *
 * The repositories answer from an in-memory table and apply the `where` each ORM path builds.
 */

const EMPLOYEE_ID = 'employee-1';
const TODAY_START = '2026-10-24T00:00:00.000Z';
const TODAY_END = '2026-10-24T23:59:59.999Z';
const NOW = new Date('2026-10-24T02:00:00.000Z');

const HOUR = 3600;

interface TimeLogRow {
	id: string;
	employeeId: string;
	tenantId: string;
	organizationId: string;
	source: TimeLogSourceEnum;
	isActive: boolean;
	isArchived: boolean;
	isRunning: boolean;
	startedAt: Date;
	stoppedAt: Date | null;
	createdAt: Date;
	duration: number;
}

const time = (value: unknown): number => new Date(value as Date).getTime();

/** Applies a TypeORM `where` (plain values, `Between`, `LessThanOrEqual` / `MoreThanOrEqual`, `Not(IsNull())`). */
function matchesTypeOrmWhere(row: TimeLogRow, where: Record<string, unknown>): boolean {
	return Object.entries(where).every(([key, condition]) => {
		const value = row[key as keyof TimeLogRow];
		if (condition instanceof FindOperator) {
			switch (condition.type) {
				case 'between': {
					const [from, to] = condition.value as unknown as Date[];
					return time(value) >= time(from) && time(value) <= time(to);
				}
				// A null column matches neither, as in SQL (the completed-logs query may use them for its day window).
				case 'lessThanOrEqual':
					return value !== null && value !== undefined && time(value) <= time(condition.value);
				case 'moreThanOrEqual':
					return value !== null && value !== undefined && time(value) >= time(condition.value);
				case 'not':
					if (condition.child?.type === 'isNull') {
						return value !== null && value !== undefined;
					}
					return value !== condition.value;
				default:
					throw new Error(`Unexpected TypeORM operator "${condition.type}" on ${key}`);
			}
		}
		return value === condition;
	});
}

/** Applies a MikroORM `where` (plain values, `$gte` / `$lte`, `$ne`) to a row. */
function matchesMikroOrmWhere(row: TimeLogRow, where: Record<string, unknown>): boolean {
	return Object.entries(where).every(([key, condition]) => {
		const value = row[key as keyof TimeLogRow];
		if (condition !== null && typeof condition === 'object' && !(condition instanceof Date)) {
			return Object.entries(condition).every(([operator, operand]) => {
				switch (operator) {
					// A null column matches neither, as in SQL.
					case '$gte':
						return value !== null && value !== undefined && time(value) >= time(operand);
					case '$lte':
						return value !== null && value !== undefined && time(value) <= time(operand);
					case '$ne':
						return operand === null ? value !== null && value !== undefined : value !== operand;
					default:
						throw new Error(`Unexpected MikroORM operator "${operator}" on ${key}`);
				}
			});
		}
		return value === condition;
	});
}

/** The rows by `startedAt DESC, createdAt DESC`, the order every running-log query asks for. */
function latestFirst(rows: TimeLogRow[]): TimeLogRow[] {
	return [...rows].sort((a, b) => time(b.startedAt) - time(a.startedAt) || time(b.createdAt) - time(a.createdAt));
}

/** A MikroORM-loaded row: `wrapSerialize` calls its `toJSON`. */
const loaded = (row: TimeLogRow) => ({ ...row, toJSON: () => ({ ...row }) });

/** A `TimerService` whose repositories read `rows`, on the given ORM, with `startTimer` / `stopTimer` stubbed. */
function createService(ormType: MultiORMEnum, rows: TimeLogRow[], organizationId: string) {
	const typeOrmTimeLogRepository = {
		metadata: undefined,
		createQueryBuilder: () => {
			let where: Record<string, unknown> = {};
			const builder = {
				setFindOptions: (options: { where: Record<string, unknown> }) => {
					where = options.where;
					return builder;
				},
				innerJoin: () => builder,
				getMany: async () => rows.filter((row) => matchesTypeOrmWhere(row, where))
			};
			return builder;
		},
		find: async ({ where }: { where: Record<string, unknown> }) =>
			latestFirst(rows.filter((row) => matchesTypeOrmWhere(row, where))),
		findOne: async ({ where }: { where: Record<string, unknown> }) =>
			latestFirst(rows.filter((row) => matchesTypeOrmWhere(row, where)))[0] ?? null
	};

	const mikroOrmTimeLogRepository = {
		findAll: async ({ where }: { where: Record<string, unknown> }) =>
			latestFirst(rows.filter((row) => matchesMikroOrmWhere(row, where))).map(loaded),
		findOne: async (where: Record<string, unknown>) => {
			const row = latestFirst(rows.filter((candidate) => matchesMikroOrmWhere(candidate, where)))[0];
			return row ? loaded(row) : null;
		}
	};

	const startTimer = jest.fn(async () => ({ id: 'started' }) as ITimeLog);
	const stopTimer = jest.fn(async () => ({ id: 'stopped' }) as ITimeLog);

	const service: TimerService = Object.assign(Object.create(TimerService.prototype), {
		ormType,
		typeOrmTimeLogRepository,
		mikroOrmTimeLogRepository,
		fetchEmployee: jest.fn().mockResolvedValue({ id: EMPLOYEE_ID }),
		findEmployee: jest.fn().mockResolvedValue({ id: EMPLOYEE_ID, organizationId }),
		startTimer,
		stopTimer
	});

	return { service, startTimer, stopTimer };
}

/** A time slot of a log, as the cleanup reads it. */
interface TimeSlotRow {
	startedAt: Date;
	duration: number;
}

/** The time log an update is for: it names it by id, or hands the log itself (`TimeLogUpdateHandler` takes both). */
const logIdOf = (command: TimeLogUpdateCommand): string =>
	(typeof command.id === 'string' ? command.id : command.id.id) as string;

/**
 * Wires the previous-timers cleanup as it runs: `stopPreviousRunningTimers` dispatches `ScheduleTimeLogEntriesCommand`
 * to the real `ScheduleTimeLogEntriesHandler`, whose writes (either ORM) land on `rows`. Only its pending-log query
 * (raw SQL on TypeORM, knex on MikroORM) is replaced, by the same predicate over `rows`: the employee's logs that
 * run with a `stoppedAt`, or have none — each with the time slots `timeSlots` gives it.
 *
 * @returns The service's logger, whose `warn` reports a cleanup failure `stopPreviousRunningTimers` swallowed.
 */
function wireCleanup(
	service: TimerService,
	ormType: MultiORMEnum,
	rows: TimeLogRow[],
	timeSlots: Record<string, TimeSlotRow[]> = {}
) {
	const write = (partial: Partial<TimeLogRow> & { id: string }) => {
		const row = rows.find((candidate) => candidate.id === partial.id);
		if (!row) {
			throw new Error(`No time log "${partial.id}"`);
		}
		return Object.assign(row, partial);
	};

	const handler: ScheduleTimeLogEntriesHandler = Object.assign(
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
					.map((row) => ({ ...row, timeSlots: timeSlots[row.id] ?? [] }))
		}
	);

	const logger = { debug: jest.fn(), warn: jest.fn() };
	Object.assign(service, {
		_commandBus: { execute: (command: ScheduleTimeLogEntriesCommand) => handler.execute(command) },
		logger
	});
	return logger;
}

/**
 * Wires the real start and stop over `rows`: the cleanup as `wireCleanup` wires it, and stand-ins for the other
 * commands they send. `TimeLogUpdateCommand`, the update an explicit stop makes, writes its input on the row, so these
 * specs check the command the service sends and its input. The rest of it (the web timer's time slots, the timesheet
 * and worked hours) is `TimeLogUpdateHandler`'s and does not run here; time-log-update.handler.spec.ts pins the parts
 * a replaced run relies on. `TimeLogCreateCommand` adds the new run; the stop's conflict lookup finds none. The
 * running logs carry their `timeSlots` only when the query asks for them, as each ORM loads a relation.
 *
 * @returns The service's logger and the `TimeLogUpdateCommand`s sent.
 */
function wireTimer(
	service: TimerService,
	ormType: MultiORMEnum,
	rows: TimeLogRow[],
	timeSlots: Record<string, TimeSlotRow[]> = {}
) {
	const logger = wireCleanup(service, ormType, rows, timeSlots);
	const cleanupBus = (service as unknown as { _commandBus: { execute: (command: unknown) => Promise<unknown> } })
		._commandBus;
	const updates: TimeLogUpdateCommand[] = [];

	const slotsOf = (row: TimeLogRow) => timeSlots[row.id] ?? [];
	const repositories = service as unknown as {
		typeOrmTimeLogRepository: { find: (options: { relations?: { timeSlots?: boolean } }) => Promise<TimeLogRow[]> };
		mikroOrmTimeLogRepository: {
			findAll: (options: { populate?: string[] }) => Promise<{ toJSON: () => TimeLogRow }[]>;
		};
	};
	const typeOrmFind = repositories.typeOrmTimeLogRepository.find;
	repositories.typeOrmTimeLogRepository.find = async (options) => {
		const found = await typeOrmFind(options);
		return options.relations?.timeSlots ? found.map((row) => ({ ...row, timeSlots: slotsOf(row) })) : found;
	};
	const mikroOrmFindAll = repositories.mikroOrmTimeLogRepository.findAll;
	repositories.mikroOrmTimeLogRepository.findAll = async (options) => {
		const found = await mikroOrmFindAll(options);
		if (!options.populate?.includes('timeSlots')) {
			return found;
		}
		return found.map((entity) => {
			const row = entity.toJSON();
			return { toJSON: () => ({ ...row, timeSlots: slotsOf(row) }) };
		});
	};

	const execute = async (command: unknown) => {
		if (command instanceof TimeLogUpdateCommand) {
			updates.push(command);
			const row = rows.find((candidate) => candidate.id === logIdOf(command));
			if (!row) {
				throw new Error(`No time log "${logIdOf(command)}"`);
			}
			return Object.assign(row, command.input);
		}
		if (command instanceof TimeLogCreateCommand) {
			const row = {
				...command.input,
				id: 'new-run',
				createdAt: command.input.startedAt
			} as unknown as TimeLogRow;
			rows.push(row);
			return row;
		}
		if (command instanceof IGetConflictTimeLogCommand) {
			return [];
		}
		return cleanupBus.execute(command);
	};

	Object.assign(service, {
		_commandBus: { execute },
		_employeeService: { update: jest.fn(async () => undefined) },
		startTimer: TimerService.prototype.startTimer,
		stopTimer: TimerService.prototype.stopTimer
	});
	return { logger, updates };
}

describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])(
	'TimerService running log with a null stoppedAt (%s)',
	(ormType) => {
		const fixture = createTenantFixture();

		/** A time log of the employee, active and not archived unless `overrides` say otherwise. */
		const timeLog = (overrides: Partial<TimeLogRow> & Pick<TimeLogRow, 'id' | 'startedAt' | 'stoppedAt'>) =>
			({
				employeeId: EMPLOYEE_ID,
				tenantId: fixture.tenantId,
				organizationId: fixture.organizationId,
				source: TimeLogSourceEnum.DESKTOP,
				isActive: true,
				isArchived: false,
				isRunning: false,
				createdAt: overrides.startedAt,
				duration: overrides.stoppedAt ? (time(overrides.stoppedAt) - time(overrides.startedAt)) / 1000 : 0,
				...overrides
			}) as TimeLogRow;

		/** The row the bug left behind: running, no `stoppedAt`. */
		const runningWithoutStoppedAt = () =>
			timeLog({
				id: 'running-without-stopped-at',
				isRunning: true,
				startedAt: new Date('2026-10-24T01:00:00.000Z'),
				stoppedAt: null
			});

		const setup = (rows: TimeLogRow[]) => createService(ormType, rows, fixture.organizationId);

		const getTimerStatus = (service: TimerService): Promise<ITimerStatus> =>
			service.getTimerStatus({
				tenantId: fixture.tenantId,
				organizationId: fixture.organizationId,
				todayStart: TODAY_START,
				todayEnd: TODAY_END
			} as unknown as ITimerStatusInput);

		let restore: () => void;

		beforeAll(() => defineConfig({ dbConnectionOptions: { type: DatabaseTypeEnum.postgres } }));

		beforeEach(() => {
			({ restore } = asTenantUser(fixture));
			jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
		});

		afterEach(() => {
			restore();
			jest.restoreAllMocks();
		});

		it('CONTROL: the row is the shape the old `stoppedAt IS NOT NULL` filter dropped', () => {
			const row = runningWithoutStoppedAt();
			expect(row.isRunning).toBe(true);
			expect(row.stoppedAt).toBeNull();
		});

		it('status reads it as the running log, counting its time since it started', async () => {
			const { service } = setup([runningWithoutStoppedAt()]);

			const status = await getTimerStatus(service);

			expect(status.running).toBe(true);
			expect(status.lastLog).toMatchObject({ id: 'running-without-stopped-at', isRunning: true });
			// 01:00 to 02:00
			expect(status.duration).toBe(HOUR);
		});

		it('stop finds the same log the status shows as running', async () => {
			const { service } = setup([runningWithoutStoppedAt()]);

			const status = await getTimerStatus(service);
			const lastRunningLog = await (service as any).getLastRunningLog(true);

			expect(lastRunningLog).toMatchObject({ id: status.lastLog.id });
		});

		it('toggle stops it instead of starting a second timer beside it', async () => {
			const { service, startTimer, stopTimer } = setup([runningWithoutStoppedAt()]);

			await service.toggleTimeLog({} as ITimerToggleInput);

			expect(stopTimer).toHaveBeenCalledTimes(1);
			expect(startTimer).not.toHaveBeenCalled();
		});

		it('hands it to the previous-timers cleanup, which runs before a new timer starts', async () => {
			const { service } = setup([runningWithoutStoppedAt()]);

			const logs = await (service as any).getLastRunningLogs();

			expect(logs.map((log: ITimeLog) => log.id)).toEqual(['running-without-stopped-at']);
		});

		describe('the previous-timers cleanup, run through ScheduleTimeLogEntriesHandler', () => {
			/** Runs the cleanup that precedes a new timer, over `rows`. */
			const cleanUp = async (rows: TimeLogRow[], timeSlots: Record<string, TimeSlotRow[]> = {}) => {
				const { service } = setup(rows);
				const logger = wireCleanup(service, ormType, rows, timeSlots);
				jest.spyOn(console, 'log').mockImplementation(() => undefined);

				await service.stopPreviousRunningTimers(EMPLOYEE_ID, fixture.organizationId, fixture.tenantId);

				expect(logger.warn).not.toHaveBeenCalled();
			};

			it('stops a log started minutes ago with no time slot, ending it where it started', async () => {
				const recent = timeLog({
					id: 'recent-without-stopped-at',
					isRunning: true,
					startedAt: new Date('2026-10-24T01:55:00.000Z'),
					stoppedAt: null
				});
				const rows = [recent];

				await cleanUp(rows);

				// Not left stopped with a null end, whose loaded duration would run up to now.
				expect(rows[0]).toMatchObject({
					isRunning: false,
					stoppedAt: new Date('2026-10-24T01:55:00.000Z')
				});
			});

			it('ends a log with recent time slots where its time slots end', async () => {
				const recentWithSlot = timeLog({
					id: 'recent-with-slot',
					isRunning: true,
					startedAt: new Date('2026-10-24T01:50:00.000Z'),
					stoppedAt: null
				});
				const rows = [recentWithSlot];

				await cleanUp(rows, {
					'recent-with-slot': [{ startedAt: new Date('2026-10-24T01:50:00.000Z'), duration: 300 }]
				});

				expect(rows[0]).toMatchObject({
					isRunning: false,
					stoppedAt: new Date('2026-10-24T01:55:00.000Z')
				});
			});

			it('keeps the ten-second end it gives a log started over ten minutes ago with no time slot', async () => {
				const rows = [runningWithoutStoppedAt()];

				await cleanUp(rows);

				expect(rows[0]).toMatchObject({
					isRunning: false,
					stoppedAt: new Date('2026-10-24T01:00:10.000Z')
				});
			});

			it('keeps the stoppedAt of a running log written by the timer', async () => {
				const runningFromTimer = timeLog({
					id: 'running-from-timer',
					isRunning: true,
					startedAt: new Date('2026-10-24T01:55:00.000Z'),
					stoppedAt: new Date('2026-10-24T01:58:00.000Z')
				});
				const rows = [runningFromTimer];

				await cleanUp(rows);

				expect(rows[0]).toMatchObject({
					isRunning: false,
					stoppedAt: new Date('2026-10-24T01:58:00.000Z')
				});
			});
		});

		it('keeps reading a running log written by the timer, with its stoppedAt', async () => {
			const runningFromTimer = timeLog({
				id: 'running-from-timer',
				isRunning: true,
				startedAt: new Date('2026-10-24T01:30:00.000Z'),
				stoppedAt: new Date('2026-10-24T01:59:00.000Z')
			});
			const { service } = setup([runningFromTimer]);

			const status = await getTimerStatus(service);
			const lastRunningLog = await (service as any).getLastRunningLog();

			expect(status.running).toBe(true);
			expect(status.lastLog).toMatchObject({ id: 'running-from-timer' });
			expect(lastRunningLog).toMatchObject({ id: 'running-from-timer' });
		});

		it('still finds no running log when every log is stopped, and toggle starts a timer', async () => {
			const stopped = timeLog({
				id: 'stopped-today',
				startedAt: new Date('2026-10-24T00:30:00.000Z'),
				stoppedAt: new Date('2026-10-24T01:00:00.000Z')
			});
			const { service, startTimer, stopTimer } = setup([stopped]);

			expect(await (service as any).getLastRunningLog()).toBeNull();
			expect((await getTimerStatus(service)).running).toBe(false);

			await service.toggleTimeLog({} as ITimerToggleInput);

			expect(startTimer).toHaveBeenCalledTimes(1);
			expect(stopTimer).not.toHaveBeenCalled();
		});

		it("does not read another employee's running log", async () => {
			const teammate = timeLog({
				id: 'teammate-running',
				employeeId: 'employee-2',
				isRunning: true,
				startedAt: new Date('2026-10-24T01:00:00.000Z'),
				stoppedAt: null
			});
			const { service } = setup([teammate]);

			expect(await (service as any).getLastRunningLog()).toBeNull();
			expect((await getTimerStatus(service)).running).toBe(false);
		});
	}
);

/**
 * A start ended the runs still going the way the desktop's runs end: ten seconds after their start when they had no
 * time slot and started over ten minutes ago, or where their time slots added up to, and without the update an
 * explicit stop makes, so a web timer or Ever Teams run lost its hours. A run from a client that is not a tracker now
 * ends through that update: at its last heartbeat (its `stoppedAt`, which the time slots its client posts move
 * forward), or where the new run starts when it never had one. A desktop run keeps the end its time slots give it.
 */
describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])(
	'TimerService ending the runs a new run replaces (%s)',
	(ormType) => {
		const fixture = createTenantFixture();
		const TWO_HOURS_AGO = new Date('2026-10-24T00:00:00.000Z');
		const ONE_HOUR_AGO = new Date('2026-10-24T01:00:00.000Z');

		/** Three ten-minute time slots from 00:00: a run with them ends at 00:30 by its time slots. */
		const threeSlots: TimeSlotRow[] = [0, 10, 20].map((minute) => ({
			startedAt: new Date(TWO_HOURS_AGO.getTime() + minute * 60 * 1000),
			duration: 600
		}));

		/**
		 * A run of the employee, as a timer start writes it: running, its `stoppedAt` at its start until a heartbeat
		 * moves it to `lastHeartbeat`.
		 */
		const run = (
			id: string,
			source: TimeLogSourceEnum,
			startedAt: Date,
			lastHeartbeat: Date | null = startedAt
		): TimeLogRow => ({
			id,
			employeeId: EMPLOYEE_ID,
			tenantId: fixture.tenantId,
			organizationId: fixture.organizationId,
			source,
			isActive: true,
			isArchived: false,
			isRunning: true,
			startedAt,
			stoppedAt: lastHeartbeat,
			createdAt: startedAt,
			duration: 0
		});

		/** The service over `rows` with its real start and stop, for an employee whose tracking is on. */
		const setup = (rows: TimeLogRow[], timeSlots: Record<string, TimeSlotRow[]> = {}) => {
			const { service } = createService(ormType, rows, fixture.organizationId);
			const { logger, updates } = wireTimer(service, ormType, rows, timeSlots);
			const employee = { id: EMPLOYEE_ID, organizationId: fixture.organizationId, isTrackingEnabled: true };
			Object.assign(service, { findEmployee: jest.fn().mockResolvedValue(employee) });
			jest.spyOn(console, 'log').mockImplementation(() => undefined);
			return { service, logger, updates };
		};

		/** The employee moves to the desktop app and starts its timer, at `startedAt` when the start names one. */
		const startOnDesktop = (service: TimerService, startedAt?: Date): Promise<ITimeLog> =>
			service.startTimer({
				source: TimeLogSourceEnum.DESKTOP,
				...(startedAt ? { startedAt } : {})
			} as ITimerToggleInput);

		let restore: () => void;

		beforeAll(() => defineConfig({ dbConnectionOptions: { type: DatabaseTypeEnum.postgres } }));

		beforeEach(() => {
			({ restore } = asTenantUser(fixture));
			jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
		});

		afterEach(() => {
			restore();
			jest.restoreAllMocks();
		});

		it('ends a web timer run started two hours ago, which sends no heartbeat, where the new run starts, as a stop would', async () => {
			const rows = [run('replaced', TimeLogSourceEnum.WEB_TIMER, TWO_HOURS_AGO)];
			const { service, logger, updates } = setup(rows);

			const started = await startOnDesktop(service);

			// 02:00, where the new run starts, not 00:00:10
			expect(started.startedAt).toEqual(NOW);
			expect(rows[0]).toMatchObject({ isRunning: false, stoppedAt: NOW });
			expect(updates).toEqual([
				expect.objectContaining({
					id: 'replaced',
					input: { isRunning: false, startedAt: TWO_HOURS_AGO, stoppedAt: NOW }
				})
			]);
			expect(logger.warn).not.toHaveBeenCalled();
		});

		it.each([TimeLogSourceEnum.TEAMS, TimeLogSourceEnum.MOBILE])(
			'ends a %s run that never had a heartbeat at its own start: its client died before the first one',
			async (source) => {
				const rows = [run('replaced', source, TWO_HOURS_AGO)];
				const { service, logger, updates } = setup(rows);

				const started = await startOnDesktop(service);

				// 00:00, not 02:00: a tab that died in its first minute is not credited the two hours up to the new start
				expect(started.startedAt).toEqual(NOW);
				expect(rows[0]).toMatchObject({ isRunning: false, stoppedAt: TWO_HOURS_AGO });
				expect(updates).toEqual([
					expect.objectContaining({
						id: 'replaced',
						input: { isRunning: false, startedAt: TWO_HOURS_AGO, stoppedAt: TWO_HOURS_AGO }
					})
				]);
				expect(logger.warn).not.toHaveBeenCalled();
			}
		);

		it.each([TimeLogSourceEnum.TEAMS, TimeLogSourceEnum.MOBILE, TimeLogSourceEnum.WEB_TIMER])(
			'ends a %s break where the new run starts: a break has no heartbeat, whatever its client',
			async (source) => {
				const rows = [run('replaced', source, TWO_HOURS_AGO)];
				Object.assign(rows[0], { logType: TimeLogType.BREAK });
				const { service } = setup(rows);

				await startOnDesktop(service);

				// 02:00, where work starts again, not 00:00 as for a run whose client died before its first heartbeat
				expect(rows[0]).toMatchObject({ isRunning: false, stoppedAt: NOW });
			}
		);

		it('ends a break at its own start when the new run is named to start before it', async () => {
			const rows = [run('replaced', TimeLogSourceEnum.TEAMS, TWO_HOURS_AGO)];
			Object.assign(rows[0], { logType: TimeLogType.BREAK });
			const { service } = setup(rows);

			await startOnDesktop(service, new Date(TWO_HOURS_AGO.getTime() - 60_000));

			expect(rows[0]).toMatchObject({ isRunning: false, stoppedAt: TWO_HOURS_AGO });
		});

		it('ends it at the start the new run names', async () => {
			const rows = [run('replaced', TimeLogSourceEnum.WEB_TIMER, TWO_HOURS_AGO)];
			const { service } = setup(rows);
			const namedStart = new Date('2026-10-24T01:45:00.000Z');

			await startOnDesktop(service, namedStart);

			expect(rows[0]).toMatchObject({ isRunning: false, stoppedAt: namedStart });
		});

		it('names the start of a run from last week, which keeps it in that week of the timesheet', async () => {
			const lastWeek = new Date('2026-10-17T09:00:00.000Z');
			const rows = [run('replaced', TimeLogSourceEnum.WEB_TIMER, lastWeek)];
			const { service, updates } = setup(rows);

			await startOnDesktop(service);

			// An update naming no start files the log under the week of now (`TimesheetFirstOrCreateCommand`)
			expect(updates).toEqual([
				expect.objectContaining({
					id: 'replaced',
					input: { isRunning: false, startedAt: lastWeek, stoppedAt: NOW }
				})
			]);
			expect(rows[0]).toMatchObject({ isRunning: false, startedAt: lastWeek, stoppedAt: NOW });
		});

		it('ends an Ever Teams run at its last heartbeat, not where its time slots add up to nor at the new start', async () => {
			const lastHeartbeat = new Date('2026-10-24T01:58:00.000Z');
			const rows = [run('replaced', TimeLogSourceEnum.TEAMS, TWO_HOURS_AGO, lastHeartbeat)];
			const { service, logger, updates } = setup(rows, { replaced: threeSlots });

			await startOnDesktop(service);

			// 01:58, not 00:30 where its slots add up to, nor 02:00
			expect(rows[0]).toMatchObject({ isRunning: false, stoppedAt: lastHeartbeat });
			expect(updates).toEqual([
				expect.objectContaining({
					id: 'replaced',
					input: { isRunning: false, startedAt: TWO_HOURS_AGO, stoppedAt: lastHeartbeat }
				})
			]);
			expect(logger.warn).not.toHaveBeenCalled();
		});

		it('leaves an Ever Teams run abandoned at 00:30 there, not credited up to a start at 02:00', async () => {
			const abandonedAt = new Date('2026-10-24T00:30:00.000Z');
			const rows = [run('replaced', TimeLogSourceEnum.TEAMS, TWO_HOURS_AGO, abandonedAt)];
			const { service } = setup(rows, { replaced: threeSlots });

			await startOnDesktop(service);

			expect(rows[0]).toMatchObject({ isRunning: false, stoppedAt: abandonedAt });
		});

		it('never ends a run after the start the new run names', async () => {
			const rows = [
				run('replaced', TimeLogSourceEnum.TEAMS, TWO_HOURS_AGO, new Date('2026-10-24T01:58:00.000Z'))
			];
			const { service } = setup(rows, { replaced: threeSlots });
			const namedStart = new Date('2026-10-24T01:45:00.000Z');

			await startOnDesktop(service, namedStart);

			expect(rows[0]).toMatchObject({ isRunning: false, stoppedAt: namedStart });
		});

		it('ends a run with time slots where its last slot ends when its stoppedAt never moved, not at the new start', async () => {
			const rows = [run('replaced', TimeLogSourceEnum.TEAMS, TWO_HOURS_AGO)];
			const { service } = setup(rows, { replaced: threeSlots });

			await startOnDesktop(service);

			// Its time slots say it had heartbeats: 00:30, where its last slot ends, not 00:00 nor 02:00
			expect(rows[0]).toMatchObject({ isRunning: false, stoppedAt: new Date('2026-10-24T00:30:00.000Z') });
		});

		it('ends each run still going no later than the next one started, so no time counts twice', async () => {
			const rows = [
				run('first', TimeLogSourceEnum.TEAMS, TWO_HOURS_AGO, new Date('2026-10-24T01:30:00.000Z')),
				run('second', TimeLogSourceEnum.WEB_TIMER, ONE_HOUR_AGO)
			];
			const { service } = setup(rows);

			await startOnDesktop(service);

			// The first one's heartbeats went on past 01:00, when the second one started
			expect(rows[0]).toMatchObject({ isRunning: false, stoppedAt: ONE_HOUR_AGO });
			expect(rows[1]).toMatchObject({ isRunning: false, stoppedAt: NOW });
		});

		it('never ends a run before its own start, when the new run names an earlier start', async () => {
			const startedAfter = new Date('2026-10-24T01:50:00.000Z');
			const rows = [run('replaced', TimeLogSourceEnum.WEB_TIMER, startedAfter)];
			const { service } = setup(rows);

			await startOnDesktop(service, new Date('2026-10-24T01:40:00.000Z'));

			expect(rows[0]).toMatchObject({ isRunning: false, stoppedAt: startedAfter });
		});

		it('leaves a run stored without a stoppedAt to the cleanup, as before', async () => {
			const rows = [run('replaced', TimeLogSourceEnum.WEB_TIMER, ONE_HOUR_AGO, null)];
			const { service, updates } = setup(rows);

			await startOnDesktop(service);

			// No heartbeat to go by: the cleanup's end, ten seconds after its start, not 02:00
			expect(rows[0]).toMatchObject({ isRunning: false, stoppedAt: new Date('2026-10-24T01:00:10.000Z') });
			expect(updates).toEqual([]);
		});

		it('ends a run left going beside the one a stop ends where that one started', async () => {
			const rows = [
				run('left-going', TimeLogSourceEnum.WEB_TIMER, TWO_HOURS_AGO),
				run('stopped', TimeLogSourceEnum.TEAMS, ONE_HOUR_AGO)
			];
			const { service, logger } = setup(rows);

			await service.stopTimer({ stoppedAt: NOW } as ITimerToggleInput);

			expect(rows[1]).toMatchObject({ isRunning: false, stoppedAt: NOW });
			// 01:00, where the stopped run started: not 00:00:10, nor 02:00 over the stopped run's hour
			expect(rows[0]).toMatchObject({ isRunning: false, stoppedAt: ONE_HOUR_AGO });
			expect(logger.warn).not.toHaveBeenCalled();
		});

		it('ends a run left going beside the one a stop ends at its last heartbeat, when it had one', async () => {
			const lastHeartbeat = new Date('2026-10-24T00:40:00.000Z');
			const rows = [
				run('left-going', TimeLogSourceEnum.TEAMS, TWO_HOURS_AGO, lastHeartbeat),
				run('stopped', TimeLogSourceEnum.WEB_TIMER, ONE_HOUR_AGO)
			];
			const { service } = setup(rows);

			await service.stopTimer({ stoppedAt: NOW } as ITimerToggleInput);

			expect(rows[1]).toMatchObject({ isRunning: false, stoppedAt: NOW });
			expect(rows[0]).toMatchObject({ isRunning: false, stoppedAt: lastHeartbeat });
		});

		describe('when the update of a replaced run fails', () => {
			/**
			 * Makes the first `failures` updates of the run `id` fail. With `afterWrite`, each writes the stop first and
			 * then fails, as a later step of the update (time slots, timesheet, worked hours) would; without, it fails
			 * before writing anything. Any other update runs whole, so the updates the harness records are the ones that
			 * completed, derived records included.
			 *
			 * @returns The updates of the run that were tried.
			 */
			const failUpdatesOf = (
				service: TimerService,
				rows: TimeLogRow[],
				id: string,
				{ failures, afterWrite }: { failures: number; afterWrite: boolean }
			) => {
				const bus = (service as unknown as { _commandBus: { execute: (command: unknown) => Promise<unknown> } })
					._commandBus;
				const execute = bus.execute;
				const tried: TimeLogUpdateCommand[] = [];
				bus.execute = async (command: unknown) => {
					const isUpdateOfRun = command instanceof TimeLogUpdateCommand && logIdOf(command) === id;
					if (!isUpdateOfRun) {
						return execute(command);
					}
					tried.push(command);
					if (tried.length > failures) {
						return execute(command);
					}
					const row = rows.find((candidate) => candidate.id === id);
					if (afterWrite && row) {
						Object.assign(row, command.input);
					}
					throw new Error('the time slots could not be created');
				};
				return tried;
			};

			it('completes the update with a second try when a later step failed after the stop was written', async () => {
				const rows = [run('replaced', TimeLogSourceEnum.WEB_TIMER, TWO_HOURS_AGO)];
				const { service, logger, updates } = setup(rows);
				const tried = failUpdatesOf(service, rows, 'replaced', { failures: 1, afterWrite: true });

				await startOnDesktop(service);

				const stop = { isRunning: false, startedAt: TWO_HOURS_AGO, stoppedAt: NOW };
				expect(tried.map((command) => command.input)).toEqual([stop, stop]);
				// The second try ran whole: its time slots, timesheet and worked hours are done
				expect(updates.map((command) => [logIdOf(command), command.input])).toEqual([['replaced', stop]]);
				expect(rows[0]).toMatchObject({ isRunning: false, stoppedAt: NOW });
				expect(logger.warn).toHaveBeenCalledWith(
					expect.stringContaining('Completed the stop of the replaced time log replaced on a second try')
				);
			});

			it('keeps the stop when the second try fails too, and says what may be missing', async () => {
				const rows = [run('replaced', TimeLogSourceEnum.WEB_TIMER, TWO_HOURS_AGO)];
				const { service, logger, updates } = setup(rows);
				const tried = failUpdatesOf(service, rows, 'replaced', { failures: 2, afterWrite: true });

				await startOnDesktop(service);

				expect(tried).toHaveLength(2);
				expect(updates).toEqual([]);
				// Not ended again by the cleanup, at 00:00:10
				expect(rows[0]).toMatchObject({ isRunning: false, stoppedAt: NOW });
				expect(logger.warn).toHaveBeenCalledWith(
					expect.stringContaining('Stopped the replaced time log replaced, but its time slots or totals')
				);
			});

			it('gives the second try the run as it was, so a run cut back still has its slots past the new end released', async () => {
				const lastHeartbeat = new Date('2026-10-24T01:58:00.000Z');
				const rows = [run('replaced', TimeLogSourceEnum.TEAMS, TWO_HOURS_AGO, lastHeartbeat)];
				const { service } = setup(rows);
				const tried = failUpdatesOf(service, rows, 'replaced', { failures: 1, afterWrite: true });
				const namedStart = new Date('2026-10-24T01:45:00.000Z');

				await startOnDesktop(service, namedStart);

				// Both tries cut the run back from 01:58 to 01:45, where the new run starts
				const cut = { isRunning: false, startedAt: TWO_HOURS_AGO, stoppedAt: namedStart };
				expect(tried.map((command) => command.input)).toEqual([cut, cut]);
				// The first names the run, read with its range of then. The second comes after that range was written, so it
				// hands over the run as it was: the update plans from it the release of the slots past 01:45
				// (time-log-update.handler.spec.ts), which a read of the stored, cut range no longer gives.
				expect(tried[0].id).toBe('replaced');
				expect(tried[1].id).toBeInstanceOf(TimeLog);
				expect(tried[1].id).toMatchObject({
					id: 'replaced',
					startedAt: TWO_HOURS_AGO,
					stoppedAt: lastHeartbeat
				});
			});

			it('sends the update once more when the first failed before writing, so the run is not cut to ten seconds', async () => {
				const rows = [run('replaced', TimeLogSourceEnum.WEB_TIMER, TWO_HOURS_AGO)];
				const { service, logger, updates } = setup(rows);
				const tried = failUpdatesOf(service, rows, 'replaced', { failures: 1, afterWrite: false });

				await startOnDesktop(service);

				const stop = { isRunning: false, startedAt: TWO_HOURS_AGO, stoppedAt: NOW };
				expect(tried.map((command) => command.input)).toEqual([stop, stop]);
				expect(updates.map((command) => [logIdOf(command), command.input])).toEqual([['replaced', stop]]);
				expect(rows[0]).toMatchObject({ isRunning: false, stoppedAt: NOW });
				expect(logger.warn).toHaveBeenCalledWith(
					expect.stringContaining('Stopped the replaced time log replaced on a second try')
				);
			});

			it('leaves a run neither try stopped to the cleanup, which stops it as before', async () => {
				const rows = [run('replaced', TimeLogSourceEnum.WEB_TIMER, TWO_HOURS_AGO)];
				const { service, logger } = setup(rows);
				const tried = failUpdatesOf(service, rows, 'replaced', { failures: 2, afterWrite: false });

				await startOnDesktop(service);

				expect(tried).toHaveLength(2);
				expect(rows[0]).toMatchObject({ isRunning: false, stoppedAt: new Date('2026-10-24T00:00:10.000Z') });
				expect(logger.warn).toHaveBeenCalledWith(
					expect.stringContaining(
						'Failed to stop the replaced time log replaced on a second try, left to the cleanup'
					)
				);
			});
		});

		describe('a desktop run, as before', () => {
			it('keeps the ten-second end of one started two hours ago with no time slot', async () => {
				const rows = [run('replaced', TimeLogSourceEnum.DESKTOP, TWO_HOURS_AGO)];
				const { service, updates } = setup(rows);

				await startOnDesktop(service);

				expect(rows[0]).toMatchObject({ isRunning: false, stoppedAt: new Date('2026-10-24T00:00:10.000Z') });
				expect(updates).toEqual([]);
			});

			it('keeps the end its time slots give it', async () => {
				const rows = [run('replaced', TimeLogSourceEnum.DESKTOP, TWO_HOURS_AGO)];
				const { service, updates } = setup(rows, { replaced: threeSlots });

				await startOnDesktop(service);

				expect(rows[0]).toMatchObject({ isRunning: false, stoppedAt: new Date('2026-10-24T00:30:00.000Z') });
				expect(updates).toEqual([]);
			});
		});
	}
);
