// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ITimeLog, TimeLogSourceEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { MultiORMEnum } from '../../core/utils';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TimesheetRecalculateCommand } from '../timesheet/commands';
import {
	IGetConflictTimeLogCommand,
	TimeLogUpdateCommand,
	UpdateEmployeeTotalWorkedHoursCommand
} from '../time-log/commands';
import { TimeSlotBulkCreateCommand } from '../time-slot/commands/time-slot-bulk-create.command';
import {
	TIMER_NOT_RUNNING,
	TIMER_START_MANUAL_NOT_ALLOWED,
	TIMER_START_OVERLAP,
	TIMER_START_TRACKER_RUN
} from './timer-start-move-rule';
import { TimerService } from './timer.service';

/**
 * Marie starts work at 9:00 and clicks Start at 9:25. The timer moves its running log's start, earlier or later,
 * under the rules of time changed by hand; the log stays one log and keeps running.
 *
 * The repositories answer from an in-memory table of time logs and a list of the running log's slot links; the
 * command bus applies the update to its row, answers the conflicts of a range from the table, and creates the slots
 * it is asked for.
 */

const EMPLOYEE_ID = 'employee-1';
const NOW = new Date('2026-11-16T10:00:00.000Z');
const RUNNING_SINCE = new Date('2026-11-16T09:25:00.000Z');
const RUNNING_LOG_ID = '00000000-0000-4000-8000-0000000000aa';
const EARLIER_LOG_ID = '00000000-0000-4000-8000-000000000010';
const TIMESHEET_ID = 'timesheet-1';

interface TimeLogRow {
	id: string;
	employeeId: string;
	tenantId: string;
	organizationId: string;
	timesheetId: string;
	source: TimeLogSourceEnum;
	isRunning: boolean;
	startedAt: Date;
	stoppedAt: Date;
	createdAt: Date;
	editedAt?: Date;
	reason?: string;
}

const time = (value: Date): number => new Date(value).getTime();

function findRows(rows: TimeLogRow[], where: Record<string, unknown>): TimeLogRow[] {
	return rows
		.filter((row) => Object.entries(where).every(([key, value]) => row[key as keyof TimeLogRow] === value))
		.sort((a, b) => time(b.startedAt) - time(a.startedAt) || time(b.createdAt) - time(a.createdAt));
}

interface Organization {
	allowManualTime: boolean;
	allowModifyTime: boolean;
	requireReason: boolean;
}

function createService(ormType: MultiORMEnum, rows: TimeLogRow[], employee: Record<string, unknown>) {
	const linkedSlotIds: string[] = [];
	const relation = {
		loadMany: jest.fn(async () => linkedSlotIds.map((id) => ({ id }))),
		add: jest.fn(async (ids: string[]) => {
			linkedSlotIds.push(...ids);
		})
	};
	const typeOrmTimeLogRepository = {
		findOne: async ({ where }: { where: Record<string, unknown> }) => findRows(rows, where)[0] ?? null,
		findOneBy: async (where: Record<string, unknown>) => {
			const row = findRows(rows, where)[0];
			return row ? { ...row } : null;
		},
		manager: { createQueryBuilder: () => ({ relation: () => ({ of: () => relation }) }) }
	};
	const mikroOrmTimeLogRepository = {
		findOne: async (where: Record<string, unknown>) => {
			const row = findRows(rows, where)[0];
			return row ? { ...row, toJSON: () => ({ ...row }) } : null;
		}
	};
	const execute = jest.fn(async (command: unknown) => {
		if (command instanceof TimeLogUpdateCommand) {
			const row = rows.find((candidate) => candidate.id === command.id);
			Object.assign(row, command.input);
			return { ...row };
		}
		if (command instanceof IGetConflictTimeLogCommand) {
			const { startDate, endDate, ignoreId } = command.input;
			return rows.filter(
				(row) =>
					row.id !== ignoreId &&
					time(row.startedAt) < time(endDate as Date) &&
					time(row.stoppedAt) > time(startDate as Date)
			);
		}
		if (command instanceof TimeSlotBulkCreateCommand) {
			return command.slots.map((slot) => ({ ...slot, id: `slot-${new Date(slot.startedAt).toISOString()}` }));
		}
		return undefined;
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
	Object.assign(service, { ormType });

	const commandsOf = <T>(type: new (...args: never[]) => T): T[] =>
		execute.mock.calls.map(([command]) => command).filter((command): command is T => command instanceof type);

	return { service, execute, relation, linkedSlotIds, commandsOf };
}

describe.each([MultiORMEnum.TypeORM, MultiORMEnum.MikroORM])(
	'TimerService moves the start of the running timer (%s)',
	(ormType) => {
		const fixture = createTenantFixture();
		const openOrganization: Organization = { allowManualTime: true, allowModifyTime: true, requireReason: false };

		const employeeIn = (organization: Organization, overrides: Record<string, unknown> = {}) => ({
			id: EMPLOYEE_ID,
			organizationId: fixture.organizationId,
			tenantId: fixture.tenantId,
			isTrackingEnabled: true,
			organization,
			...overrides
		});

		const timeLog = (overrides: Partial<TimeLogRow> & Pick<TimeLogRow, 'id' | 'startedAt' | 'stoppedAt'>) => ({
			employeeId: EMPLOYEE_ID,
			tenantId: fixture.tenantId,
			organizationId: fixture.organizationId,
			timesheetId: TIMESHEET_ID,
			source: TimeLogSourceEnum.TEAMS,
			isRunning: false,
			createdAt: overrides.startedAt,
			...overrides
		});

		/** Marie's run, started at 9:25 from Ever Teams; its last heartbeat was at 9:50. */
		const runningLog = (overrides: Partial<TimeLogRow> = {}): TimeLogRow =>
			timeLog({
				id: RUNNING_LOG_ID,
				isRunning: true,
				startedAt: RUNNING_SINCE,
				stoppedAt: new Date('2026-11-16T09:50:00.000Z'),
				...overrides
			});

		/** An entry of hers from 8:30 to 9:10. */
		const earlierEntry = (): TimeLogRow =>
			timeLog({
				id: EARLIER_LOG_ID,
				startedAt: new Date('2026-11-16T08:30:00.000Z'),
				stoppedAt: new Date('2026-11-16T09:10:00.000Z')
			});

		let restore: () => void;

		beforeEach(() => {
			({ restore } = asTenantUser(fixture));
			jest.spyOn(RequestContext, 'hasRoles').mockReturnValue(false);
			jest.spyOn(Date, 'now').mockReturnValue(NOW.getTime());
		});

		afterEach(() => {
			restore();
			jest.restoreAllMocks();
		});

		it('moves the start to 9:00: one entry, still running, marked edited with the reason', async () => {
			const rows = [runningLog()];
			const { service, commandsOf } = createService(ormType, rows, employeeIn(openOrganization));

			const moved = await service.moveRunningTimerStart({
				startedAt: new Date('2026-11-16T09:00:00.000Z'),
				reason: 'Forgot to start timer'
			});

			expect(rows).toHaveLength(1);
			expect(moved).toMatchObject({ id: RUNNING_LOG_ID, isRunning: true });
			expect(new Date(moved.startedAt).toISOString()).toBe('2026-11-16T09:00:00.000Z');
			expect(rows[0]).toMatchObject({ reason: 'Forgot to start timer', isRunning: true });
			expect(rows[0].editedAt).toEqual(NOW);
			const [update] = commandsOf(TimeLogUpdateCommand);
			expect(update.id).toBe(RUNNING_LOG_ID);
			expect(update.input).not.toHaveProperty('stoppedAt');
		});

		it('gives the 25 added minutes their slots, without activity, and links them to the run', async () => {
			const rows = [runningLog()];
			const { service, commandsOf, linkedSlotIds } = createService(ormType, rows, employeeIn(openOrganization));

			await service.moveRunningTimerStart({ startedAt: new Date('2026-11-16T09:00:00.000Z') });

			const [bulk] = commandsOf(TimeSlotBulkCreateCommand);
			expect(bulk.slots.map((slot) => new Date(slot.startedAt).toISOString())).toEqual([
				'2026-11-16T09:00:00.000Z',
				'2026-11-16T09:10:00.000Z',
				'2026-11-16T09:20:00.000Z'
			]);
			expect(bulk.slots.map((slot) => slot.duration)).toEqual([600, 600, 300]);
			for (const slot of bulk.slots) {
				expect(slot).toMatchObject({ keyboard: 0, mouse: 0, overall: 0, timeLogId: RUNNING_LOG_ID });
			}
			expect(linkedSlotIds).toEqual([
				'slot-2026-11-16T09:00:00.000Z',
				'slot-2026-11-16T09:10:00.000Z',
				'slot-2026-11-16T09:20:00.000Z'
			]);
			expect(commandsOf(TimesheetRecalculateCommand).map((command) => command.id)).toEqual([TIMESHEET_ID]);
			expect(commandsOf(UpdateEmployeeTotalWorkedHoursCommand)).toHaveLength(1);
		});

		it('does not link twice a slot the time log update already gave the run', async () => {
			const rows = [runningLog()];
			const { service, relation, linkedSlotIds } = createService(ormType, rows, employeeIn(openOrganization));
			linkedSlotIds.push(
				'slot-2026-11-16T09:00:00.000Z',
				'slot-2026-11-16T09:10:00.000Z',
				'slot-2026-11-16T09:20:00.000Z'
			);

			await service.moveRunningTimerStart({ startedAt: new Date('2026-11-16T09:00:00.000Z') });

			expect(relation.add).not.toHaveBeenCalled();
		});

		it('refuses a start overlapping the entry that ends at 9:10, and the timer keeps its 9:25 start', async () => {
			const rows = [earlierEntry(), runningLog()];
			const { service, commandsOf } = createService(ormType, rows, employeeIn(openOrganization));

			const move = service.moveRunningTimerStart({ startedAt: new Date('2026-11-16T09:00:00.000Z') });

			await expect(move).rejects.toBeInstanceOf(ConflictException);
			await move.catch((error: ConflictException) => {
				expect(error.getResponse()).toMatchObject({
					code: TIMER_START_OVERLAP,
					overlapsUntil: '2026-11-16T09:10:00.000Z'
				});
			});
			expect(commandsOf(TimeLogUpdateCommand)).toHaveLength(0);
			expect(commandsOf(TimeSlotBulkCreateCommand)).toHaveLength(0);
			expect(rows[1].startedAt).toEqual(RUNNING_SINCE);
		});

		it('accepts a start at 9:10, when the earlier entry ends', async () => {
			const rows = [earlierEntry(), runningLog()];
			const { service } = createService(ormType, rows, employeeIn(openOrganization));

			const moved = await service.moveRunningTimerStart({ startedAt: new Date('2026-11-16T09:10:00.000Z') });

			expect(new Date(moved.startedAt).toISOString()).toBe('2026-11-16T09:10:00.000Z');
		});

		it('moves the start later through the time log update, which releases the slots before it, and adds none', async () => {
			const rows = [runningLog()];
			const { service, commandsOf } = createService(ormType, rows, employeeIn(openOrganization));

			const moved = await service.moveRunningTimerStart({ startedAt: new Date('2026-11-16T09:40:00.000Z') });

			expect(new Date(moved.startedAt).toISOString()).toBe('2026-11-16T09:40:00.000Z');
			expect(commandsOf(TimeLogUpdateCommand)[0].input).not.toHaveProperty('stoppedAt');
			expect(commandsOf(IGetConflictTimeLogCommand)).toHaveLength(0);
			expect(commandsOf(TimeSlotBulkCreateCommand)).toHaveLength(0);
		});

		it('keeps the range of a run moved past its last heartbeat whole: its end becomes now', async () => {
			const rows = [runningLog()];
			const { service, commandsOf } = createService(ormType, rows, employeeIn(openOrganization));

			await service.moveRunningTimerStart({ startedAt: new Date('2026-11-16T09:55:00.000Z') });

			expect(commandsOf(TimeLogUpdateCommand)[0].input).toMatchObject({ stoppedAt: NOW });
		});

		it('answers 400 when no timer runs, and writes nothing', async () => {
			const rows = [earlierEntry()];
			const { service, execute } = createService(ormType, rows, employeeIn(openOrganization));

			const move = service.moveRunningTimerStart({ startedAt: new Date('2026-11-16T09:00:00.000Z') });

			await expect(move).rejects.toBeInstanceOf(BadRequestException);
			await move.catch((error: BadRequestException) => {
				expect(error.getResponse()).toMatchObject({ code: TIMER_NOT_RUNNING });
			});
			expect(execute).not.toHaveBeenCalled();
		});

		it('answers 409 for a run of the desktop app, and writes nothing', async () => {
			const rows = [runningLog({ source: TimeLogSourceEnum.DESKTOP })];
			const { service, execute } = createService(ormType, rows, employeeIn(openOrganization));

			const move = service.moveRunningTimerStart({ startedAt: new Date('2026-11-16T09:00:00.000Z') });

			await expect(move).rejects.toBeInstanceOf(ConflictException);
			await move.catch((error: ConflictException) => {
				expect(error.getResponse()).toMatchObject({ code: TIMER_START_TRACKER_RUN });
			});
			expect(execute).not.toHaveBeenCalled();
		});

		it('refuses an earlier start where manual time is off, and lets a later one through', async () => {
			const organization = { ...openOrganization, allowManualTime: false };

			const earlier = createService(ormType, [runningLog()], employeeIn(organization));
			const refused = earlier.service.moveRunningTimerStart({ startedAt: new Date('2026-11-16T09:00:00.000Z') });
			await expect(refused).rejects.toBeInstanceOf(ForbiddenException);
			await refused.catch((error: ForbiddenException) => {
				expect(error.getResponse()).toMatchObject({ code: TIMER_START_MANUAL_NOT_ALLOWED });
			});
			expect(earlier.execute).not.toHaveBeenCalled();

			const later = createService(ormType, [runningLog()], employeeIn(organization));
			const moved = await later.service.moveRunningTimerStart({
				startedAt: new Date('2026-11-16T09:40:00.000Z')
			});
			expect(new Date(moved.startedAt).toISOString()).toBe('2026-11-16T09:40:00.000Z');
		});

		it('refuses any move while tracking is turned off for the employee', async () => {
			const { service, execute } = createService(
				ormType,
				[runningLog()],
				employeeIn(openOrganization, { isTrackingEnabled: false })
			);

			await expect(
				service.moveRunningTimerStart({ startedAt: new Date('2026-11-16T09:40:00.000Z') })
			).rejects.toBeInstanceOf(ForbiddenException);
			expect(execute).not.toHaveBeenCalled();
		});

		it('answers the running log as it is for the start it already has, and marks nothing edited', async () => {
			const rows = [runningLog()];
			const { service, execute } = createService(ormType, rows, employeeIn(openOrganization));

			const answer: ITimeLog = await service.moveRunningTimerStart({ startedAt: new Date(RUNNING_SINCE) });

			expect(answer).toMatchObject({ id: RUNNING_LOG_ID });
			expect(execute).not.toHaveBeenCalled();
			expect(rows[0].editedAt).toBeUndefined();
		});
	}
);
