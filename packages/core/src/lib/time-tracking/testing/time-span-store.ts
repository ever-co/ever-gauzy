import { ITimeSlot, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { MultiORMEnum } from '../../core/utils';
import {
	DeleteTimeSpanCommand,
	TimeLogDeleteCommand,
	TimeLogUpdateCommand,
	UpdateEmployeeTotalWorkedHoursCommand
} from '../time-log/commands';
import { DeleteTimeSpanHandler } from '../time-log/commands/handlers/delete-time-span.handler';
import { TimeLogDeleteHandler } from '../time-log/commands/handlers/time-log-delete.handler';
import { TimeLogUpdateHandler } from '../time-log/commands/handlers/time-log-update.handler';
import { TimeLog } from '../time-log/time-log.entity';
import { TimeSlotBulkDeleteCommand } from '../time-slot/commands';
import { TimeSlotBulkDeleteHandler } from '../time-slot/commands/handlers/time-slot-bulk-delete.handler';
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

export interface StoredTimeSlot {
	id: string;
	employeeId: string;
	organizationId: string;
	tenantId: string;
	startedAt: Date;
	timeLogs: Array<{ id: string }>;
	screenshots: unknown[];
	activities: unknown[];
	timeSlotMinutes: unknown[];
	deletedAt?: Date;
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
 * TimeLogDeleteHandler and TimeSlotBulkDeleteHandler it runs, all real; the timesheet and worked-hours commands are
 * scripted. Reads leave out what is deleted, as TypeORM's soft delete does, joined time logs included.
 */
export class TimeSpanStore {
	readonly timeLogs: TimeLog[] = [];
	readonly timeSlots: StoredTimeSlot[] = [];
	readonly execute = jest.fn(async (command: unknown) => this.dispatch(command));

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
		Object.defineProperty(updateTimeLog, 'ormType', { value: MultiORMEnum.TypeORM });
		Object.defineProperty(deleteTimeSlots, 'ormType', { value: MultiORMEnum.TypeORM });

		this.routes.set(DeleteTimeSpanCommand, (command) => deleteTimeSpan.execute(command));
		this.routes.set(TimeLogUpdateCommand, (command) => updateTimeLog.execute(command));
		this.routes.set(TimeLogDeleteCommand, (command) => deleteTimeLog.execute(command));
		this.routes.set(TimeSlotBulkDeleteCommand, (command) => deleteTimeSlots.execute(command));
		this.routes.set(TimesheetFirstOrCreateCommand, () => ({ id: SPAN_TIMESHEET_ID }));
		this.routes.set(TimesheetRecalculateCommand, () => undefined);
		this.routes.set(UpdateEmployeeTotalWorkedHoursCommand, () => undefined);
	}

	/**
	 * Stores a log of the employee, with a time slot for each ten minutes its time reaches; a slot already stored at
	 * one of those starts (a neighbour's) is shared, not added again.
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
		this.linkToItsTime(log);
	}

	/**
	 * The stored log with its time slots, as `findOne` with the `timeSlots` relation loads it, or `null` once deleted.
	 *
	 * @param id - The log's id.
	 */
	read(id: string): TimeLog | null {
		const stored = this.liveTimeLog(id);
		if (!stored) {
			return null;
		}
		const timeSlots = this.liveTimeSlotsOf(id).map((slot) => this.loadedTimeSlot(slot));
		return Object.assign(new TimeLog(), stored, { timeSlots });
	}

	/** Every log not deleted, by start. */
	shapes(): TimeLogShape[] {
		const live = this.timeLogs.filter((log) => !log.deletedAt);
		const byStart = [...live].sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
		return byStart.map((log) => this.shapeOf(log));
	}

	private shapeOf(log: TimeLog): TimeLogShape {
		const starts = this.liveTimeSlotsOf(log.id).map((slot) => clock(slot.startedAt));
		return [clock(log.startedAt), clock(log.stoppedAt), starts.sort()];
	}

	private async dispatch(command: unknown): Promise<unknown> {
		const route = this.routes.get((command as object).constructor);
		if (!route) {
			return undefined;
		}
		return route(command as never);
	}

	private liveTimeLog(id: string): TimeLog | undefined {
		return this.timeLogs.find((log) => log.id === id && !log.deletedAt);
	}

	private liveTimeSlotsOf(timeLogId: string): StoredTimeSlot[] {
		const live = this.timeSlots.filter((slot) => !slot.deletedAt);
		return live.filter((slot) => slot.timeLogs.some((link) => link.id === timeLogId));
	}

	/** The slot's columns, without its links, as a log's `timeSlots` relation loads it. */
	private loadedTimeSlot(slot: StoredTimeSlot): ITimeSlot {
		const { id, employeeId, organizationId, tenantId, startedAt } = slot;
		return { id, employeeId, organizationId, tenantId, startedAt } as ITimeSlot;
	}

	/** The slot with the logs that still hold it, as the slot queries join them. */
	private joinedTimeSlot(slot: StoredTimeSlot): StoredTimeSlot {
		const timeLogs = slot.timeLogs.filter((link) => this.liveTimeLog(link.id));
		return { ...slot, timeLogs };
	}

	/**
	 * The employee's slot stored at each start, a new one linked to the given log for a start without any.
	 *
	 * @param starts - The slots' starts, with the log a new slot is linked to.
	 */
	private timeSlotsAt(starts: Array<{ startedAt: Date; timeLogId?: string }>): StoredTimeSlot[] {
		return starts.map((start) => this.storedTimeSlotAt(start.startedAt) ?? this.insertTimeSlot(start));
	}

	private storedTimeSlotAt(startedAt: Date): StoredTimeSlot | undefined {
		const time = wholeMinute(startedAt).getTime();
		return this.timeSlots.find((slot) => !slot.deletedAt && slot.startedAt.getTime() === time);
	}

	private insertTimeSlot(start: { startedAt: Date; timeLogId?: string }): StoredTimeSlot {
		this.createdTimeSlots += 1;
		const timeLogs = [start.timeLogId].filter(Boolean).map((id) => ({ id }));
		const slot: StoredTimeSlot = {
			id: `slot-${this.createdTimeSlots}`,
			employeeId: SPAN_EMPLOYEE_ID,
			organizationId: SPAN_ORGANIZATION_ID,
			tenantId: SPAN_TENANT_ID,
			startedAt: wholeMinute(start.startedAt),
			timeLogs,
			screenshots: [],
			activities: [],
			timeSlotMinutes: []
		};
		this.timeSlots.push(slot);
		return slot;
	}

	/** Links the log to the employee's slot at each start its time reaches, adding the missing ones. */
	private linkToItsTime(log: TimeLog): void {
		const starts = generateTimeSlots(log.startedAt, log.stoppedAt);
		const slots = this.timeSlotsAt(starts.map((slot) => ({ startedAt: slot.startedAt, timeLogId: log.id })));
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
			getMany: async () => this.matchingTimeSlots(parameters),
			relation: () => ({ of: (slotId: string) => this.linksOf(slotId) })
		};
		return query;
	}

	/** `relation(TimeSlot, 'timeLogs').of(slot)`: the join rows of one slot. */
	private linksOf(slotId: string) {
		const slot = this.timeSlots.find((stored) => stored.id === slotId);
		return {
			remove: async (timeLogId: string) => {
				slot.timeLogs = slot.timeLogs.filter((link) => link.id !== timeLogId);
			}
		};
	}

	private timeLogRepository() {
		return {
			findOne: async ({ where }: { where: { id: string } }) => this.read(where.id),
			findOneBy: async ({ id }: { id: string }) => this.liveTimeLog(id) ?? null,
			update: async ({ id }: { id: string }, changes: Partial<TimeLog>) => {
				Object.assign(this.liveTimeLog(id), changes);
				return { affected: 1 };
			},
			save: async (log: TimeLog) => this.saveTimeLog(log),
			softDelete: async ({ id }: { id: { value: unknown } }) => this.deleteTimeLogs(id.value),
			delete: async ({ id }: { id: { value: unknown } }) => this.deleteTimeLogs(id.value)
		};
	}

	private timeSlotRepository() {
		return {
			createQueryBuilder: () => this.timeSlotQuery(),
			softRemove: async (removed: StoredTimeSlot | StoredTimeSlot[]) => this.removeTimeSlots(removed),
			remove: async (removed: StoredTimeSlot | StoredTimeSlot[]) => this.removeTimeSlots(removed)
		};
	}

	private timeSlotService() {
		return {
			generateTimeSlots: (start: Date, end: Date) => generateTimeSlots(start, end)
		};
	}
}
