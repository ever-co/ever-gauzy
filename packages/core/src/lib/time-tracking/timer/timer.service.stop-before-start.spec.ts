// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { NotAcceptableException } from '@nestjs/common';
import { ITimeSlot, ITimerToggleInput, TimeLogSourceEnum } from '@gauzy/contracts';
import { MultiORMEnum } from '../../core/utils';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TimeLogUpdateCommand } from '../time-log/commands';
import { TimerService } from './timer.service';

/**
 * A stop from a view still showing an earlier run (a start on another device or tab has replaced it since) carries
 * that run's dates, and Gauzy stopped the employee's running log whatever the stop said: the newer run was closed, at
 * zero duration when the stop's date was before its start. A stop asking for a time before the running log started is
 * now refused with 406, as a stop with nothing running is, and nothing is written.
 *
 * The repositories answer from an in-memory table; the trailing cleanup (`stopPreviousRunningTimers`,
 * `handleConflictingTimeLogs`) is stubbed, so a refused stop can be seen to reach none of it.
 */

const EMPLOYEE_ID = 'employee-1';
const NOW = new Date('2026-11-12T11:30:00.000Z');

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
	timeSlots: Partial<ITimeSlot>[];
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
	const stopPreviousRunningTimers = jest.fn(async () => undefined);
	const handleConflictingTimeLogs = jest.fn(async () => undefined);
	Object.assign(service, { ormType, stopPreviousRunningTimers, handleConflictingTimeLogs });
	jest.spyOn((service as unknown as { logger: { warn: () => void } }).logger, 'warn').mockImplementation(
		() => undefined
	);

	return { service, execute, employeeService, stopPreviousRunningTimers, handleConflictingTimeLogs };
}

/** A stop body as a REST client sends it, its dates as ISO strings. */
const stopBody = (body: Record<string, unknown>) => body as unknown as ITimerToggleInput;

describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])(
	'TimerService.stopTimer with a stoppedAt before the running log started (%s)',
	(ormType) => {
		const fixture = createTenantFixture();
		const employee = { id: EMPLOYEE_ID, organizationId: fixture.organizationId, tenantId: fixture.tenantId };

		/** The run another device started at 10:30, still running. */
		const runningSince1030 = (): TimeLogRow => ({
			id: 'log-running',
			employeeId: EMPLOYEE_ID,
			tenantId: fixture.tenantId,
			organizationId: fixture.organizationId,
			source: TimeLogSourceEnum.DESKTOP,
			isRunning: true,
			startedAt: new Date('2026-11-12T10:30:00.000Z'),
			stoppedAt: new Date('2026-11-12T10:30:00.000Z'),
			createdAt: new Date('2026-11-12T10:30:00.000Z'),
			timeSlots: []
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

		it('answers 406 to a stop at 10:00 and leaves the log running since 10:30 as it is', async () => {
			const rows = [runningSince1030()];
			const { service, execute, employeeService, stopPreviousRunningTimers, handleConflictingTimeLogs } =
				setup(rows);

			// The dates of the earlier run, as a tab that still shows it sends them
			const stop = service.stopTimer(
				stopBody({
					source: TimeLogSourceEnum.TEAMS,
					startedAt: '2026-11-12T09:00:00.000Z',
					stoppedAt: '2026-11-12T10:00:00.000Z'
				})
			);

			await expect(stop).rejects.toBeInstanceOf(NotAcceptableException);
			expect(execute).not.toHaveBeenCalled();
			expect(employeeService.update).not.toHaveBeenCalled();
			expect(stopPreviousRunningTimers).not.toHaveBeenCalled();
			expect(handleConflictingTimeLogs).not.toHaveBeenCalled();
			expect(rows[0]).toMatchObject({ isRunning: true, stoppedAt: new Date('2026-11-12T10:30:00.000Z') });
		});

		it('stops the running log at the time asked when that time is after its start, as before', async () => {
			const rows = [runningSince1030()];
			const { service, execute, employeeService } = setup(rows);

			const stopped = await service.stopTimer(
				stopBody({
					source: TimeLogSourceEnum.TEAMS,
					startedAt: '2026-11-12T10:30:00.000Z',
					stoppedAt: '2026-11-12T11:00:00.000Z'
				})
			);

			const update = sentUpdate(execute);
			expect(update).toBeInstanceOf(TimeLogUpdateCommand);
			expect(update.id).toBe('log-running');
			expect(update.input).toEqual({ isRunning: false, stoppedAt: new Date('2026-11-12T11:00:00.000Z') });
			expect(stopped).toMatchObject({ id: 'log-running', isRunning: false });
			expect(employeeService.update).toHaveBeenCalledWith(EMPLOYEE_ID, {
				isOnline: false,
				isTrackingTime: false
			});
		});

		it('stops the running log now when the stop asks for no time, as before', async () => {
			const rows = [runningSince1030()];
			const { service, execute } = setup(rows);

			await service.stopTimer(stopBody({ source: TimeLogSourceEnum.TEAMS }));

			const update = sentUpdate(execute);
			expect(update.id).toBe('log-running');
			expect(update.input).toEqual({ isRunning: false, stoppedAt: NOW });
		});

		it('answers 406 to a stop naming no time when a start took the turn after it arrived, and the newer run goes on', async () => {
			const rows = [runningSince1030()];
			const { service, execute, employeeService, stopPreviousRunningTimers, handleConflictingTimeLogs } =
				setup(rows);
			// The stop arrives at 11:30 (NOW). While it looks up the employee, before it takes the employee's turn, a
			// start from another device gets the turn first: it stops the 10:30 run and begins one at 11:30:05.
			const newerRun: TimeLogRow = {
				...runningSince1030(),
				id: 'log-newer',
				source: TimeLogSourceEnum.WEB_TIMER,
				startedAt: new Date('2026-11-12T11:30:05.000Z'),
				stoppedAt: new Date('2026-11-12T11:30:05.000Z'),
				createdAt: new Date('2026-11-12T11:30:05.000Z')
			};
			employeeService.findOneByUserId.mockImplementationOnce(async () => {
				Object.assign(rows[0], { isRunning: false, stoppedAt: new Date('2026-11-12T11:30:05.000Z') });
				rows.push(newerRun);
				jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-11-12T11:30:06.000Z').getTime());
				return employee;
			});

			const stop = service.stopTimer(stopBody({ source: TimeLogSourceEnum.TEAMS }));

			await expect(stop).rejects.toBeInstanceOf(NotAcceptableException);
			expect(execute).not.toHaveBeenCalled();
			expect(employeeService.update).not.toHaveBeenCalled();
			expect(stopPreviousRunningTimers).not.toHaveBeenCalled();
			expect(handleConflictingTimeLogs).not.toHaveBeenCalled();
			expect(rows.find((row) => row.id === 'log-newer')).toMatchObject({
				isRunning: true,
				stoppedAt: new Date('2026-11-12T11:30:05.000Z')
			});
		});

		it('stops a run that started before a stop naming no time arrived, at the time it arrived', async () => {
			const rows = [runningSince1030()];
			const { service, execute, employeeService } = setup(rows);
			// The stop waits for its turn: by then it is 11:30:20, but it arrived at 11:30 (NOW)
			employeeService.findOneByUserId.mockImplementationOnce(async () => {
				jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-11-12T11:30:20.000Z').getTime());
				return employee;
			});

			await service.stopTimer(stopBody({ source: TimeLogSourceEnum.TEAMS }));

			const update = sentUpdate(execute);
			expect(update.id).toBe('log-running');
			expect(update.input).toEqual({ isRunning: false, stoppedAt: NOW });
		});

		it('still closes a desktop log whose time slots end before its start, keeping its stoppedAt', async () => {
			// Ten-minute slots: the log started at 10:03 sits in the 10:00 slot, which holds one minute of it.
			const desktopLog: TimeLogRow = {
				...runningSince1030(),
				startedAt: new Date('2026-11-12T10:03:00.000Z'),
				stoppedAt: new Date('2026-11-12T10:03:00.000Z'),
				createdAt: new Date('2026-11-12T10:03:00.000Z'),
				timeSlots: [{ startedAt: new Date('2026-11-12T10:00:00.000Z'), duration: 60 }]
			};
			const rows = [desktopLog];
			const { service, execute } = setup(rows);

			// The time asked is after the start; the end the slots give (10:01) is not, and is not written
			await service.stopTimer(
				stopBody({
					source: TimeLogSourceEnum.DESKTOP,
					startedAt: '2026-11-12T10:03:00.000Z',
					stoppedAt: '2026-11-12T11:00:00.000Z'
				})
			);

			const update = sentUpdate(execute);
			expect(update.id).toBe('log-running');
			expect(update.input).toEqual({ isRunning: false });
			expect(rows[0]).toMatchObject({ isRunning: false, stoppedAt: new Date('2026-11-12T10:03:00.000Z') });
		});
	}
);
