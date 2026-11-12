// Must stay first: loads the entity graph before any handler pulls an entity (see activity.controller.spec.ts).
import '../../../../core/entities/internal';

import { ITimeSlot, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { RequestContext } from '../../../../core/context';
import { moment } from '../../../../core/moment-extend';
import { MultiORMEnum } from '../../../../core/utils';
import { TimesheetFirstOrCreateCommand, TimesheetRecalculateCommand } from '../../../timesheet/commands';
import { TimeSlotBulkDeleteCommand } from '../../../time-slot/commands';
import { TimeSlotBulkDeleteHandler } from '../../../time-slot/commands/handlers/time-slot-bulk-delete.handler';
import { generateTimeSlots } from '../../../time-slot/utils';
import { TimeLog } from '../../time-log.entity';
import { DeleteTimeSpanCommand } from '../delete-time-span.command';
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

/** 2026-10-12 at `time`, UTC. */
const at = (time: string) => new Date(`2026-10-12T${time}:00.000Z`);

/** The `HH:mm` of a date, UTC. */
const hhmm = (date: Date) => date.toISOString().slice(11, 16);

/** The start of each ten-minute slot of `start`–`stop`. */
const slotStarts = (start: string, stop: string) =>
	generateTimeSlots(at(start), at(stop)).map((slot) => hhmm(new Date(slot.startedAt)));

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
		update: jest.fn(async (where: { id: string }, changes: Partial<TimeLog>) => {
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
					of: (slotId: string) => ({
						remove: async (timeLogId: string) => {
							const slot = slots.find((stored) => stored.id === slotId);
							slot.timeLogIds = slot.timeLogIds.filter((id) => id !== timeLogId);
						}
					})
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
		softRemove: jest.fn(async (removed: ITimeSlot[]) => {
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
		if (command instanceof TimesheetRecalculateCommand) return undefined;
		if (command instanceof UpdateEmployeeTotalWorkedHoursCommand) return undefined;
		throw new Error(`Unexpected command ${(command as object)?.constructor?.name}`);
	});
	const handler = new DeleteTimeSpanHandler(timeLogRepository as any, timeSlotRepository as any, commandBus as any);

	return {
		executed,
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
			const conflicts = logs
				.filter((log) => !log.deletedAt && log.startedAt < range.end && log.stoppedAt > range.start)
				.map((log) => logEntity(log, true))
				.filter((log) => log.timeSlots.length > 0);
			const results: boolean[] = [];
			for (const timeLog of conflicts) {
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
