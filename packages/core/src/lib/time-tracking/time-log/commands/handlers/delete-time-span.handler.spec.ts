// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { BadRequestException } from '@nestjs/common';
import { ITimeSlot, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { RequestContext } from '../../../../core/context';
import { moment } from '../../../../core/moment-extend';
import { MultiORMEnum } from '../../../../core/utils';
import { TimesheetFirstOrCreateCommand, TimesheetRecalculateCommand } from '../../../timesheet/commands';
import { TimeSlotBulkDeleteCommand } from '../../../time-slot/commands';
import { TimeSlotBulkDeleteHandler } from '../../../time-slot/commands/handlers/time-slot-bulk-delete.handler';
import { generateTimeSlots } from '../../../time-slot/utils';
import { TimeLog } from '../../time-log.entity';
import { TimeLogService } from '../../time-log.service';
import { DeleteTimeSpanCommand } from '../delete-time-span.command';
import { IGetConflictTimeLogCommand } from '../get-conflict-time-log.command';
import { TimeLogCreateCommand } from '../time-log-create.command';
import { TimeLogDeleteCommand } from '../time-log-delete.command';
import { TimeLogUpdateCommand } from '../time-log-update.command';
import { UpdateEmployeeTotalWorkedHoursCommand } from '../update-employee-total-worked-hours.command';
import { DeleteTimeSpanHandler } from './delete-time-span.handler';
import { TimeLogDeleteHandler } from './time-log-delete.handler';
import { TimeLogUpdateHandler } from './time-log-update.handler';

/**
 * #10734 — manual time over a range that fully covers a tracked log with several time slots.
 *
 * `TimeLogService.addManualTime` / `updateManualTime` and the timer's stop send one `DeleteTimeSpanCommand`
 * per slot of each conflicting log. When the new range covers the log, the command for its first slot deletes
 * the whole log; the command for the next slot then read the log back, found nothing, and destructured `null`,
 * so the request failed with 400 after the old entry was already gone and the manual entry was never saved.
 */

const LOG_ID = '10734000-0000-4000-8000-000000000001';

/** A log tracked from 10:00 to 10:30: three ten-minute slots. */
const TRACKED_LOG = {
	id: LOG_ID,
	tenantId: '10734000-0000-4000-8000-0000000000aa',
	organizationId: '10734000-0000-4000-8000-0000000000bb',
	employeeId: '10734000-0000-4000-8000-0000000000cc',
	timesheetId: '10734000-0000-4000-8000-0000000000dd',
	startedAt: new Date('2026-10-12T10:00:00.000Z'),
	stoppedAt: new Date('2026-10-12T10:30:00.000Z'),
	timeSlots: [
		{ id: '10734000-0000-4000-8000-000000000011' },
		{ id: '10734000-0000-4000-8000-000000000012' },
		{ id: '10734000-0000-4000-8000-000000000013' }
	] as ITimeSlot[]
} as unknown as TimeLog;

/** The manual entry picked over it: 09:30 to 11:00. */
const COVERING_RANGE = {
	start: new Date('2026-10-12T09:30:00.000Z'),
	end: new Date('2026-10-12T11:00:00.000Z')
};

/**
 * The handler over a store holding the tracked log until a `TimeLogDeleteCommand` removes it, which is what
 * the default (soft-deleting) delete leaves a later `findOne` to see.
 */
function createHandler() {
	let stored: TimeLog | null = TRACKED_LOG;

	const timeLogRepository = {
		findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
			stored && stored.id === where.id ? { ...stored, timeSlots: [...stored.timeSlots] } : null
		)
	};
	const execute = jest.fn(async (command: unknown) => {
		if (command instanceof TimeLogDeleteCommand) {
			stored = null;
		}
		return undefined;
	});

	const handler = new DeleteTimeSpanHandler(timeLogRepository as any, {} as any, { execute } as any);

	return { handler, execute, timeLogRepository };
}

describe('DeleteTimeSpanHandler', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
	});

	afterEach(() => jest.restoreAllMocks());

	it('deletes a log the new range covers entirely, on the command for its first slot', async () => {
		const { handler, execute } = createHandler();

		await expect(
			handler.execute(new DeleteTimeSpanCommand(COVERING_RANGE, TRACKED_LOG, TRACKED_LOG.timeSlots[0]))
		).resolves.toBe(true);

		expect(execute).toHaveBeenCalledTimes(1);
		expect(execute.mock.calls[0][0]).toBeInstanceOf(TimeLogDeleteCommand);
	});

	it('clears every slot of a covered multi-slot log, as the manual time loop sends them, without failing', async () => {
		const { handler, execute, timeLogRepository } = createHandler();

		// `addManualTime`: one command per slot of each conflicting log, sequentially.
		const results: boolean[] = [];
		for (const timeSlot of TRACKED_LOG.timeSlots) {
			results.push(await handler.execute(new DeleteTimeSpanCommand(COVERING_RANGE, TRACKED_LOG, timeSlot)));
		}

		// The first command removed the log; the next two found nothing left to trim.
		expect(results).toEqual([true, false, false]);
		expect(timeLogRepository.findOne).toHaveBeenCalledTimes(3);
		expect(execute.mock.calls.filter(([command]) => command instanceof TimeLogDeleteCommand)).toHaveLength(1);
	});

	it('does nothing for a log that is no longer there', async () => {
		const { handler, execute } = createHandler();
		await handler.execute(new DeleteTimeSpanCommand(COVERING_RANGE, TRACKED_LOG, TRACKED_LOG.timeSlots[0]));
		execute.mockClear();

		await expect(
			handler.execute(new DeleteTimeSpanCommand(COVERING_RANGE, TRACKED_LOG, TRACKED_LOG.timeSlots[1], true))
		).resolves.toBe(false);
		expect(execute).not.toHaveBeenCalled();
	});
});

/**
 * #11823 — the overlap cleanup over a scripted store of one employee's logs and slots, through the real handlers it
 * chains to (`TimeLogUpdateHandler`, `TimeLogDeleteHandler`, `TimeSlotBulkDeleteHandler`), driven as its callers drive
 * it: `addManualTime`, `updateManualTime` and the timer stop read the logs the new range overlaps, with their slots,
 * and send one `DeleteTimeSpanCommand` per slot of each.
 */

const TENANT_ID = '11823000-0000-4000-8000-0000000000aa';
const ORGANIZATION_ID = '11823000-0000-4000-8000-0000000000bb';
const EMPLOYEE_ID = '11823000-0000-4000-8000-0000000000cc';

/** 2026-10-12 at `time` (`HH:mm`, or `HH:mm:ss.SSS`), or another day's `YYYY-MM-DDTHH:mm`, UTC. */
const at = (time: string) => {
	if (time.includes('T')) {
		return new Date(`${time}:00.000Z`);
	}
	return new Date(`2026-10-12T${time.length === 5 ? `${time}:00.000` : time}Z`);
};

/** The `HH:mm` of a date, UTC. */
const hhmm = (date: Date) => date.toISOString().slice(11, 16);

/** The start of each ten-minute slot of `start`–`stop`. */
const slotStarts = (start: string, stop: string) =>
	generateTimeSlots(at(start), at(stop)).map((slot) => hhmm(new Date(slot.startedAt)));

/** What an operation ended with: the message of the error it raised, or nothing when it raised none. */
const raised = (outcome: unknown) => (outcome instanceof Error ? outcome.message : undefined);

/** The timesheet of a date's week, as `TimesheetFirstOrCreateCommand` finds it (no date: the current week's). */
const timesheetOf = (date?: Date) => `timesheet-${moment.utc(date).startOf('week').format('YYYY-MM-DD')}`;

interface IStoredLog {
	id: string;
	tenantId: string;
	organizationId: string;
	employeeId: string;
	timesheetId: string;
	startedAt: Date;
	stoppedAt: Date;
	isRunning: boolean;
	source: TimeLogSourceEnum;
	logType: TimeLogType;
	projectId?: string;
	taskId?: string;
	description?: string;
	deletedAt?: Date;
}

/**
 * The writes of the store a spec can make fail: a log created, a log's columns updated, a log deleted, a slot unlinked
 * from a log, slots removed, a timesheet's totals recalculated.
 */
type StoreWrite = 'insert' | 'update' | 'delete' | 'unlink' | 'slotRemoval' | 'recalculation';

interface IStoredSlot {
	id: string;
	tenantId: string;
	organizationId: string;
	employeeId: string;
	startedAt: Date;
	duration: number;
	/** The join rows: the logs holding this slot. */
	timeLogIds: string[];
	deletedAt?: Date;
}

function createStore() {
	const logs: IStoredLog[] = [];
	const slots: IStoredSlot[] = [];
	const executed: unknown[] = [];
	/** The timesheets and the employees whose totals were recalculated, in turn (a recalculation that failed is not). */
	const recalculated = { timesheets: [] as string[], employees: [] as string[] };
	let created = 0;

	const liveLog = (id: string) => logs.find((log) => log.id === id && !log.deletedAt);
	const liveSlots = () => slots.filter((slot) => !slot.deletedAt);
	const slotsOf = (logId: string) =>
		liveSlots()
			.filter((slot) => slot.timeLogIds.includes(logId))
			.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

	/** A slot as TypeORM loads it (the subscriber gives it its ten-minute end), with its logs when they are joined. */
	const slotEntity = (slot: IStoredSlot, withLogs: boolean) =>
		({
			id: slot.id,
			tenantId: slot.tenantId,
			organizationId: slot.organizationId,
			employeeId: slot.employeeId,
			startedAt: new Date(slot.startedAt),
			stoppedAt: moment(slot.startedAt).add(10, 'minutes').toDate(),
			duration: slot.duration,
			screenshots: [],
			activities: [],
			timeSlotMinutes: [],
			...(withLogs ? { timeLogs: slot.timeLogIds.map((id) => ({ id })) } : {})
		}) as ITimeSlot;

	/** A log as TypeORM loads it, with its slots when they are joined. */
	const logEntity = (log: IStoredLog, withSlots: boolean): TimeLog => {
		const { deletedAt: _deletedAt, ...columns } = log;
		const timeSlots = withSlots ? { timeSlots: slotsOf(log.id).map((slot) => slotEntity(slot, false)) } : {};
		return Object.assign(new TimeLog(), columns, timeSlots);
	};

	/** What a save or an update writes: the columns it names, not the relations. */
	const columnsOf = (entity: Partial<TimeLog>) => {
		const { timeSlots: _timeSlots, ...columns } = entity;
		return Object.fromEntries(Object.entries(columns).filter(([, value]) => value !== undefined));
	};

	/** The ids of a `where` id: one, or the values of an `In(...)`. */
	const idsOf = (id: unknown): string[] => [].concat((id as { value?: unknown })?.value ?? id);

	/** For each kind of write made to fail: how many of its calls succeed first, then how many fail. */
	const failing: Partial<Record<StoreWrite, { succeeding: number; times: number }>> = {};
	/** Fails this write when its turn has come, as a lost connection or a lock timeout would. */
	const failIfDue = (write: StoreWrite) => {
		const failure = failing[write];
		if (!failure) {
			return;
		}
		if (failure.succeeding > 0) {
			failure.succeeding--;
			return;
		}
		failure.times--;
		if (failure.times <= 0) {
			delete failing[write];
		}
		throw new Error(`The ${write} failed`);
	};

	const timeLogRepository = {
		findOne: jest.fn(
			async ({ where, relations }: { where: { id: string }; relations?: { timeSlots?: boolean } }) => {
				const log = liveLog(where.id);
				return log ? logEntity(log, Boolean(relations?.timeSlots)) : null;
			}
		),
		findOneBy: jest.fn(async (where: { id: string; tenantId?: string }) => {
			const log = liveLog(where.id);
			return log && (!where.tenantId || where.tenantId === log.tenantId) ? logEntity(log, false) : null;
		}),
		// The logs whose columns equal those the `where` names (a date by its time).
		find: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
			logs
				.filter((log) => !log.deletedAt)
				.filter((log) =>
					Object.entries(where).every(([column, value]) => {
						const stored = log[column as keyof IStoredLog];
						return value instanceof Date
							? (stored as Date)?.getTime() === value.getTime()
							: stored === value;
					})
				)
				.map((log) => logEntity(log, false))
		),
		update: jest.fn(async (where: { id: string }, changes: Partial<TimeLog>) => {
			failIfDue('update');
			const log = liveLog(where.id);
			if (log) {
				Object.assign(log, columnsOf(changes));
			}
			return { affected: log ? 1 : 0 };
		}),
		// The columns, and for a log naming its `timeSlots`, those slots as its own (the join rows), as TypeORM persists
		// the relation. A log without an id is created.
		save: jest.fn(async (entity: TimeLog) => {
			let log = logs.find((stored) => stored.id === entity.id);
			if (log) {
				Object.assign(log, columnsOf(entity));
			} else {
				failIfDue('insert');
				log = { ...columnsOf(entity), id: entity.id ?? `created-${++created}` } as IStoredLog;
				logs.push(log);
				entity.id = log.id;
			}
			if (Array.isArray(entity.timeSlots)) {
				const linked = new Set(entity.timeSlots.map((slot) => slot.id));
				for (const slot of liveSlots()) {
					const others = slot.timeLogIds.filter((id) => id !== log.id);
					slot.timeLogIds = linked.has(slot.id) ? [...others, log.id] : others;
				}
			}
			return entity;
		}),
		softDelete: jest.fn(async ({ id }: { id: unknown }) => {
			for (const log of idsOf(id).map(liveLog).filter(Boolean)) {
				log.deletedAt = new Date();
			}
			return { affected: 1 };
		}),
		// A hard delete, with the log's join rows (the foreign keys of `time_slot_time_logs` cascade).
		delete: jest.fn(async ({ id }: { id: unknown }) => {
			failIfDue('delete');
			for (const logId of idsOf(id)) {
				const index = logs.findIndex((log) => log.id === logId);
				if (index >= 0) {
					logs.splice(index, 1);
				}
				for (const slot of slots) {
					slot.timeLogIds = slot.timeLogIds.filter((linked) => linked !== logId);
				}
			}
			return { affected: 1 };
		})
	};

	const timeSlotRepository = {
		// The reads of `TimeLogUpdateHandler` (slots at start times) and `TimeSlotBulkDeleteHandler` (slots by id), with
		// their logs joined, and the join-row writes of `relation(TimeSlot, 'timeLogs').of(slot)`.
		createQueryBuilder: () => {
			const params: Record<string, any> = {};
			const builder = {
				alias: 'time_slot',
				leftJoinAndSelect: () => builder,
				where: (_sql: string, values?: Record<string, unknown>) => (Object.assign(params, values), builder),
				andWhere: (_sql: string, values?: Record<string, unknown>) => (Object.assign(params, values), builder),
				getParameters: () => params,
				relation: () => ({
					of: (slotIds: string | string[]) => {
						const related = slots.filter((stored) => [].concat(slotIds).includes(stored.id));
						return {
							remove: async (timeLogId: string) => {
								failIfDue('unlink');
								for (const slot of related) {
									slot.timeLogIds = slot.timeLogIds.filter((id) => id !== timeLogId);
								}
							},
							add: async (timeLogId: string) => {
								for (const slot of related) {
									slot.timeLogIds = [...slot.timeLogIds, timeLogId];
								}
							}
						};
					}
				}),
				getMany: async () =>
					liveSlots()
						.filter(
							(slot) =>
								slot.tenantId === params.tenantId &&
								slot.organizationId === params.organizationId &&
								slot.employeeId === params.employeeId &&
								(!params.startTimes ||
									(params.startTimes as Date[]).some(
										(time) => time.getTime() === slot.startedAt.getTime()
									)) &&
								(!params.timeSlotsIds || (params.timeSlotsIds as string[]).includes(slot.id))
						)
						.map((slot) => slotEntity(slot, true))
			};
			return builder;
		},
		// Slots by id, with their logs when they are joined; a removed slot is not read.
		find: jest.fn(async ({ where, relations }: { where: { id: unknown }; relations?: { timeLogs?: boolean } }) =>
			liveSlots()
				.filter((slot) => idsOf(where.id).includes(slot.id))
				.map((slot) => slotEntity(slot, Boolean(relations?.timeLogs)))
		),
		softRemove: jest.fn(async (removed: ITimeSlot[]) => {
			failIfDue('slotRemoval');
			for (const slot of slots.filter(({ id }) => removed.some((entity) => entity.id === id))) {
				slot.deletedAt = new Date();
			}
			return removed;
		})
	};

	const commandBus = { execute: jest.fn() };
	const updateHandler = new TimeLogUpdateHandler(
		commandBus as any,
		timeLogRepository as any,
		timeSlotRepository as any,
		{} as any,
		{ generateTimeSlots } as any
	);
	const slotDeleteHandler = new TimeSlotBulkDeleteHandler(timeSlotRepository as any, {} as any);
	for (const typeOrmOnly of [updateHandler, slotDeleteHandler]) {
		Object.defineProperty(typeOrmOnly, 'ormType', { value: MultiORMEnum.TypeORM });
	}
	const logDeleteHandler = new TimeLogDeleteHandler(timeLogRepository as any, {} as any, commandBus as any);
	commandBus.execute.mockImplementation(async (command: unknown) => {
		executed.push(command);
		if (command instanceof TimeLogUpdateCommand) return updateHandler.execute(command);
		if (command instanceof TimeLogDeleteCommand) return logDeleteHandler.execute(command);
		if (command instanceof TimeSlotBulkDeleteCommand) return slotDeleteHandler.execute(command);
		if (command instanceof TimesheetFirstOrCreateCommand) return { id: timesheetOf(command.date) };
		if (command instanceof TimesheetRecalculateCommand) {
			failIfDue('recalculation');
			return void recalculated.timesheets.push(String(command.id));
		}
		if (command instanceof UpdateEmployeeTotalWorkedHoursCommand) {
			return void recalculated.employees.push(String(command.employeeId));
		}
		throw new Error(`Unexpected command ${(command as object)?.constructor?.name}`);
	});
	const handler = new DeleteTimeSpanHandler(timeLogRepository as any, timeSlotRepository as any, commandBus as any);

	/** The logs the conflict lookup reads for a range: those it overlaps, with their slots (the TypeORM lookup joins them). */
	const conflictsOver = (range: { start: Date; end: Date }) =>
		logs
			.filter((log) => !log.deletedAt && log.startedAt < range.end && log.stoppedAt > range.start)
			.map((log) => logEntity(log, true))
			.filter((log) => log.timeSlots.length > 0);

	/**
	 * `TimeLogService.addManualTime` over this store: the conflict lookup reads it, the cleanup is the handler, and the
	 * create writes the new log into it.
	 */
	const manualTimeService = () => {
		const employee = {
			id: EMPLOYEE_ID,
			organizationId: ORGANIZATION_ID,
			organization: { id: ORGANIZATION_ID, futureDateAllowed: false, allowManualTime: true }
		};
		const bus = {
			execute: async (command: unknown) => {
				if (command instanceof IGetConflictTimeLogCommand) {
					const { startDate, endDate } = command.input;
					return conflictsOver({ start: new Date(startDate), end: new Date(endDate) });
				}
				if (command instanceof DeleteTimeSpanCommand) {
					return handler.execute(command);
				}
				if (command instanceof TimeLogCreateCommand) {
					const { startedAt, stoppedAt } = command.input;
					const log = {
						id: `manual-${++created}`,
						tenantId: TENANT_ID,
						organizationId: ORGANIZATION_ID,
						employeeId: EMPLOYEE_ID,
						timesheetId: timesheetOf(startedAt),
						startedAt,
						stoppedAt,
						isRunning: false,
						source: TimeLogSourceEnum.WEB_TIMER,
						logType: TimeLogType.MANUAL
					};
					logs.push(log);
					return log;
				}
				return commandBus.execute(command);
			}
		};
		const service = new TimeLogService(
			// No running timer of the employee besides the logs the overlap lookup returns (#11886)
			{ find: async () => [] } as never,
			{} as never,
			{ findOne: async () => employee } as never,
			{} as never,
			{} as never,
			bus as never,
			{ canManageEmployee: async () => true } as never
		);
		// The employee filter is the CRUD base's request-scoped switch, which has no request here.
		jest.spyOn(service as any, 'withoutEmployeeFilter').mockImplementation((callback: () => Promise<unknown>) =>
			callback()
		);
		return service;
	};

	return {
		executed,
		/** The totals recalculated so far. */
		recalculated: () => ({ timesheets: [...recalculated.timesheets], employees: [...recalculated.employees] }),
		/** Makes a write fail `times` times in a row, after `succeeding` calls of it have gone through. */
		fail(write: StoreWrite, succeeding = 0, times = 1) {
			failing[write] = { succeeding, times };
		},
		/** Records manual time over `start`–`stop` for the employee, as `POST /timesheet/time-log` does. */
		addManualTime: (start: string, stop: string) =>
			manualTimeService().addManualTime({
				employeeId: EMPLOYEE_ID,
				organizationId: ORGANIZATION_ID,
				startedAt: at(start),
				stoppedAt: at(stop)
			}),
		/** A log of the employee over `start`–`stop`, with a slot for every ten minutes of it. */
		addLog(id: string, start: string, stop: string, columns: Partial<IStoredLog> = {}) {
			logs.push({
				id,
				tenantId: TENANT_ID,
				organizationId: ORGANIZATION_ID,
				employeeId: EMPLOYEE_ID,
				timesheetId: timesheetOf(at(start)),
				startedAt: at(start),
				stoppedAt: at(stop),
				isRunning: false,
				source: TimeLogSourceEnum.DESKTOP,
				logType: TimeLogType.TRACKED,
				...columns
			});
			for (const slot of generateTimeSlots(at(start), at(stop))) {
				const startedAt = new Date(slot.startedAt);
				slots.push({
					id: `${id}@${hhmm(startedAt)}`,
					tenantId: TENANT_ID,
					organizationId: ORGANIZATION_ID,
					employeeId: EMPLOYEE_ID,
					startedAt,
					duration: slot.duration,
					timeLogIds: [id]
				});
			}
		},
		/** A log as the conflict lookup reads it now, with its slots. */
		read: (id: string) => logEntity(liveLog(id), true),
		/** Someone deletes a log (a soft delete, as the time-log delete route does). */
		discard(id: string) {
			liveLog(id).deletedAt = new Date();
		},
		/**
		 * Another log holds this slot too, as two logs meeting inside one ten-minute slot do: that log's own slot at the
		 * same start goes, and it is linked to this one.
		 */
		share(slotId: string, logId: string) {
			const slot = slots.find((stored) => stored.id === slotId);
			slots.splice(
				slots.findIndex((stored) => stored.id === `${logId}@${hhmm(slot.startedAt)}`),
				1
			);
			slot.timeLogIds = [...slot.timeLogIds, logId];
		},
		/**
		 * Another write leaves the stored log over `start`–`stop`: its slots outside that range go, as
		 * `TimeLogUpdateHandler` releases them.
		 */
		cut(id: string, start: string, stop: string) {
			const log = liveLog(id);
			const kept = generateTimeSlots(at(start), at(stop)).map((slot) => new Date(slot.startedAt).getTime());
			for (const slot of slotsOf(id).filter((slot) => !kept.includes(slot.startedAt.getTime()))) {
				slot.deletedAt = new Date();
			}
			Object.assign(log, { startedAt: at(start), stoppedAt: at(stop) });
		},
		/** One command, for a new `start`–`stop` range, a log as its caller read it and one of that log's slots. */
		send: (start: string, stop: string, timeLog: TimeLog, timeSlot: ITimeSlot) =>
			handler.execute(new DeleteTimeSpanCommand({ start: at(start), end: at(stop) }, timeLog, timeSlot)),
		/**
		 * The cleanup for a new `start`–`stop` range, as its callers run it: the logs the conflict lookup reads (those the
		 * range overlaps, with their slots: the TypeORM lookup joins them), then one command per slot of each, in turn.
		 * The lookup names no order for the slots, so they can be sent latest first too.
		 */
		async cleanUp(start: string, stop: string, order: 'earliest first' | 'latest first' = 'earliest first') {
			const range = { start: at(start), end: at(stop) };
			const results: boolean[] = [];
			for (const timeLog of conflictsOver(range)) {
				const timeSlots = order === 'latest first' ? [...timeLog.timeSlots].reverse() : timeLog.timeSlots;
				for (const timeSlot of timeSlots) {
					results.push(await handler.execute(new DeleteTimeSpanCommand(range, timeLog, timeSlot)));
				}
			}
			return results;
		},
		/** The employee's logs as they now stand, earliest first, with the start of each slot they hold. */
		timeline() {
			return logs
				.filter((log) => !log.deletedAt)
				.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
				.map((log) => ({
					range: `${hhmm(log.startedAt)}-${hhmm(log.stoppedAt)}`,
					isRunning: log.isRunning,
					slots: slotsOf(log.id).map((slot) => hhmm(slot.startedAt))
				}));
		},
		/** The employee's logs as stored, earliest first. */
		rows: () =>
			logs
				.filter((log) => !log.deletedAt)
				.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
				.map((log) => ({ ...log })),
		/** How many slots the employee still has. */
		slotCount: () => liveSlots().length
	};
}

describe('DeleteTimeSpanHandler and a running log (#11823)', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
	});

	afterEach(() => jest.restoreAllMocks());

	it.each([
		['covers it', '08:00', '09:30'],
		['takes its start', '08:00', '08:45'],
		['takes its end', '08:45', '09:30'],
		['falls inside it', '08:35', '08:45']
	])('leaves a running log with three slots running and whole when the new range %s', async (_shape, start, stop) => {
		const store = createStore();
		// A timer running since 08:30, with three heartbeats so far: its end is the last one, 09:00.
		store.addLog('running', '08:30', '09:00', { isRunning: true });

		const results = await store.cleanUp(start, stop);

		expect(store.timeline()).toEqual([
			{ range: '08:30-09:00', isRunning: true, slots: ['08:30', '08:40', '08:50'] }
		]);
		// Nothing was updated, deleted or released.
		expect(store.executed).toEqual([]);
		expect(results).toEqual([false, false, false]);
	});

	it('CONTROL: the same log once stopped is removed by a range that covers it', async () => {
		const store = createStore();
		store.addLog('stopped', '08:30', '09:00');

		await store.cleanUp('08:00', '09:30');

		expect(store.timeline()).toEqual([]);
		expect(store.slotCount()).toBe(0);
	});
});

describe('DeleteTimeSpanHandler acts on the log as it now stands (#11823)', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
	});

	afterEach(() => jest.restoreAllMocks());

	/** The six slots of 08:00–09:00. */
	const BEFORE_NINE = ['08:00', '08:10', '08:20', '08:30', '08:40', '08:50'];

	it('leaves a log the command for an earlier slot already cut back alone, with every slot it holds', async () => {
		const store = createStore();
		store.addLog('tracked', '08:00', '11:00');
		// The log as the conflict lookup read it for manual time over 09:00–10:00, then as the command for its first
		// slot left it: ending where that range starts.
		const asRead = store.read('tracked');
		store.cut('tracked', '08:00', '09:00');

		const results: boolean[] = [];
		for (const timeSlot of asRead.timeSlots.slice(1)) {
			results.push(await store.send('09:00', '10:00', asRead, timeSlot));
		}

		expect(store.timeline()).toEqual([{ range: '08:00-09:00', isRunning: false, slots: BEFORE_NINE }]);
		expect(store.executed).toEqual([]);
		expect(results).toEqual(Array(17).fill(false));
	});

	it('cuts a log back from where it now ends, not from where the lookup read it', async () => {
		const store = createStore();
		store.addLog('tracked', '08:00', '11:00');
		// Read for manual time over 09:00–10:00, then shortened to end at 09:30 by another write.
		const asRead = store.read('tracked');
		store.cut('tracked', '08:00', '09:30');

		await store.send(
			'09:00',
			'10:00',
			asRead,
			asRead.timeSlots.find((slot) => hhmm(slot.startedAt) === '09:10')
		);

		expect(store.timeline()).toEqual([{ range: '08:00-09:00', isRunning: false, slots: BEFORE_NINE }]);
	});
});

describe('DeleteTimeSpanHandler and a stopped log the new range takes one end of (#11823)', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
	});

	afterEach(() => jest.restoreAllMocks());

	describe.each(['earliest first', 'latest first'] as const)('its slots sent %s', (order) => {
		it('keeps the slots before the new range when that range takes the end of the log', async () => {
			const store = createStore();
			store.addLog('tracked', '08:00', '10:00');

			await store.cleanUp('09:00', '11:00', order);

			expect(store.timeline()).toEqual([
				{ range: '08:00-09:00', isRunning: false, slots: slotStarts('08:00', '09:00') }
			]);
			expect(store.slotCount()).toBe(6);
		});

		it('keeps the slots after the new range when that range takes the start of the log', async () => {
			const store = createStore();
			store.addLog('tracked', '09:00', '11:00');

			await store.cleanUp('08:00', '10:00', order);

			expect(store.timeline()).toEqual([
				{ range: '10:00-11:00', isRunning: false, slots: slotStarts('10:00', '11:00') }
			]);
			expect(store.slotCount()).toBe(6);
		});
	});

	it('keeps the log and its slots after the range when that range takes its start and ends between seconds', async () => {
		const store = createStore();
		store.addLog('tracked', '08:00', '11:00');

		// The end of a range a tracker sends carries milliseconds; a slot's start never does.
		await store.cleanUp('07:00', '09:55:00.500');

		expect(store.timeline()).toEqual([
			{ range: '09:55-11:00', isRunning: false, slots: slotStarts('09:55', '11:00') }
		]);
		expect(store.slotCount()).toBe(7);
	});
});

describe('DeleteTimeSpanHandler and a stopped log the new range falls inside (#11823)', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
	});

	afterEach(() => jest.restoreAllMocks());

	describe.each(['earliest first', 'latest first'] as const)('its slots sent %s', (order) => {
		it('splits a log of 08:00 to 11:00 with 18 slots, by 09:00 to 10:00, into two logs holding 12 slots', async () => {
			const store = createStore();
			store.addLog('tracked', '08:00', '11:00');

			await store.cleanUp('09:00', '10:00', order);

			expect(store.timeline()).toEqual([
				{ range: '08:00-09:00', isRunning: false, slots: slotStarts('08:00', '09:00') },
				{ range: '10:00-11:00', isRunning: false, slots: slotStarts('10:00', '11:00') }
			]);
			expect(store.slotCount()).toBe(12);
		});

		it('keeps with each part the slot its edge shares with a range off the ten-minute marks', async () => {
			const store = createStore();
			store.addLog('tracked', '08:00', '11:00');

			await store.cleanUp('09:05', '09:55', order);

			// 09:00 holds the first part's last five minutes and 09:50 the second part's first five.
			expect(store.timeline()).toEqual([
				{ range: '08:00-09:05', isRunning: false, slots: slotStarts('08:00', '09:05') },
				{ range: '09:55-11:00', isRunning: false, slots: slotStarts('09:55', '11:00') }
			]);
			expect(store.slotCount()).toBe(14);
		});
	});

	it('gives the second part the slot holding the range end when that end falls between seconds', async () => {
		const store = createStore();
		store.addLog('tracked', '08:00', '11:00');

		// The end of a range a tracker sends carries milliseconds; a slot's start never does.
		await store.cleanUp('09:05', '09:55:00.500');

		expect(store.timeline()).toEqual([
			{ range: '08:00-09:05', isRunning: false, slots: slotStarts('08:00', '09:05') },
			{ range: '09:55-11:00', isRunning: false, slots: slotStarts('09:55', '11:00') }
		]);
		expect(store.slotCount()).toBe(14);
	});

	it('takes one slot out of the middle of a log, as the time-slot delete asks, splitting the log around it', async () => {
		const store = createStore();
		store.addLog('tracked', '08:00', '11:00');
		const asRead = store.read('tracked');

		// `DELETE /timesheet/time-slot` sends one command per log of the slot, over that slot's own ten minutes.
		const slot = asRead.timeSlots.find((timeSlot) => hhmm(timeSlot.startedAt) === '09:00');
		await store.send('09:00', '09:10', asRead, slot);

		expect(store.timeline()).toEqual([
			{ range: '08:00-09:00', isRunning: false, slots: slotStarts('08:00', '09:00') },
			{ range: '09:10-11:00', isRunning: false, slots: slotStarts('09:10', '11:00') }
		]);
		expect(store.slotCount()).toBe(17);
	});

	it('gives the second part the fields of the log it was cut from, on the same timesheet', async () => {
		const store = createStore();
		const fields = { projectId: 'project-1', taskId: 'task-1', description: 'Planned work' };
		store.addLog('tracked', '08:00', '11:00', fields);

		await store.cleanUp('09:00', '10:00');

		const [first, second] = store.rows();
		const kept = {
			tenantId: TENANT_ID,
			organizationId: ORGANIZATION_ID,
			employeeId: EMPLOYEE_ID,
			timesheetId: timesheetOf(at('08:00')),
			isRunning: false,
			source: TimeLogSourceEnum.DESKTOP,
			logType: TimeLogType.TRACKED,
			...fields
		};
		expect(first).toMatchObject({ id: 'tracked', startedAt: at('08:00'), stoppedAt: at('09:00'), ...kept });
		expect(second).toMatchObject({ startedAt: at('10:00'), stoppedAt: at('11:00'), ...kept });
		expect(second.id).not.toBe('tracked');
	});
});

/**
 * The split writes its two parts through separate handlers, with no transaction between them. A failed write must
 * not leave the time counted twice, nor let the caller record the new range over the log: the split leaves the log as
 * it was and raises the error, which stops the caller's loop and fails its request.
 */
describe('DeleteTimeSpanHandler when a split fails (#11823)', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
	});

	afterEach(() => jest.restoreAllMocks());

	/** The log as it was before the split: 08:00 to 11:00 with its 18 slots, and no other log. */
	const AS_IT_WAS = [{ range: '08:00-11:00', isRunning: false, slots: slotStarts('08:00', '11:00') }];

	it('leaves the log untouched and raises the error when the second part cannot be saved', async () => {
		const store = createStore();
		store.addLog('tracked', '08:00', '11:00');
		store.fail('insert');

		const outcome = await store.cleanUp('09:00', '10:00').then(raised, raised);

		expect(store.timeline()).toEqual(AS_IT_WAS);
		expect(store.slotCount()).toBe(18);
		expect(outcome).toBe('The insert failed');
	});

	it('leaves no second part and raises the error when the cut fails', async () => {
		const store = createStore();
		store.addLog('tracked', '08:00', '11:00');
		store.fail('update');

		const outcome = await store.cleanUp('09:00', '10:00').then(raised, raised);

		expect(store.timeline()).toEqual(AS_IT_WAS);
		expect(store.rows().map((row) => row.id)).toEqual(['tracked']);
		expect(outcome).toBe('The update failed');
	});

	it('finishes the split and raises the error when the cut fails while taking its later slots off it', async () => {
		const store = createStore();
		store.addLog('tracked', '08:00', '11:00');
		// The cut deletes the range's own slots, then takes the later ones, which the second part holds, off the log:
		// the third of those fails.
		store.fail('unlink', 2);

		const outcome = await store.cleanUp('09:00', '10:00').then(raised, raised);

		expect(store.timeline()).toEqual([
			{ range: '08:00-09:00', isRunning: false, slots: slotStarts('08:00', '09:00') },
			{ range: '10:00-11:00', isRunning: false, slots: slotStarts('10:00', '11:00') }
		]);
		expect(store.slotCount()).toBe(12);
		// The cut stopped before its totals: the recovery recalculates them.
		expect(store.recalculated()).toEqual({ timesheets: [timesheetOf(at('08:00'))], employees: [EMPLOYEE_ID] });
		expect(outcome).toBe('The unlink failed');
	});

	it('keeps the finished split and raises the error when the cut fails after releasing the range', async () => {
		const store = createStore();
		store.addLog('tracked', '08:00', '11:00');
		// Every write of the cut went through; only the timesheet's totals, its last step, fail.
		store.fail('recalculation');

		const outcome = await store.cleanUp('09:00', '10:00').then(raised, raised);

		expect(store.timeline()).toEqual([
			{ range: '08:00-09:00', isRunning: false, slots: slotStarts('08:00', '09:00') },
			{ range: '10:00-11:00', isRunning: false, slots: slotStarts('10:00', '11:00') }
		]);
		expect(store.slotCount()).toBe(12);
		// The recovery recalculates the totals the cut could not.
		expect(store.recalculated()).toEqual({ timesheets: [timesheetOf(at('08:00'))], employees: [EMPLOYEE_ID] });
		expect(outcome).toBe('The recalculation failed');
	});

	it('recalculates both timesheets when the failed cut had moved the log to its own week', async () => {
		const store = createStore();
		// Filed under the current week's timesheet, where a cut at its end leaves a log; the split's cut files it
		// under the week it starts in, while its second part stays where it was.
		const elsewhere = timesheetOf();
		store.addLog('tracked', '08:00', '11:00', { timesheetId: elsewhere });
		store.fail('unlink', 2);

		const outcome = await store.cleanUp('09:00', '10:00').then(raised, raised);

		expect(store.rows().map((row) => row.timesheetId)).toEqual([timesheetOf(at('08:00')), elsewhere]);
		expect(store.recalculated()).toEqual({
			timesheets: [elsewhere, timesheetOf(at('08:00'))],
			employees: [EMPLOYEE_ID]
		});
		expect(outcome).toBe('The unlink failed');
	});

	it('raises instead of splitting again a log whose failed recovery left its second part', async () => {
		const store = createStore();
		store.addLog('tracked', '08:00', '11:00');
		// The cut fails, then so does the delete of the second part that would have undone the split.
		store.fail('update');
		store.fail('delete');

		const first = await store.cleanUp('09:00', '10:00').then(raised, raised);
		const leftBehind = store.timeline();
		const retried = await store.cleanUp('09:00', '10:00').then(raised, raised);

		// The log, whole, and the second part beside it, as the failed recovery left them...
		expect(leftBehind).toEqual([
			{ range: '08:00-11:00', isRunning: false, slots: slotStarts('08:00', '11:00') },
			{ range: '10:00-11:00', isRunning: false, slots: slotStarts('10:00', '11:00') }
		]);
		expect(first).toBe('The update failed');
		// ...and no further copy: the next cleanup of that log refuses to split it.
		expect(store.timeline()).toEqual(leftBehind);
		expect(retried).toContain('second part');
	});

	it('splits the log again once the second part a failed recovery left has been deleted', async () => {
		const store = createStore();
		store.addLog('tracked', '08:00', '11:00');
		store.fail('update');
		store.fail('delete');
		await store.cleanUp('09:00', '10:00').then(raised, raised);
		const [, leftBehind] = store.rows();
		store.discard(leftBehind.id);

		const retried = await store.cleanUp('09:00', '10:00').then(raised, raised);

		expect(store.timeline()).toEqual([
			{ range: '08:00-09:00', isRunning: false, slots: slotStarts('08:00', '09:00') },
			{ range: '10:00-11:00', isRunning: false, slots: slotStarts('10:00', '11:00') }
		]);
		expect(retried).toBeUndefined();
	});

	it('splits a log that a separate log overlaps up to the same end, as older data can have them', async () => {
		const store = createStore();
		store.addLog('tracked', '08:00', '11:00');
		// Not a part of `tracked`: a log of its own over the same last hour.
		store.addLog('separate', '10:00', '11:00');

		const outcome = await store.cleanUp('09:00', '09:30').then(raised, raised);

		expect(store.timeline()).toEqual([
			{ range: '08:00-09:00', isRunning: false, slots: slotStarts('08:00', '09:00') },
			{ range: '09:30-11:00', isRunning: false, slots: slotStarts('09:30', '11:00') },
			{ range: '10:00-11:00', isRunning: false, slots: slotStarts('10:00', '11:00') }
		]);
		expect(outcome).toBeUndefined();
	});
});

describe('DeleteTimeSpanHandler and two cleanups of one log at once (#11823)', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
	});

	afterEach(() => jest.restoreAllMocks());

	it('splits the log once when two cleanups of the same range run at the same time', async () => {
		const store = createStore();
		store.addLog('tracked', '08:00', '11:00');

		// Two requests over 09:00–10:00 (the same entry sent twice), both reading the log before either writes.
		await Promise.all([store.cleanUp('09:00', '10:00'), store.cleanUp('09:00', '10:00')]);

		expect(store.timeline()).toEqual([
			{ range: '08:00-09:00', isRunning: false, slots: slotStarts('08:00', '09:00') },
			{ range: '10:00-11:00', isRunning: false, slots: slotStarts('10:00', '11:00') }
		]);
	});
});

/**
 * A cut at one end of a log, or the delete of a log the range covers, that fails must not let the caller record the
 * new range over the log either: the error is raised, as a failed split's is, and the caller writes nothing.
 */
describe('DeleteTimeSpanHandler when a cut at one end or a delete fails (#11823)', () => {
	beforeEach(() => {
		jest.spyOn(console, 'log').mockImplementation(() => undefined);
		jest.spyOn(RequestContext, 'currentTenantId').mockReturnValue(TENANT_ID);
	});

	afterEach(() => jest.restoreAllMocks());

	/** The log of 08:00 to 10:00 with its 12 slots, as it was. */
	const AS_IT_WAS = [{ range: '08:00-10:00', isRunning: false, slots: slotStarts('08:00', '10:00') }];

	it.each([
		['takes its end', '09:00', '11:00', 'update'],
		['takes its start', '07:00', '09:00', 'update'],
		['covers it', '07:00', '11:00', 'slotRemoval']
	] as const)(
		'leaves the log as it was and raises the error when the range %s and the cleanup cannot write',
		async (_shape, start, stop, write) => {
			const store = createStore();
			store.addLog('tracked', '08:00', '10:00');
			store.fail(write);

			const outcome = await store.cleanUp(start, stop).then(raised, raised);

			expect(store.timeline()).toEqual(AS_IT_WAS);
			expect(outcome).toBe(`The ${write} failed`);
		}
	);

	it('fails addManualTime, writing nothing, when the cut of the log it overlaps fails', async () => {
		const store = createStore();
		store.addLog('tracked', '08:00', '10:00');
		store.fail('update', 0, Infinity);

		const refusal = await store.addManualTime('09:00', '11:00').catch((thrown) => thrown);

		expect(store.timeline()).toEqual(AS_IT_WAS);
		expect(refusal).toBeInstanceOf(BadRequestException);
		expect(refusal.message).toContain('The update failed');
	});

	it('leaves no slot beyond a new end, and raises the error, when the cut fails to let go of a shared one', async () => {
		const store = createStore();
		store.addLog('tracked', '08:00', '09:55');
		// The next log starts at 09:55, inside the 09:50 slot, which both logs hold.
		store.addLog('next', '09:55', '10:30');
		store.share('tracked@09:50', 'next');
		// The cut back to 09:00 releases 09:00 to 09:50: taking the log off the shared 09:50 slot fails.
		store.fail('unlink');

		const outcome = await store.cleanUp('09:00', '09:55').then(raised, raised);

		// The slots only `tracked` held there are deleted, and it no longer holds the shared one, which stays `next`'s.
		expect(store.timeline()).toEqual([
			{ range: '08:00-09:00', isRunning: false, slots: slotStarts('08:00', '09:00') },
			{ range: '09:55-10:30', isRunning: false, slots: slotStarts('09:55', '10:30') }
		]);
		// A cut at the end names the log's own start, so the log stays under its own week's timesheet.
		expect(store.recalculated()).toEqual({
			timesheets: [timesheetOf(at('08:00'))],
			employees: [EMPLOYEE_ID]
		});
		expect(outcome).toBe('The unlink failed');
	});

	it('leaves no slot before a new start, and raises the error, when the cut fails to let go of a shared one', async () => {
		const store = createStore();
		// The previous log ends at 08:05, inside the 08:00 slot, which both logs hold.
		store.addLog('previous', '07:30', '08:05');
		store.addLog('tracked', '08:05', '10:00');
		store.share('tracked@08:00', 'previous');
		// The cut to a new start at 09:00 releases 08:00 to 08:50: taking the log off the shared 08:00 slot fails.
		store.fail('unlink');

		const outcome = await store.cleanUp('08:05', '09:00').then(raised, raised);

		expect(store.timeline()).toEqual([
			{ range: '07:30-08:05', isRunning: false, slots: slotStarts('07:30', '08:05') },
			{ range: '09:00-10:00', isRunning: false, slots: slotStarts('09:00', '10:00') }
		]);
		expect(outcome).toBe('The unlink failed');
	});

	it('recalculates both timesheets when the failed cut had moved the log to the week of its new start', async () => {
		const store = createStore();
		// From Saturday 23:00 to Sunday 01:00: a new start at midnight files the log under the next week's timesheet.
		store.addLog('tracked', '2026-10-10T23:00', '2026-10-11T01:00');
		const before = timesheetOf(at('2026-10-10T23:00'));
		const after = timesheetOf(at('2026-10-11T00:00'));
		expect(after).not.toBe(before);
		// The cut writes the new start and timesheet, then fails to delete the slots before it.
		store.fail('slotRemoval');

		const outcome = await store.cleanUp('2026-10-10T22:00', '2026-10-11T00:00').then(raised, raised);

		expect(store.rows().map((row) => row.timesheetId)).toEqual([after]);
		expect(store.recalculated()).toEqual({ timesheets: [before, after], employees: [EMPLOYEE_ID] });
		expect(outcome).toBe('The slotRemoval failed');
	});
});
