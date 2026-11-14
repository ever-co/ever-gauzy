// Must stay first: see timer.service.spec.ts.
import '../../core/entities/internal';

import { BadRequestException, ConflictException, ForbiddenException, RequestTimeoutException } from '@nestjs/common';
import * as moment from 'moment';
import { ITimeLog, PermissionsEnum, TimeLogSourceEnum } from '@gauzy/contracts';
import { RequestContext } from '../../core/context';
import { MultiORMEnum } from '../../core/utils';
import { asTenantUser, createTenantFixture } from '../../core/testing/tenant-isolation/tenant-isolation.fixtures';
import { TimesheetRecalculateCommand } from '../timesheet/commands';
import {
	IGetConflictTimeLogCommand,
	TimeLogUpdateCommand,
	UpdateEmployeeTotalWorkedHoursCommand
} from '../time-log/commands';
import {
	TIMER_NOT_RUNNING,
	TIMER_START_CHANGED,
	TIMER_START_EDIT_NOT_ALLOWED,
	TIMER_START_MANUAL_NOT_ALLOWED,
	TIMER_START_OVERLAP,
	TIMER_START_TRACKER_RUN
} from './timer-start-move-rule';
import { TimerService } from './timer.service';

/**
 * Marie starts work at 9:00 and clicks Start at 9:25. The timer moves its running log's start, earlier or later,
 * under the rules of time changed by hand; the log stays one log and keeps running.
 *
 * The repositories answer from an in-memory table of time logs and of the employee's time slots. The move is written
 * with a conditional update (the run must still run, from the start that was checked); the slot work runs in one
 * transaction whose writes apply only when it completes; the command bus answers the conflicts of a range from the
 * table and applies the time log update to its row.
 */

const EMPLOYEE_ID = 'employee-1';
const NOW = new Date('2026-11-16T10:00:00.000Z');
const RUNNING_SINCE = new Date('2026-11-16T09:25:00.000Z');
const RUNNING_LOG_ID = '00000000-0000-4000-8000-0000000000aa';
const EARLIER_LOG_ID = '00000000-0000-4000-8000-000000000010';
const TIMESHEET_ID = 'timesheet-1';
const PREVIOUS_WEEK_TIMESHEET_ID = 'timesheet-0';

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

interface SlotRow {
	id: string;
	startedAt: Date;
	duration: number;
	keyboard: number;
	/** The other entries holding it (the entry before the run, say), by id. */
	heldBy?: string[];
}

const time = (value: Date | string): number => new Date(value).getTime();
const at = (hhmm: string): Date => new Date(`2026-11-16T${hhmm}:00.000Z`);

/** A slot start as the database takes it: a Date, or on SQLite the UTC wall time as text. */
function instant(value: Date | string): Date {
	if (value instanceof Date) {
		return value;
	}
	return new Date(`${value.replace(' ', 'T')}Z`);
}

function findRows(rows: TimeLogRow[], where: Record<string, unknown>): TimeLogRow[] {
	const matches = (row: TimeLogRow, key: string, value: unknown) => {
		const stored = row[key as keyof TimeLogRow];
		if (value instanceof Date) {
			return stored instanceof Date && stored.getTime() === value.getTime();
		}
		return stored === value;
	};
	return rows
		.filter((row) => Object.entries(where).every(([key, value]) => matches(row, key, value)))
		.sort((a, b) => time(b.startedAt) - time(a.startedAt) || time(b.createdAt) - time(a.createdAt));
}

interface Organization {
	allowManualTime: boolean;
	allowModifyTime: boolean;
	requireReason: boolean;
}

interface Setup {
	/** The slots linked to the run before the move (a heartbeat's, say). */
	slots?: SlotRow[];
	/** Slots of her other entries, not linked to the run: a neighbour's, in a window both share. */
	neighbourSlots?: SlotRow[];
	/** A stop of the run that lands between the move's checks and its write. */
	stopLandsBeforeTheWrite?: boolean;
	/** Another move of the run's start that lands between this move's checks and its write. */
	startMovesBeforeTheWrite?: Date;
	/** The slot work fails while it links a slot. */
	slotLinkFails?: boolean;
	/** The timesheet the time log update files the run under. */
	timesheetAfterUpdate?: string;
}

function createService(
	ormType: MultiORMEnum,
	rows: TimeLogRow[],
	employee: Record<string, unknown>,
	setup: Setup = {}
) {
	const {
		slots = [],
		neighbourSlots = [],
		stopLandsBeforeTheWrite = false,
		startMovesBeforeTheWrite,
		slotLinkFails = false
	} = setup;
	/** Every slot of the employee, by id, and the ids of those linked to the run. */
	const pool = new Map<string, SlotRow>([...slots, ...neighbourSlots].map((slot) => [slot.id, { ...slot }]));
	const linked = new Set<string>(slots.map((slot) => slot.id));

	const relation = {
		loadMany: jest.fn(async () => [...linked].map((id) => ({ ...pool.get(id) })))
	};
	const transaction = jest.fn(async (work: (manager: unknown) => Promise<void>) => {
		// Writes made inside the transaction apply only when it completes
		const created: SlotRow[] = [];
		const links: string[] = [];
		const raised: Array<{ id: string; changes: Partial<SlotRow> }> = [];
		const manager = {
			findOne: async (_entity: unknown, { where }: { where: { id?: string; startedAt?: Date | string } }) => {
				const slot = [...pool.values(), ...created].find((candidate) => {
					if (where.id) {
						return candidate.id === where.id;
					}
					return time(candidate.startedAt) === instant(where.startedAt as Date | string).getTime();
				});
				if (!slot) {
					return null;
				}
				// With the entries holding it, as the relation `timeLogs` loads them
				const timeLogs = (slot.heldBy ?? []).map((id) => rows.find((row) => row.id === id)).filter(Boolean);
				return { ...slot, timeLogs };
			},
			create: (_entity: unknown, values: SlotRow) => ({ ...values }),
			save: async (values: Omit<SlotRow, 'startedAt'> & { startedAt: Date | string }) => {
				const startedAt = instant(values.startedAt);
				const slot = { ...values, startedAt, id: `slot-${startedAt.toISOString()}` };
				created.push(slot);
				return slot;
			},
			update: async (_entity: unknown, { id }: { id: string }, changes: Partial<SlotRow>) => {
				raised.push({ id, changes });
			},
			createQueryBuilder: () => ({
				relation: () => ({
					of: () => ({
						add: async (id: string) => {
							if (slotLinkFails) {
								throw new Error('connection lost');
							}
							links.push(id);
						}
					})
				})
			})
		};
		await work(manager);
		created.forEach((slot) => pool.set(slot.id, slot));
		links.forEach((id) => linked.add(id));
		raised.forEach(({ id, changes }) => Object.assign(pool.get(id), changes));
	});
	const typeOrmTimeLogRepository = {
		findOne: async ({ where }: { where: Record<string, unknown> }) => findRows(rows, where)[0] ?? null,
		findOneBy: async (where: Record<string, unknown>) => {
			const row = findRows(rows, where)[0];
			return row ? { ...row } : null;
		},
		update: jest.fn(async (where: Record<string, unknown>, changes: Partial<TimeLogRow>) => {
			if (stopLandsBeforeTheWrite) {
				rows.forEach((row) => Object.assign(row, { isRunning: false }));
			}
			if (startMovesBeforeTheWrite) {
				rows.forEach((row) => Object.assign(row, { startedAt: startMovesBeforeTheWrite }));
			}
			const matching = findRows(rows, where);
			matching.forEach((row) => Object.assign(row, changes));
			return { affected: matching.length };
		}),
		manager: {
			createQueryBuilder: () => ({ relation: () => ({ of: () => relation }) }),
			transaction
		}
	};
	const mikroOrmTimeLogRepository = {
		findOne: async (where: Record<string, unknown>) => {
			const row = findRows(rows, where)[0];
			return row ? { ...row, toJSON: () => ({ ...row }) } : null;
		}
	};
	const execute = jest.fn(async (command: unknown) => {
		if (command instanceof TimeLogUpdateCommand) {
			const id = typeof command.id === 'object' ? command.id.id : command.id;
			const row = rows.find((candidate) => candidate.id === id);
			Object.assign(
				row,
				command.input,
				setup.timesheetAfterUpdate ? { timesheetId: setup.timesheetAfterUpdate } : {}
			);
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
	const linkedSlots = () =>
		[...linked]
			.map((id) => pool.get(id))
			.sort((a, b) => time(a.startedAt) - time(b.startedAt))
			.map((slot) => `${new Date(slot.startedAt).toISOString().slice(11, 16)}:${slot.duration}:${slot.keyboard}`);

	return { service, execute, transaction, linkedSlots, commandsOf, typeOrmTimeLogRepository };
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
				stoppedAt: at('09:50'),
				...overrides
			});

		/** The slot of the run's first heartbeat: 9:20 to 9:30, holding its five minutes from 9:25, with activity. */
		const heartbeatSlot = (): SlotRow => ({
			id: 'heartbeat-0920',
			startedAt: at('09:20'),
			duration: 300,
			keyboard: 42
		});

		/** An entry of hers from 8:30 to 9:10. */
		const earlierEntry = (): TimeLogRow =>
			timeLog({
				id: EARLIER_LOG_ID,
				startedAt: at('08:30'),
				stoppedAt: at('09:10')
			});

		/** Her role may change tracked time and add time by hand, as the manual time routes require. */
		const timeEditingRole = [PermissionsEnum.ALLOW_MODIFY_TIME, PermissionsEnum.ALLOW_MANUAL_TIME];

		let restore: () => void;

		beforeEach(() => {
			({ restore } = asTenantUser(fixture, { permissions: timeEditingRole }));
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
				startedAt: at('09:00'),
				reason: 'Forgot to start timer'
			});

			expect(rows).toHaveLength(1);
			expect(moved).toMatchObject({ id: RUNNING_LOG_ID, isRunning: true });
			expect(new Date(moved.startedAt).toISOString()).toBe('2026-11-16T09:00:00.000Z');
			expect(rows[0]).toMatchObject({ reason: 'Forgot to start timer', isRunning: true });
			expect(rows[0].editedAt).toEqual(NOW);
			const [update] = commandsOf(TimeLogUpdateCommand);
			expect(update.input).not.toHaveProperty('stoppedAt');
		});

		it('writes the move only while the run still runs, and moves nothing when a stop lands first', async () => {
			const rows = [runningLog()];
			const { service, commandsOf, typeOrmTimeLogRepository } = createService(
				ormType,
				rows,
				employeeIn(openOrganization),
				{ stopLandsBeforeTheWrite: true }
			);

			const move = service.moveRunningTimerStart({ startedAt: at('09:40') });

			await expect(move).rejects.toBeInstanceOf(BadRequestException);
			await move.catch((error: BadRequestException) => {
				expect(error.getResponse()).toMatchObject({ code: TIMER_NOT_RUNNING });
			});
			expect(typeOrmTimeLogRepository.update).toHaveBeenCalledWith(
				expect.objectContaining({ id: RUNNING_LOG_ID, isRunning: true, startedAt: RUNNING_SINCE }),
				expect.objectContaining({ startedAt: at('09:40') })
			);
			expect(rows[0].startedAt).toEqual(RUNNING_SINCE);
			expect(commandsOf(TimeLogUpdateCommand)).toHaveLength(0);
		});

		it('refuses with 409 a move whose checked start another move changed meanwhile, and moves nothing', async () => {
			const rows = [runningLog()];
			const { service, commandsOf } = createService(ormType, rows, employeeIn(openOrganization), {
				startMovesBeforeTheWrite: at('09:50')
			});

			// Checked as a later start than 9:25; the other move to 9:50 makes it an earlier one, never checked as such
			const move = service.moveRunningTimerStart({ startedAt: at('09:40') });

			await expect(move).rejects.toBeInstanceOf(ConflictException);
			await move.catch((error: ConflictException) => {
				expect(error.getResponse()).toMatchObject({ code: TIMER_START_CHANGED });
			});
			expect(rows[0].startedAt).toEqual(at('09:50'));
			expect(commandsOf(TimeLogUpdateCommand)).toHaveLength(0);
		});

		it('lets the time log update make no slot of its own, and hands it the run as known until now', async () => {
			const rows = [runningLog()];
			const { service, commandsOf } = createService(ormType, rows, employeeIn(openOrganization));

			await service.moveRunningTimerStart({ startedAt: at('09:40') });

			const [update] = commandsOf(TimeLogUpdateCommand);
			expect(update.manualTimeSlot).toBe(true);
			expect(update.id).toMatchObject({ id: RUNNING_LOG_ID, startedAt: RUNNING_SINCE, stoppedAt: NOW });
		});

		it('recalculates the timesheet the run leaves when its start moves into another week', async () => {
			const rows = [runningLog()];
			const { service, commandsOf } = createService(ormType, rows, employeeIn(openOrganization), {
				timesheetAfterUpdate: PREVIOUS_WEEK_TIMESHEET_ID
			});

			await service.moveRunningTimerStart({ startedAt: at('09:00') });

			expect(commandsOf(TimesheetRecalculateCommand).map((command) => command.id)).toContain(TIMESHEET_ID);
		});

		it('gives a run without slots none: its stop fills its whole range, the added minutes included', async () => {
			const rows = [runningLog()];
			const { service, transaction, linkedSlots } = createService(ormType, rows, employeeIn(openOrganization));

			await service.moveRunningTimerStart({ startedAt: at('09:00') });

			expect(transaction).not.toHaveBeenCalled();
			expect(linkedSlots()).toEqual([]);
		});

		it('gives a run fed by heartbeats the slots of the 25 added minutes, without activity, keeping its own', async () => {
			const rows = [runningLog()];
			const { service, commandsOf, linkedSlots } = createService(ormType, rows, employeeIn(openOrganization), {
				slots: [heartbeatSlot()]
			});

			await service.moveRunningTimerStart({ startedAt: at('09:00') });

			// The heartbeat's slot keeps its activity and gains the five minutes from 9:20 to 9:25
			expect(linkedSlots()).toEqual(['09:00:600:0', '09:10:600:0', '09:20:600:42']);
			expect(commandsOf(TimesheetRecalculateCommand).map((command) => command.id)).toEqual([TIMESHEET_ID]);
			expect(commandsOf(UpdateEmployeeTotalWorkedHoursCommand)).toHaveLength(1);
		});

		it('writes the slot work in one transaction: a failure in it leaves the slots as they were', async () => {
			const rows = [runningLog()];
			const { service, linkedSlots } = createService(ormType, rows, employeeIn(openOrganization), {
				slots: [heartbeatSlot()],
				slotLinkFails: true
			});

			await expect(service.moveRunningTimerStart({ startedAt: at('09:00') })).rejects.toThrow('connection lost');

			expect(linkedSlots()).toEqual(['09:20:300:42']);
		});

		it('gives the slot it shares with the entry before it the seconds it adds there, keeping its activity', async () => {
			// Her entry from 8:30 to 9:01 holds 60 seconds of the 9:00 slot, with activity
			const entryUntil0901 = timeLog({ id: EARLIER_LOG_ID, startedAt: at('08:30'), stoppedAt: at('09:01') });
			const sharedSlot: SlotRow = {
				id: 'slot-0900',
				startedAt: at('09:00'),
				duration: 60,
				keyboard: 7,
				heldBy: [EARLIER_LOG_ID]
			};
			const rows = [entryUntil0901, runningLog()];
			const { service, linkedSlots } = createService(ormType, rows, employeeIn(openOrganization), {
				slots: [heartbeatSlot()],
				neighbourSlots: [sharedSlot]
			});

			await service.moveRunningTimerStart({ startedAt: at('09:01') });

			// The 9:00 slot keeps the entry's 60 seconds and its activity, and gains the run's 540 from 9:01
			expect(linkedSlots()).toEqual(['09:00:600:7', '09:10:600:0', '09:20:600:42']);
		});

		it('keeps the seconds of the entry before it in their shared slot over consecutive earlier moves', async () => {
			// Her entry from 8:30 to 9:04 holds 240 seconds of the 9:00 slot, with activity
			const entryUntil0904 = timeLog({ id: EARLIER_LOG_ID, startedAt: at('08:30'), stoppedAt: at('09:04') });
			const sharedSlot: SlotRow = {
				id: 'slot-0900',
				startedAt: at('09:00'),
				duration: 240,
				keyboard: 7,
				heldBy: [EARLIER_LOG_ID]
			};
			const rows = [entryUntil0904, runningLog()];
			const { service, linkedSlots } = createService(ormType, rows, employeeIn(openOrganization), {
				slots: [heartbeatSlot()],
				neighbourSlots: [sharedSlot]
			});

			await service.moveRunningTimerStart({ startedAt: at('09:08') });
			expect(linkedSlots()).toEqual(['09:00:360:7', '09:10:600:0', '09:20:600:42']);

			// 240 seconds of the entry and 240 of the run, from 9:06
			await service.moveRunningTimerStart({ startedAt: at('09:06') });
			expect(linkedSlots()).toEqual(['09:00:480:7', '09:10:600:0', '09:20:600:42']);

			// A retry of the same start counts nothing twice
			await service.moveRunningTimerStart({ startedAt: at('09:06') });
			expect(linkedSlots()).toEqual(['09:00:480:7', '09:10:600:0', '09:20:600:42']);
		});

		it('takes from the slot holding a later start the seconds before it, keeping its activity', async () => {
			const rows = [runningLog()];
			const { service, linkedSlots, commandsOf } = createService(ormType, rows, employeeIn(openOrganization), {
				slots: [heartbeatSlot()]
			});

			await service.moveRunningTimerStart({ startedAt: at('09:28') });

			// The 9:20 slot held the five minutes from 9:25; from 9:28 the run covers two of them
			expect(linkedSlots()).toEqual(['09:20:120:42']);
			expect(commandsOf(TimesheetRecalculateCommand).map((command) => command.id)).toEqual([TIMESHEET_ID]);
		});

		it('keeps, in the slot holding a later start, the seconds of the entry before it', async () => {
			// Her entry from 8:30 to 9:21 holds 60 seconds of the 9:20 slot, which the run's heartbeat raised to 360
			const entryUntil0921 = timeLog({ id: EARLIER_LOG_ID, startedAt: at('08:30'), stoppedAt: at('09:21') });
			const shared = { ...heartbeatSlot(), duration: 360, heldBy: [EARLIER_LOG_ID] };
			const rows = [entryUntil0921, runningLog()];
			const { service, linkedSlots } = createService(ormType, rows, employeeIn(openOrganization), {
				slots: [shared]
			});

			await service.moveRunningTimerStart({ startedAt: at('09:28') });

			expect(linkedSlots()).toEqual(['09:20:180:42']);
		});

		it('never lowers the seconds a slot already holds', async () => {
			const rows = [runningLog()];
			const fullSlot = { ...heartbeatSlot(), duration: 600 };
			const { service, linkedSlots } = createService(ormType, rows, employeeIn(openOrganization), {
				slots: [fullSlot]
			});

			await service.moveRunningTimerStart({ startedAt: at('09:00') });

			expect(linkedSlots()).toEqual(['09:00:600:0', '09:10:600:0', '09:20:600:42']);
		});

		it('completes, on a retry of the same start, the slots a failed move left out, and recalculates', async () => {
			// The move to 9:00 was written, then its slot work failed: the run starts at 9:00 and its slots at 9:20
			const rows = [runningLog({ startedAt: at('09:00'), editedAt: at('09:59') })];
			const { service, linkedSlots, commandsOf } = createService(ormType, rows, employeeIn(openOrganization), {
				slots: [heartbeatSlot()]
			});

			const answer = await service.moveRunningTimerStart({ startedAt: at('09:00') });

			expect(answer).toMatchObject({ id: RUNNING_LOG_ID });
			expect(commandsOf(TimeLogUpdateCommand)).toHaveLength(0);
			expect(linkedSlots()).toEqual(['09:00:600:0', '09:10:600:0', '09:20:600:42']);
			expect(commandsOf(TimesheetRecalculateCommand)).toHaveLength(1);
		});

		it('recalculates on a retry of the same start even when the slots need nothing more', async () => {
			// A failed recalculation after complete slot work: the retry finds no slot to change
			const complete = [
				{ id: 'slot-0900', startedAt: at('09:00'), duration: 600, keyboard: 0 },
				{ id: 'slot-0910', startedAt: at('09:10'), duration: 600, keyboard: 0 },
				{ ...heartbeatSlot(), duration: 600 }
			];
			const rows = [runningLog({ startedAt: at('09:00') })];
			const { service, commandsOf, transaction } = createService(ormType, rows, employeeIn(openOrganization), {
				slots: complete
			});

			await service.moveRunningTimerStart({ startedAt: at('09:00') });

			expect(transaction).not.toHaveBeenCalled();
			expect(commandsOf(TimesheetRecalculateCommand).map((command) => command.id)).toEqual([TIMESHEET_ID]);
			expect(commandsOf(UpdateEmployeeTotalWorkedHoursCommand)).toHaveLength(1);
		});

		it('refuses a start overlapping the entry that ends at 9:10, and the timer keeps its 9:25 start', async () => {
			const rows = [earlierEntry(), runningLog()];
			const { service, commandsOf, typeOrmTimeLogRepository } = createService(
				ormType,
				rows,
				employeeIn(openOrganization)
			);

			const move = service.moveRunningTimerStart({ startedAt: at('09:00') });

			await expect(move).rejects.toBeInstanceOf(ConflictException);
			await move.catch((error: ConflictException) => {
				expect(error.getResponse()).toMatchObject({
					code: TIMER_START_OVERLAP,
					overlapsUntil: '2026-11-16T09:10:00.000Z'
				});
			});
			expect(typeOrmTimeLogRepository.update).not.toHaveBeenCalled();
			expect(commandsOf(TimeLogUpdateCommand)).toHaveLength(0);
			expect(rows[1].startedAt).toEqual(RUNNING_SINCE);
		});

		it('accepts a start at 9:10, when the earlier entry ends', async () => {
			const rows = [earlierEntry(), runningLog()];
			const { service } = createService(ormType, rows, employeeIn(openOrganization));

			const moved = await service.moveRunningTimerStart({ startedAt: at('09:10') });

			expect(new Date(moved.startedAt).toISOString()).toBe('2026-11-16T09:10:00.000Z');
		});

		it('moves the start later through the time log update, which releases the slots before it, and adds none', async () => {
			const rows = [runningLog()];
			const { service, commandsOf, transaction } = createService(ormType, rows, employeeIn(openOrganization));

			const moved = await service.moveRunningTimerStart({ startedAt: at('09:40') });

			expect(new Date(moved.startedAt).toISOString()).toBe('2026-11-16T09:40:00.000Z');
			expect(commandsOf(TimeLogUpdateCommand)[0].input).not.toHaveProperty('stoppedAt');
			expect(commandsOf(IGetConflictTimeLogCommand)).toHaveLength(0);
			expect(transaction).not.toHaveBeenCalled();
		});

		it('keeps the range of a run moved past its last heartbeat whole: its end becomes now', async () => {
			const rows = [runningLog()];
			const { service, typeOrmTimeLogRepository, commandsOf } = createService(
				ormType,
				rows,
				employeeIn(openOrganization)
			);

			await service.moveRunningTimerStart({ startedAt: at('09:55') });

			expect(typeOrmTimeLogRepository.update).toHaveBeenCalledWith(
				expect.objectContaining({ isRunning: true }),
				expect.objectContaining({ startedAt: at('09:55'), stoppedAt: NOW })
			);
			// The shared update never writes the end: a stop that lands after the move keeps its own
			expect(commandsOf(TimeLogUpdateCommand)[0].input).not.toHaveProperty('stoppedAt');
		});

		it('answers 400 when no timer runs, and writes nothing', async () => {
			const rows = [earlierEntry()];
			const { service, execute } = createService(ormType, rows, employeeIn(openOrganization));

			const move = service.moveRunningTimerStart({ startedAt: at('09:00') });

			await expect(move).rejects.toBeInstanceOf(BadRequestException);
			await move.catch((error: BadRequestException) => {
				expect(error.getResponse()).toMatchObject({ code: TIMER_NOT_RUNNING });
			});
			expect(execute).not.toHaveBeenCalled();
		});

		it('answers 409 for a run of the desktop app, and writes nothing', async () => {
			const rows = [runningLog({ source: TimeLogSourceEnum.DESKTOP })];
			const { service, execute } = createService(ormType, rows, employeeIn(openOrganization));

			const move = service.moveRunningTimerStart({ startedAt: at('09:00') });

			await expect(move).rejects.toBeInstanceOf(ConflictException);
			await move.catch((error: ConflictException) => {
				expect(error.getResponse()).toMatchObject({ code: TIMER_START_TRACKER_RUN });
			});
			expect(execute).not.toHaveBeenCalled();
		});

		it('refuses an earlier start where manual time is off, and lets a later one through', async () => {
			const organization = { ...openOrganization, allowManualTime: false };

			const earlier = createService(ormType, [runningLog()], employeeIn(organization));
			const refused = earlier.service.moveRunningTimerStart({ startedAt: at('09:00') });
			await expect(refused).rejects.toBeInstanceOf(ForbiddenException);
			await refused.catch((error: ForbiddenException) => {
				expect(error.getResponse()).toMatchObject({ code: TIMER_START_MANUAL_NOT_ALLOWED });
			});
			expect(earlier.execute).not.toHaveBeenCalled();

			const later = createService(ormType, [runningLog()], employeeIn(organization));
			const moved = await later.service.moveRunningTimerStart({ startedAt: at('09:40') });
			expect(new Date(moved.startedAt).toISOString()).toBe('2026-11-16T09:40:00.000Z');
		});

		it('refuses any move while tracking is turned off for the employee', async () => {
			const { service, execute } = createService(
				ormType,
				[runningLog()],
				employeeIn(openOrganization, { isTrackingEnabled: false })
			);

			await expect(service.moveRunningTimerStart({ startedAt: at('09:40') })).rejects.toBeInstanceOf(
				ForbiddenException
			);
			expect(execute).not.toHaveBeenCalled();
		});

		it('answers the running log as it is for the start it already has, and marks nothing edited', async () => {
			const rows = [runningLog()];
			const { service, commandsOf } = createService(ormType, rows, employeeIn(openOrganization));

			const answer: ITimeLog = await service.moveRunningTimerStart({ startedAt: new Date(RUNNING_SINCE) });

			expect(answer).toMatchObject({ id: RUNNING_LOG_ID });
			expect(commandsOf(TimeLogUpdateCommand)).toHaveLength(0);
			expect(rows[0].editedAt).toBeUndefined();
		});

		it('refuses any move for a role that may not change tracked time, and writes nothing', async () => {
			jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
				(permission) => permission === PermissionsEnum.ALLOW_MANUAL_TIME
			);
			const { service, execute, typeOrmTimeLogRepository } = createService(
				ormType,
				[runningLog()],
				employeeIn(openOrganization)
			);

			const move = service.moveRunningTimerStart({ startedAt: at('09:40') });

			await expect(move).rejects.toBeInstanceOf(ForbiddenException);
			await move.catch((error: ForbiddenException) => {
				expect(error.getResponse()).toMatchObject({ code: TIMER_START_EDIT_NOT_ALLOWED });
			});
			expect(typeOrmTimeLogRepository.update).not.toHaveBeenCalled();
			expect(execute).not.toHaveBeenCalled();
		});

		it('refuses an earlier start for a role that may not add time by hand, and lets a later one through', async () => {
			jest.spyOn(RequestContext, 'hasPermission').mockImplementation(
				(permission) => permission === PermissionsEnum.ALLOW_MODIFY_TIME
			);

			const earlier = createService(ormType, [runningLog()], employeeIn(openOrganization));
			const refused = earlier.service.moveRunningTimerStart({ startedAt: at('09:00') });
			await expect(refused).rejects.toBeInstanceOf(ForbiddenException);
			await refused.catch((error: ForbiddenException) => {
				expect(error.getResponse()).toMatchObject({ code: TIMER_START_MANUAL_NOT_ALLOWED });
			});
			expect(earlier.execute).not.toHaveBeenCalled();

			const later = createService(ormType, [runningLog()], employeeIn(openOrganization));
			const moved = await later.service.moveRunningTimerStart({ startedAt: at('09:40') });
			expect(new Date(moved.startedAt).toISOString()).toBe('2026-11-16T09:40:00.000Z');
		});

		/** Her run from the web timer, which sends no heartbeat: started at 9:25, its end on its start, no slot. */
		const webRun = (): TimeLogRow => runningLog({ source: TimeLogSourceEnum.WEB_TIMER, stoppedAt: RUNNING_SINCE });

		/** Where a start at `nextStart` ends the run, reading it with its slots as `stopPreviousRunningTimers` does. */
		const endWhenReplacedAt = (service: TimerService, row: TimeLogRow, nextStart: Date): Date =>
			service['replacedRunEnd']({ ...row, timeSlots: [] } as unknown as ITimeLog, moment.utc(nextStart));

		it('keeps the end of a web run moved earlier on its new start, so a start at 12:00 ends it at 12:00', async () => {
			const rows = [webRun()];
			const { service, linkedSlots } = createService(ormType, rows, employeeIn(openOrganization));

			await service.moveRunningTimerStart({ startedAt: at('09:00') });

			expect(rows[0]).toMatchObject({ isRunning: true, startedAt: at('09:00'), stoppedAt: at('09:00') });
			expect(linkedSlots()).toEqual([]);
			expect(endWhenReplacedAt(service, rows[0], at('12:00'))).toEqual(at('12:00'));
		});

		it('keeps the end of a web run moved later on its new start, so a start at 12:00 ends it at 12:00', async () => {
			const rows = [webRun()];
			const { service, linkedSlots } = createService(ormType, rows, employeeIn(openOrganization));

			await service.moveRunningTimerStart({ startedAt: at('09:40') });

			expect(rows[0]).toMatchObject({ isRunning: true, startedAt: at('09:40'), stoppedAt: at('09:40') });
			expect(linkedSlots()).toEqual([]);
			expect(endWhenReplacedAt(service, rows[0], at('12:00'))).toEqual(at('12:00'));
		});

		/** A turn of the employee that passes to the next start or stop once it was checked `checksHeld` times. */
		const turnPassingAfter = (checksHeld: number) => {
			let checks = 0;
			return {
				isHeld: () => checks < checksHeld,
				assertHeld: () => {
					checks += 1;
					if (checks > checksHeld) {
						throw new RequestTimeoutException('A later start or stop went ahead.');
					}
				}
			};
		};

		it("waits for the stop in the employee's turn, then finds no timer running and moves nothing", async () => {
			const rows = [runningLog()];
			const { service, typeOrmTimeLogRepository } = createService(ormType, rows, employeeIn(openOrganization));
			let settleStop = (): void => undefined;
			const stop = service['inEmployeeTurn'](EMPLOYEE_ID, async () => {
				await new Promise<void>((resolve) => {
					settleStop = resolve;
				});
				Object.assign(rows[0], { isRunning: false, stoppedAt: at('09:58') });
			});

			const move = service.moveRunningTimerStart({ startedAt: at('09:00') });
			await new Promise((resolve) => setImmediate(resolve));
			settleStop();
			await stop;

			await expect(move).rejects.toBeInstanceOf(BadRequestException);
			expect(typeOrmTimeLogRepository.update).not.toHaveBeenCalled();
			expect(rows[0]).toMatchObject({ isRunning: false, startedAt: RUNNING_SINCE, stoppedAt: at('09:58') });
		});

		it("writes nothing once the employee's turn has passed to the next start or stop", async () => {
			const rows = [runningLog()];
			const { service, typeOrmTimeLogRepository, commandsOf } = createService(
				ormType,
				rows,
				employeeIn(openOrganization)
			);
			jest.spyOn(service as any, 'inEmployeeTurn').mockImplementation(
				(_employeeId: string, work: (turn: unknown) => Promise<unknown>) => work(turnPassingAfter(0))
			);

			await expect(service.moveRunningTimerStart({ startedAt: at('09:00') })).rejects.toBeInstanceOf(
				RequestTimeoutException
			);
			expect(typeOrmTimeLogRepository.update).not.toHaveBeenCalled();
			expect(commandsOf(TimeLogUpdateCommand)).toHaveLength(0);
			expect(rows[0].startedAt).toEqual(RUNNING_SINCE);
		});

		it('sends no time log update once the turn passes after the start was written', async () => {
			const rows = [runningLog()];
			const { service, typeOrmTimeLogRepository, commandsOf } = createService(
				ormType,
				rows,
				employeeIn(openOrganization)
			);
			jest.spyOn(service as any, 'inEmployeeTurn').mockImplementation(
				(_employeeId: string, work: (turn: unknown) => Promise<unknown>) => work(turnPassingAfter(1))
			);

			await expect(service.moveRunningTimerStart({ startedAt: at('09:00') })).rejects.toBeInstanceOf(
				RequestTimeoutException
			);
			expect(typeOrmTimeLogRepository.update).toHaveBeenCalledTimes(1);
			expect(commandsOf(TimeLogUpdateCommand)).toHaveLength(0);
		});
	}
);
