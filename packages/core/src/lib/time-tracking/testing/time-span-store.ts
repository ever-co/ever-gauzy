import * as moment from 'moment';
import { IGetTimeLogConflictInput, ITimeSlot, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { MultiORMEnum } from '../../core/utils';
import {
	DeleteTimeSpanCommand,
	IGetConflictTimeLogCommand,
	TimeLogCreateCommand,
	TimeLogDeleteCommand,
	TimeLogUpdateCommand,
	UpdateEmployeeTotalWorkedHoursCommand
} from '../time-log/commands';
import { DeleteTimeSpanHandler } from '../time-log/commands/handlers/delete-time-span.handler';
import { TimeLogDeleteHandler } from '../time-log/commands/handlers/time-log-delete.handler';
import { TimeLogUpdateHandler } from '../time-log/commands/handlers/time-log-update.handler';
import { TimeLog } from '../time-log/time-log.entity';
import { TimeSlotBulkDeleteCommand, TimeSlotDurationRecalculateCommand } from '../time-slot/commands';
import { TimeSlotBulkDeleteHandler } from '../time-slot/commands/handlers/time-slot-bulk-delete.handler';
import { TimeSlotDurationRecalculateHandler } from '../time-slot/commands/handlers/time-slot-duration-recalculate.handler';
import { generateTimeSlots } from '../time-slot/utils';
import { TimesheetFirstOrCreateCommand, TimesheetRecalculateCommand } from '../timesheet/commands';

export const SPAN_TENANT_ID = '6b2d3f1a-7e4c-4d9b-8f3a-2c8e5b7d9f01';
export const SPAN_ORGANIZATION_ID = '1a0f9e8d-7c6b-4d4e-9f3a-2b1c0d9e8f72';
export const SPAN_EMPLOYEE_ID = '8f7e6d5c-4b3a-4291-8a9f-8e7d6c5b4a33';
export const SPAN_TIMESHEET_ID = '3c4d5e6f-7a8b-4c9d-9e0f-1a2b3c4d5e64';

/** The day every log of the store is on. */
const DAY = '2026-11-02';

/** A moment of the store's day, from its `HH:mm`, in UTC. */
export function at(time: string): Date {
	return new Date(`${DAY}T${time}:00.000Z`);
}

/** The `HH:mm` of a moment of the store's day. */
function clock(date: Date): string {
	return new Date(date).toISOString().slice(11, 16);
}

/** A slot start as the merge of the slots stores it: whole minutes, without seconds or milliseconds. */
function wholeMinute(date: Date): Date {
	const minute = new Date(date);
	minute.setUTCSeconds(0, 0);
	return minute;
}

/** The most a time slot counts, as the merge of the slots caps it. */
const TIME_SLOT_SECONDS = 600;

export interface StoredTimeSlot {
	id: string;
	employeeId: string;
	organizationId: string;
	tenantId: string;
	startedAt: Date;
	duration: number;
	timeLogs: Array<Pick<TimeLog, 'id'>>;
	screenshots: unknown[];
	activities: unknown[];
	timeSlotMinutes: unknown[];
	deletedAt?: Date;
}

/** A slot a log's time gives one of its ten minutes, as `generateTimeSlots` and the slot writers pass it. */
interface IncomingTimeSlot {
	startedAt: Date;
	duration?: number;
	timeLogId?: string;
}

/** A log as the specs read it back: its start, its stop and the start of each time slot it holds (`HH:mm`). */
export type TimeLogShape = [string, string, string[]];

type CommandRoute = (command: never) => unknown;

/** A partial double, handed to a constructor that types the whole dependency. */
function asDependency<T>(double: unknown): T {
	return double as T;
}

/**
 * The time logs and time slots of one employee, and the links between them, behind the repositories and the command
 * bus of the handlers that take a span of time out of a log: DeleteTimeSpanHandler, and the TimeLogUpdateHandler,
 * TimeLogDeleteHandler and TimeSlotBulkDeleteHandler it runs, all real, as is TimeSlotDurationRecalculateHandler. The
 * conflict lookup, the creation of a manual log and the timesheet and worked-hours commands are scripted. Reads leave
 * out what is deleted, as TypeORM's soft delete does, joined time logs included.
 */
export class TimeSpanStore {
	readonly timeLogs: TimeLog[] = [];
	readonly timeSlots: StoredTimeSlot[] = [];
	readonly execute = jest.fn((command: unknown) => this.dispatch(command));

	private createdTimeLogs = 0;
	private createdTimeSlots = 0;
	private readonly routes = new Map<unknown, CommandRoute>();

	constructor() {
		const timeLogRepository = this.timeLogRepository();
		const timeSlotRepository = this.timeSlotRepository();
		const timeSlotService = this.timeSlotService();
		const commandBus = { execute: this.execute };

		const deleteTimeSpan = new DeleteTimeSpanHandler(
			asDependency(timeLogRepository),
			asDependency(timeSlotRepository),
			asDependency(commandBus)
		);
		const updateTimeLog = new TimeLogUpdateHandler(
			asDependency(commandBus),
			asDependency(timeLogRepository),
			asDependency(timeSlotRepository),
			asDependency({}),
			asDependency(timeSlotService)
		);
		const deleteTimeLog = new TimeLogDeleteHandler(
			asDependency(timeLogRepository),
			asDependency({}),
			asDependency(commandBus)
		);
		const deleteTimeSlots = new TimeSlotBulkDeleteHandler(asDependency(timeSlotRepository), asDependency({}));
		const recalculateDurations = new TimeSlotDurationRecalculateHandler(
			asDependency(timeSlotRepository),
			asDependency(commandBus)
		);
		Object.defineProperty(updateTimeLog, 'ormType', { value: MultiORMEnum.TypeORM });
		Object.defineProperty(deleteTimeSlots, 'ormType', { value: MultiORMEnum.TypeORM });

		this.routes.set(DeleteTimeSpanCommand, (command) => deleteTimeSpan.execute(command));
		this.routes.set(TimeLogUpdateCommand, (command) => updateTimeLog.execute(command));
		this.routes.set(TimeLogDeleteCommand, (command) => deleteTimeLog.execute(command));
		this.routes.set(TimeSlotBulkDeleteCommand, (command) => deleteTimeSlots.execute(command));
		this.routes.set(TimeSlotDurationRecalculateCommand, (command) => recalculateDurations.execute(command));
		this.routes.set(IGetConflictTimeLogCommand, (command: IGetConflictTimeLogCommand) =>
			this.conflictsWith(command.input)
		);
		this.routes.set(TimeLogCreateCommand, (command: TimeLogCreateCommand) =>
			this.createManualTimeLog(command.input)
		);
		this.routes.set(TimesheetFirstOrCreateCommand, (command: TimesheetFirstOrCreateCommand) =>
			this.timesheetOfWeek(command.date)
		);
		this.routes.set(TimesheetRecalculateCommand, () => undefined);
		this.routes.set(UpdateEmployeeTotalWorkedHoursCommand, () => undefined);
	}

	/**
	 * Stores a log of the employee, with a time slot for each ten minutes its time reaches; a slot already stored at
	 * one of those starts (a neighbour's) is shared, not added again, and counts the log's time on top of its own, as
	 * the merge of the slots sums two slots of the same ten minutes.
	 *
	 * @param id - The log's id.
	 * @param from - Its start, `HH:mm`.
	 * @param to - Its stop, `HH:mm`.
	 * @param columns - Any other column of the log.
	 */
	addTimeLog(id: string, from: string, to: string, columns: Partial<TimeLog> = {}): void {
		const log = Object.assign(new TimeLog(), {
			id,
			tenantId: SPAN_TENANT_ID,
			organizationId: SPAN_ORGANIZATION_ID,
			employeeId: SPAN_EMPLOYEE_ID,
			timesheetId: SPAN_TIMESHEET_ID,
			startedAt: at(from),
			stoppedAt: at(to),
			logType: TimeLogType.TRACKED,
			source: TimeLogSourceEnum.DESKTOP,
			isRunning: false,
			...columns
		});
		this.timeLogs.push(log);
		const generated: IncomingTimeSlot[] = generateTimeSlots(log.startedAt, log.stoppedAt);
		const timeSlots = generated.map((slot) => this.timeSlotCounting(slot));
		this.linkExactly(log.id, timeSlots);
	}

	/**
	 * The stored log with its time slots, as `findOne` with the `timeSlots` relation loads it, or `null` once deleted.
	 *
	 * @param id - The log's id.
	 */
	read(id: string): TimeLog | null {
		const copy = this.copyOfTimeLog(id);
		if (!copy) {
			return null;
		}
		const timeSlots = this.liveTimeSlotsOf(id).map((slot) => this.loadedTimeSlot(slot));
		return Object.assign(copy, { timeSlots });
	}

	/** Every log not deleted, by start. */
	shapes(): TimeLogShape[] {
		const live = this.timeLogs.filter((log) => !log.deletedAt);
		const byStart = [...live].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
		return byStart.map((log) => this.shapeOf(log));
	}

	/**
	 * Makes every command of the given class fail, as a write that loses the database connection.
	 *
	 * @param commandClass - The class of the commands that fail.
	 */
	failOn(commandClass: unknown): void {
		const failure = new Error('The database connection was lost');
		this.routes.set(commandClass, () => Promise.reject(failure));
	}

	/** Every slot not deleted, by start: its start (`HH:mm`) and its duration in seconds. */
	timeSlotDurations(): Array<[string, number]> {
		const live = this.timeSlots.filter((slot) => !slot.deletedAt);
		const byStart = [...live].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
		return byStart.map((slot) => [clock(slot.startedAt), slot.duration]);
	}

	private shapeOf(log: TimeLog): TimeLogShape {
		const starts = this.liveTimeSlotsOf(log.id).map((slot) => clock(slot.startedAt));
		const sortedStarts = starts.sort((a, b) => a.localeCompare(b));
		return [clock(log.startedAt), clock(log.stoppedAt), sortedStarts];
	}

	/** Runs the command's route, as a command bus answers: through a promise. */
	private dispatch(command: unknown): Promise<unknown> {
		const route = this.routes.get((command as object).constructor);
		if (!route) {
			return Promise.resolve(undefined);
		}
		return Promise.resolve(route(command as never));
	}

	private liveTimeLog(id: string): TimeLog | undefined {
		return this.timeLogs.find((log) => log.id === id && !log.deletedAt);
	}

	/** The stored log as a read answers it: a copy, which reaches the store again only through a write. */
	private copyOfTimeLog(id: string): TimeLog | null {
		const stored = this.liveTimeLog(id);
		if (!stored) {
			return null;
		}
		return Object.assign(new TimeLog(), stored);
	}

	private liveTimeSlotsOf(timeLogId: string): StoredTimeSlot[] {
		const live = this.timeSlots.filter((slot) => !slot.deletedAt);
		return live.filter((slot) => slot.timeLogs.some((link) => link.id === timeLogId));
	}

	/** The slot's columns, without its links, as a log's `timeSlots` relation loads it. */
	private loadedTimeSlot(slot: StoredTimeSlot): ITimeSlot {
		const { id, employeeId, organizationId, tenantId, startedAt, duration } = slot;
		return { id, employeeId, organizationId, tenantId, startedAt, duration } as ITimeSlot;
	}

	/** The slot with the logs that still hold it, each with its columns, as the slot queries join them. */
	private joinedTimeSlot(slot: StoredTimeSlot): StoredTimeSlot {
		const linkedTimeLogs = slot.timeLogs.map((link) => this.copyOfTimeLog(link.id));
		const timeLogs = linkedTimeLogs.filter(Boolean);
		return { ...slot, timeLogs };
	}

	/**
	 * The employee's slot stored at each start, kept as it is, as TimeSlotBulkCreateHandler keeps it; a start without
	 * one gets a new slot counting the incoming duration, linked to the given log.
	 *
	 * @param starts - The incoming slots.
	 */
	private timeSlotsAt(starts: IncomingTimeSlot[]): StoredTimeSlot[] {
		return starts.map((start) => this.storedTimeSlotAt(start.startedAt) ?? this.insertTimeSlot(start));
	}

	/**
	 * The employee's slot stored at the incoming slot's start, counting the incoming duration on top of its own (at
	 * most 600 seconds), or a new slot counting it.
	 *
	 * @param incoming - The incoming slot.
	 */
	private timeSlotCounting(incoming: IncomingTimeSlot): StoredTimeSlot {
		const stored = this.storedTimeSlotAt(incoming.startedAt);
		if (!stored) {
			return this.insertTimeSlot(incoming);
		}
		const incomingDuration = incoming.duration ?? 0;
		const summed = stored.duration + incomingDuration;
		stored.duration = Math.min(summed, TIME_SLOT_SECONDS);
		return stored;
	}

	private storedTimeSlotAt(startedAt: Date): StoredTimeSlot | undefined {
		const time = wholeMinute(startedAt).getTime();
		return this.timeSlots.find((slot) => !slot.deletedAt && slot.startedAt.getTime() === time);
	}

	private insertTimeSlot(start: IncomingTimeSlot): StoredTimeSlot {
		this.createdTimeSlots += 1;
		const timeLogs = [start.timeLogId].filter(Boolean).map((id) => ({ id }));
		const slot: StoredTimeSlot = {
			id: `slot-${this.createdTimeSlots}`,
			employeeId: SPAN_EMPLOYEE_ID,
			organizationId: SPAN_ORGANIZATION_ID,
			tenantId: SPAN_TENANT_ID,
			startedAt: wholeMinute(start.startedAt),
			duration: start.duration ?? 0,
			timeLogs,
			screenshots: [],
			activities: [],
			timeSlotMinutes: []
		};
		this.timeSlots.push(slot);
		return slot;
	}

	/** Links the log to the employee's slot at each start its time reaches, adding the missing ones with its time. */
	private linkToItsTime(log: TimeLog): void {
		const generated: IncomingTimeSlot[] = generateTimeSlots(log.startedAt, log.stoppedAt);
		const incoming = generated.map((slot) => ({ ...slot, timeLogId: log.id }));
		const slots = this.timeSlotsAt(incoming);
		this.linkExactly(log.id, slots);
	}

	/** Saving a log with `timeSlots` makes them its slots: the join rows of the relation, as TypeORM writes them. */
	private linkExactly(timeLogId: string, timeSlots: Array<Pick<ITimeSlot, 'id'>>): void {
		const linkedIds = new Set(timeSlots.map((slot) => slot.id));
		for (const slot of this.timeSlots) {
			const others = slot.timeLogs.filter((link) => link.id !== timeLogId);
			slot.timeLogs = others;
			if (linkedIds.has(slot.id)) {
				slot.timeLogs = [...others, { id: timeLogId }];
			}
		}
	}

	private saveTimeLog(log: TimeLog): TimeLog {
		const { timeSlots, ...columns } = log;
		const stored = this.liveTimeLog(log.id) ?? this.insertTimeLog();
		Object.assign(stored, columns, { id: stored.id });
		if (Array.isArray(timeSlots)) {
			this.linkExactly(stored.id, timeSlots);
		}
		return stored;
	}

	private insertTimeLog(): TimeLog {
		this.createdTimeLogs += 1;
		const log = Object.assign(new TimeLog(), { id: `log-${this.createdTimeLogs}` });
		this.timeLogs.push(log);
		return log;
	}

	private deleteTimeLogs(ids: unknown): void {
		const deleted = new Set([ids].flat());
		for (const log of this.timeLogs) {
			if (deleted.has(log.id)) {
				log.deletedAt = new Date();
			}
		}
	}

	private removeTimeSlots(removed: StoredTimeSlot | StoredTimeSlot[]): StoredTimeSlot | StoredTimeSlot[] {
		const removedIds = new Set([removed].flat().map((slot) => slot.id));
		for (const slot of this.timeSlots) {
			if (removedIds.has(slot.id)) {
				slot.deletedAt = new Date();
			}
		}
		return removed;
	}

	/** The time slots the TypeORM slot queries of these handlers select: employee, tenant, start times and ids. */
	private matchingTimeSlots(parameters: Record<string, unknown>): StoredTimeSlot[] {
		const requestedStarts = parameters.startTimes as Date[] | undefined;
		const startTimes = requestedStarts?.map((time) => new Date(time).getTime());
		const ids = parameters.timeSlotsIds as string[] | undefined;
		const matches = (slot: StoredTimeSlot) => {
			const isLive = !slot.deletedAt;
			const isInScope = slot.employeeId === parameters.employeeId && slot.tenantId === parameters.tenantId;
			const isAtStart = !startTimes || startTimes.includes(slot.startedAt.getTime());
			const isNamed = !ids || ids.includes(slot.id);
			return isLive && isInScope && isAtStart && isNamed;
		};
		return this.timeSlots.filter(matches).map((slot) => this.joinedTimeSlot(slot));
	}

	private timeSlotQuery() {
		const parameters: Record<string, unknown> = {};
		const addParameters = (_condition: string, values: Record<string, unknown>) => {
			Object.assign(parameters, values);
			return query;
		};
		const query = {
			alias: 'time_slot',
			leftJoinAndSelect: () => query,
			where: addParameters,
			andWhere: addParameters,
			getParameters: () => parameters,
			getMany: () => Promise.resolve(this.matchingTimeSlots(parameters)),
			relation: () => ({ of: (slotId: string) => this.linksOf(slotId) })
		};
		return query;
	}

	/** `relation(TimeSlot, 'timeLogs').of(slot)`: the join rows of one slot. */
	private linksOf(slotId: string) {
		const slot = this.timeSlots.find((stored) => stored.id === slotId);
		return {
			remove: (timeLogId: string) => {
				slot.timeLogs = slot.timeLogs.filter((link) => link.id !== timeLogId);
				return Promise.resolve();
			}
		};
	}

	private timeLogRepository() {
		return {
			findOne: ({ where }: { where: { id: string } }) => Promise.resolve(this.read(where.id)),
			findOneBy: ({ id }: { id: string }) => Promise.resolve(this.copyOfTimeLog(id)),
			update: ({ id }: { id: string }, changes: Partial<TimeLog>) => {
				Object.assign(this.liveTimeLog(id), changes);
				return Promise.resolve({ affected: 1 });
			},
			save: (log: TimeLog) => Promise.resolve(this.saveTimeLog(log)),
			softDelete: ({ id }: { id: { value: unknown } }) => Promise.resolve(this.deleteTimeLogs(id.value)),
			delete: ({ id }: { id: { value: unknown } }) => Promise.resolve(this.deleteTimeLogs(id.value))
		};
	}

	private timeSlotRepository() {
		return {
			createQueryBuilder: () => this.timeSlotQuery(),
			update: ({ id }: { id: string }, changes: Partial<StoredTimeSlot>) => {
				const slot = this.timeSlots.find((stored) => stored.id === id);
				Object.assign(slot, changes);
				return Promise.resolve({ affected: 1 });
			},
			softRemove: (removed: StoredTimeSlot | StoredTimeSlot[]) => Promise.resolve(this.removeTimeSlots(removed)),
			remove: (removed: StoredTimeSlot | StoredTimeSlot[]) => Promise.resolve(this.removeTimeSlots(removed))
		};
	}

	/** As TimeSlotService, whose bulk create gives back the employee's slot at a start instead of adding another. */
	private timeSlotService() {
		return {
			generateTimeSlots: (start: Date, end: Date) => generateTimeSlots(start, end),
			bulkCreate: (slots: IncomingTimeSlot[]) => Promise.resolve(this.timeSlotsAt(slots))
		};
	}

	/**
	 * As GetConflictTimeLogHandler under TypeORM: the employee's logs whose time overlaps the range, other than the
	 * ignored ones, each with its time slots; a log holding none is not listed (the slots are inner-joined).
	 */
	private conflictsWith(input: IGetTimeLogConflictInput): TimeLog[] {
		const ignored = new Set([input.ignoreId].flat());
		const start = new Date(input.startDate).getTime();
		const end = new Date(input.endDate).getTime();
		const conflicts = (log: TimeLog) => {
			const isLive = !log.deletedAt;
			const isTheEmployees = log.employeeId === input.employeeId && log.organizationId === input.organizationId;
			const isIgnored = ignored.has(log.id);
			const startsBeforeEnd = new Date(log.startedAt).getTime() < end;
			const stopsAfterStart = new Date(log.stoppedAt).getTime() > start;
			const holdsTimeSlots = this.liveTimeSlotsOf(log.id).length > 0;
			return isLive && isTheEmployees && !isIgnored && startsBeforeEnd && stopsAfterStart && holdsTimeSlots;
		};
		return this.timeLogs.filter(conflicts).map((log) => this.read(log.id));
	}

	/** As TimeLogCreateHandler: the manual log, linked to the employee's slot at each start its time reaches. */
	private createManualTimeLog(input: Partial<TimeLog>): TimeLog {
		this.createdTimeLogs += 1;
		const log = Object.assign(new TimeLog(), {
			id: `manual-${this.createdTimeLogs}`,
			tenantId: SPAN_TENANT_ID,
			organizationId: input.organizationId,
			employeeId: input.employeeId,
			timesheetId: SPAN_TIMESHEET_ID,
			startedAt: new Date(input.startedAt),
			stoppedAt: new Date(input.stoppedAt),
			logType: TimeLogType.MANUAL,
			source: TimeLogSourceEnum.WEB_TIMER,
			isRunning: false
		});
		this.timeLogs.push(log);
		this.linkToItsTime(log);
		return log;
	}

	/**
	 * As TimesheetFirstOrCreateHandler: the employee's timesheet of the week the date falls in, the current week's
	 * without a date. The store's day is in the week of SPAN_TIMESHEET_ID.
	 *
	 * @param date - The date the timesheet is asked for.
	 */
	private timesheetOfWeek(date: Date | undefined): { id: string } {
		const week = moment.utc(date).startOf('week');
		const storeWeek = moment.utc(at('00:00')).startOf('week');
		if (week.isSame(storeWeek)) {
			return { id: SPAN_TIMESHEET_ID };
		}
		const weekStart = week.format('YYYY-MM-DD');
		return { id: `timesheet-${weekStart}` };
	}
}
