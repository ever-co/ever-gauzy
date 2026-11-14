// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { ConflictException, NotAcceptableException } from '@nestjs/common';
import { ITimeLog, ITimerToggleInput, TimeLogSourceEnum } from '@gauzy/contracts';
import { MultiORMEnum } from '../../core/utils';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TimeLogUpdateCommand } from '../time-log/commands';
import { TimerService } from './timer.service';

/**
 * A stop did not say which run it was for: Gauzy stopped the employee's running log, so a stop from a view still
 * showing an earlier run (replaced since by a start on another device or tab) ended the newer one. A stop or a toggle
 * may now name the running time log it is for (`timeLogId`). Naming another log than the running one is refused with
 * 409 and nothing is written; a toggle naming a log never starts a timer in its place. Without an id, both behave as
 * before.
 *
 * The repositories answer from an in-memory table; the trailing cleanup (`stopPreviousRunningTimers`,
 * `handleConflictingTimeLogs`) and the start are stubbed, so a refused stop can be seen to reach none of it.
 */

const EMPLOYEE_ID = 'employee-1';
const NOW = new Date('2026-11-12T11:30:00.000Z');
const FINISHED_LOG_ID = '00000000-0000-4000-8000-000000000010';
const RUNNING_LOG_ID = '00000000-0000-4000-8000-0000000000aa';

interface TimeLogRow {
	id: string;
	employeeId: string;
	tenantId: string;
	organizationId: string;
	source: TimeLogSourceEnum;
	isRunning: boolean;
	startedAt: Date;
	stoppedAt: Date;
	createdAt: Date;
}

const time = (value: Date): number => new Date(value).getTime();

/** The rows matching a plain `where`, by `startedAt DESC, createdAt DESC` as the running-log query orders them. */
function findRows(rows: TimeLogRow[], where: Record<string, unknown>): TimeLogRow[] {
	return rows
		.filter((row) => Object.entries(where).every(([key, value]) => row[key as keyof TimeLogRow] === value))
		.sort((a, b) => time(b.startedAt) - time(a.startedAt) || time(b.createdAt) - time(a.createdAt));
}

/** The update a stop sent: its read of the logs the run overlaps comes before it. */
function sentUpdate(execute: jest.Mock): TimeLogUpdateCommand {
	return execute.mock.calls.map(([command]) => command).find((command) => command instanceof TimeLogUpdateCommand);
}

/** A `TimerService` over `rows`, on the given ORM, whose command bus applies a `TimeLogUpdateCommand` to its row. */
function createService(ormType: MultiORMEnum, rows: TimeLogRow[], employee: Record<string, string>) {
	const typeOrmTimeLogRepository = {
		findOne: async ({ where }: { where: Record<string, unknown> }) => findRows(rows, where)[0] ?? null,
		// A stop reads every run going as it begins, latest first (`getLastRunningLogs`)
		find: async ({ where }: { where: Record<string, unknown> }) => findRows(rows, where)
	};
	const mikroOrmTimeLogRepository = {
		findOne: async (where: Record<string, unknown>) => {
			const row = findRows(rows, where)[0];
			// A MikroORM-loaded row: `wrapSerialize` calls its `toJSON`
			return row ? { ...row, toJSON: () => ({ ...row }) } : null;
		},
		findAll: async ({ where }: { where: Record<string, unknown> }) =>
			findRows(rows, where).map((row) => ({ ...row, toJSON: () => ({ ...row }) }))
	};
	const execute = jest.fn(async (command: unknown) => {
		if (command instanceof TimeLogUpdateCommand) {
			const row = rows.find((candidate) => candidate.id === command.id);
			Object.assign(row, command.input);
			return { ...row };
		}
		return [];
	});
	const employeeService = {
		findOneByUserId: jest.fn(async () => employee),
		update: jest.fn(async () => undefined)
	};

	const service = new TimerService(
		typeOrmTimeLogRepository as never,
		mikroOrmTimeLogRepository as never,
		undefined as never,
		undefined as never,
		employeeService as never,
		{ execute } as never,
		undefined as never
	);
	const startTimer = jest.fn(async () => ({ id: 'log-started' }) as ITimeLog);
	const stopPreviousRunningTimers = jest.fn(async () => undefined);
	const handleConflictingTimeLogs = jest.fn(async () => undefined);
	Object.assign(service, { ormType, startTimer, stopPreviousRunningTimers, handleConflictingTimeLogs });
	jest.spyOn((service as unknown as { logger: { warn: () => void } }).logger, 'warn').mockImplementation(
		() => undefined
	);

	return { service, execute, employeeService, startTimer, stopPreviousRunningTimers };
}

describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])(
	'TimerService stop and toggle naming the time log they are for (%s)',
	(ormType) => {
		const fixture = createTenantFixture();
		const employee = { id: EMPLOYEE_ID, organizationId: fixture.organizationId, tenantId: fixture.tenantId };

		const timeLog = (overrides: Partial<TimeLogRow> & Pick<TimeLogRow, 'id' | 'startedAt' | 'stoppedAt'>) => ({
			employeeId: EMPLOYEE_ID,
			tenantId: fixture.tenantId,
			organizationId: fixture.organizationId,
			source: TimeLogSourceEnum.TEAMS,
			isRunning: false,
			createdAt: overrides.startedAt,
			...overrides
		});

		/** The run a tab still shows: started at 09:00, ended at 10:00 when another device started a new one. */
		const finishedLog = (): TimeLogRow =>
			timeLog({
				id: FINISHED_LOG_ID,
				startedAt: new Date('2026-11-12T09:00:00.000Z'),
				stoppedAt: new Date('2026-11-12T10:00:00.000Z')
			});

		/** The run started on the other device at 10:30, still running. */
		const runningLog = (): TimeLogRow =>
			timeLog({
				id: RUNNING_LOG_ID,
				source: TimeLogSourceEnum.DESKTOP,
				isRunning: true,
				startedAt: new Date('2026-11-12T10:30:00.000Z'),
				stoppedAt: new Date('2026-11-12T10:30:00.000Z')
			});

		const setup = (rows: TimeLogRow[]) => createService(ormType, rows, employee);

		let restore: () => void;

		beforeEach(() => {
			({ restore } = asTenantUser(fixture));
			jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
		});

		afterEach(() => {
			restore();
			jest.restoreAllMocks();
		});

		describe('stop', () => {
			it('answers 409 to a stop naming a finished log, and leaves the running one as it is', async () => {
				const rows = [finishedLog(), runningLog()];
				const { service, execute, employeeService, stopPreviousRunningTimers } = setup(rows);

				const stop = service.stopTimer({ source: TimeLogSourceEnum.TEAMS, timeLogId: FINISHED_LOG_ID });

				await expect(stop).rejects.toBeInstanceOf(ConflictException);
				expect(execute).not.toHaveBeenCalled();
				expect(employeeService.update).not.toHaveBeenCalled();
				expect(stopPreviousRunningTimers).not.toHaveBeenCalled();
				expect(rows[1]).toMatchObject({ isRunning: true, stoppedAt: new Date('2026-11-12T10:30:00.000Z') });
			});

			it('answers 409 to a stop naming an empty time log id, which GraphQL lets through, and stops nothing', async () => {
				const rows = [runningLog()];
				const { service, execute, employeeService } = setup(rows);

				const stop = service.stopTimer({ source: TimeLogSourceEnum.TEAMS, timeLogId: '' });

				await expect(stop).rejects.toBeInstanceOf(ConflictException);
				expect(execute).not.toHaveBeenCalled();
				expect(employeeService.update).not.toHaveBeenCalled();
				expect(rows[0]).toMatchObject({ isRunning: true });
			});

			it('stops the running log the stop names', async () => {
				const rows = [finishedLog(), runningLog()];
				const { service, execute } = setup(rows);

				const stopped = await service.stopTimer({ source: TimeLogSourceEnum.TEAMS, timeLogId: RUNNING_LOG_ID });

				const update = sentUpdate(execute);
				expect(update).toBeInstanceOf(TimeLogUpdateCommand);
				expect(update.id).toBe(RUNNING_LOG_ID);
				expect(update.input).toEqual({ isRunning: false, stoppedAt: NOW });
				expect(stopped).toMatchObject({ id: RUNNING_LOG_ID, isRunning: false });
			});

			it('takes the id of the running log in upper case as that log', async () => {
				const rows = [runningLog()];
				const { service, execute } = setup(rows);

				await service.stopTimer({ source: TimeLogSourceEnum.TEAMS, timeLogId: RUNNING_LOG_ID.toUpperCase() });

				expect(sentUpdate(execute).id).toBe(RUNNING_LOG_ID);
			});

			it('stops the running log when the stop names none, as before', async () => {
				const rows = [finishedLog(), runningLog()];
				const { service, execute } = setup(rows);

				await service.stopTimer({ source: TimeLogSourceEnum.TEAMS });

				const update = sentUpdate(execute);
				expect(update.id).toBe(RUNNING_LOG_ID);
				expect(update.input).toEqual({ isRunning: false, stoppedAt: NOW });
			});

			it('takes a null time log id as no id, and stops the running log as before', async () => {
				const rows = [runningLog()];
				const { service, execute } = setup(rows);

				await service.stopTimer({ source: TimeLogSourceEnum.TEAMS, timeLogId: null } as ITimerToggleInput);

				expect(sentUpdate(execute).id).toBe(RUNNING_LOG_ID);
			});

			it('still answers 406 when nothing runs, whether or not the stop names a log', async () => {
				const rows = [finishedLog()];
				const { service, execute } = setup(rows);

				await expect(
					service.stopTimer({ source: TimeLogSourceEnum.TEAMS, timeLogId: FINISHED_LOG_ID })
				).rejects.toBeInstanceOf(NotAcceptableException);
				await expect(service.stopTimer({ source: TimeLogSourceEnum.TEAMS })).rejects.toBeInstanceOf(
					NotAcceptableException
				);
				expect(execute).not.toHaveBeenCalled();
			});
		});

		describe('toggle', () => {
			const toggle = (service: TimerService, input: ITimerToggleInput) => service.toggleTimeLog(input);

			it('answers 409 to a toggle naming a finished log while another runs, starting and stopping nothing', async () => {
				const rows = [finishedLog(), runningLog()];
				const { service, execute, startTimer } = setup(rows);

				await expect(
					toggle(service, { source: TimeLogSourceEnum.TEAMS, timeLogId: FINISHED_LOG_ID })
				).rejects.toBeInstanceOf(ConflictException);
				expect(execute).not.toHaveBeenCalled();
				expect(startTimer).not.toHaveBeenCalled();
				expect(rows[1]).toMatchObject({ isRunning: true });
			});

			it('answers 406 to a toggle naming a log when nothing runs, and starts no timer in its place', async () => {
				const rows = [finishedLog()];
				const { service, execute, startTimer } = setup(rows);

				await expect(
					toggle(service, { source: TimeLogSourceEnum.TEAMS, timeLogId: FINISHED_LOG_ID })
				).rejects.toBeInstanceOf(NotAcceptableException);
				expect(startTimer).not.toHaveBeenCalled();
				expect(execute).not.toHaveBeenCalled();
			});

			it('answers 406 to a toggle naming an empty time log id when nothing runs, and starts no timer', async () => {
				const rows = [finishedLog()];
				const { service, execute, startTimer } = setup(rows);

				await expect(
					toggle(service, { source: TimeLogSourceEnum.TEAMS, timeLogId: '' })
				).rejects.toBeInstanceOf(NotAcceptableException);
				expect(startTimer).not.toHaveBeenCalled();
				expect(execute).not.toHaveBeenCalled();
			});

			it('answers 409 to a toggle naming an empty time log id while a log runs, and stops nothing', async () => {
				const rows = [runningLog()];
				const { service, execute, startTimer } = setup(rows);

				await expect(
					toggle(service, { source: TimeLogSourceEnum.TEAMS, timeLogId: '' })
				).rejects.toBeInstanceOf(ConflictException);
				expect(execute).not.toHaveBeenCalled();
				expect(startTimer).not.toHaveBeenCalled();
				expect(rows[0]).toMatchObject({ isRunning: true });
			});

			it('stops the running log a toggle names', async () => {
				const rows = [runningLog()];
				const { service, execute, startTimer } = setup(rows);

				await toggle(service, { source: TimeLogSourceEnum.TEAMS, timeLogId: RUNNING_LOG_ID });

				expect(sentUpdate(execute).id).toBe(RUNNING_LOG_ID);
				expect(startTimer).not.toHaveBeenCalled();
			});

			it('starts a timer when the toggle names no log and nothing runs, as before', async () => {
				const rows = [finishedLog()];
				const { service, startTimer } = setup(rows);
				const input = { source: TimeLogSourceEnum.TEAMS };

				await toggle(service, input);

				expect(startTimer).toHaveBeenCalledWith(input);
			});
		});
	}
);
