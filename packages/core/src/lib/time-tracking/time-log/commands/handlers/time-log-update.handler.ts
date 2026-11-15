import { Logger, NotFoundException, Optional } from '@nestjs/common';
import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import * as moment from 'moment';
import { Brackets, DataSource, Repository } from 'typeorm';
import { ID, ITimeLog, ITimeSlot, ITimesheet, TimeLogSourceEnum, TimeLogType } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/utils';
import { TimesheetFirstOrCreateCommand, TimesheetRecalculateCommand } from './../../../timesheet/commands';
import { TimeSlotBulkDeleteCommand } from '../../../time-slot/commands/time-slot-bulk-delete.command';
import { TimeSlotService } from '../../../time-slot/time-slot.service';
import { UpdateEmployeeTotalWorkedHoursCommand } from '../update-employee-total-worked-hours.command';
import { RequestContext } from './../../../../core/context';
import { debugInDevelopment } from './../../../../logger';
import { MultiORM, MultiORMEnum, getORMType } from './../../../../core/utils';
import { prepareSQLQuery as p } from './../../../../database/database.helper';
import { TimeLog } from './../../time-log.entity';
import { assertTimeLogReferencesOfTenant } from '../../time-log-references';
import { postsHeartbeatSlots } from '../../tracker-source';
import { TimeSlot } from '../../../time-slot/time-slot.entity';
import { TimeLogUpdateCommand } from '../time-log-update.command';
import { FindTimeLogRatesCommand, TimeLogRatesPart } from '../find-time-log-rates.command';
import { updatedChange } from '../../time-log-history';
import {
	historySubject,
	lockedForChange,
	recordTimeLogHistory,
	TimeLogHistoryOptions
} from '../../time-log-history.writer';
import { TypeOrmTimeLogRepository } from '../../repository/type-orm-time-log.repository';
import { TypeOrmTimeSlotRepository } from '../../../time-slot/repository/type-orm-time-slot.repository';
import { MikroOrmTimeSlotRepository } from '../../../time-slot/repository/mikro-orm-time-slot.repository';

/**
 * Input keys that decide WHERE a time log lives. They are never taken from the input.
 */
const TIME_LOG_SCOPE_FIELDS = ['id', 'tenantId', 'tenant', 'organizationId', 'organization', 'employee'] as const;

/**
 * The most minutes one slot lookup names. Each minute is one more term of the lookup's OR: SQLite refuses an expression
 * deeper than 1000, which a log moved by a week (about 1,008 ten-minute starts) passes.
 */
const MINUTES_PER_LOOKUP = 200;

/**
 * The starts stored within the minute a slot start names: from that minute up to the next one. A slot is stored at the
 * start it was generated from, at `:00.000` from the desktop and with the milliseconds of the timer's start from the web.
 *
 * @param startTime - The slot start, a whole minute.
 */
function minuteRange(startTime: Date): { from: Date; to: Date } {
	const from = moment(startTime).startOf('minute');
	const to = from.clone().add(1, 'minute');
	return { from: from.toDate(), to: to.toDate() };
}

/**
 * Returns a copy of the input without the scope fields.
 *
 * @param input - The requested time log changes.
 */
export function omitScopeFields<T extends object>(input: T): Partial<T> {
	const changes: Partial<T> = { ...input };
	for (const field of TIME_LOG_SCOPE_FIELDS) {
		delete (changes as any)[field];
	}
	return changes;
}

/** The employee's slots at the starts of a log's range: where a write of that range reads them. */
interface IRangeSlotsAt {
	tenantId: ID;
	organizationId: ID;
	employeeId: ID;
	/** The range's slot starts, each a whole minute. */
	starts: Date[];
}

/**
 * Whether a slot, as a lookup with its logs answers it, is held by the log. Under MikroORM a slot's time logs are a
 * collection, iterable but without array methods.
 */
function holdsSlot(timeLog: ITimeLog, slot: ITimeSlot): boolean {
	return Array.from(slot.timeLogs ?? []).some((log) => log.id === timeLog.id);
}

/** The whole minute a slot starts in, as the lookups of a range's slots read it (see `minuteRange`). */
function slotMinute(slot: Pick<ITimeSlot, 'startedAt'>): number {
	return moment(slot.startedAt).startOf('minute').valueOf();
}

/**
 * The employee's slots at a range's starts, as read before a write of that range, in plain values: the ids of those
 * slots, and the ids and start minutes of the ones the log held (see `giveRangeSlotsBack`).
 */
interface IRangeSlotsBefore {
	ids: Set<ID>;
	heldIds: Set<ID>;
	heldMinutes: Set<number>;
}

/** The plain values of the slots read before a write of a range (see `IRangeSlotsBefore`). */
function rangeSlotsBefore(timeLog: ITimeLog, slots: ITimeSlot[]): IRangeSlotsBefore {
	const held = slots.filter((slot) => holdsSlot(timeLog, slot));
	return {
		ids: new Set(slots.map((slot) => slot.id)),
		heldIds: new Set(held.map((slot) => slot.id)),
		heldMinutes: new Set(held.map(slotMinute))
	};
}

/** Whether two stored instants are the same one, both missing included. */
function isSameInstant(a: Date | string | null | undefined, b: Date | string | null | undefined): boolean {
	if (a == null || b == null) {
		return a == null && b == null;
	}
	return new Date(a).getTime() === new Date(b).getTime();
}

@CommandHandler(TimeLogUpdateCommand)
export class TimeLogUpdateHandler implements ICommandHandler<TimeLogUpdateCommand> {
	protected ormType: MultiORM = getORMType();
	private readonly logger = new Logger(TimeLogUpdateHandler.name);

	constructor(
		private readonly commandBus: CommandBus,
		private readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		private readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		private readonly mikroOrmTimeSlotRepository: MikroOrmTimeSlotRepository,
		private readonly timeSlotService: TimeSlotService,
		// Records the history of a change a person makes; a handler built without it writes as before.
		@Optional() private readonly dataSource?: DataSource
	) {}

	/**
	 * Updates a time log, manages associated time slots, and recalculates timesheet and employee hours.
	 *
	 * This method retrieves the time log, updates its details, and handles time slot conflicts if the start or stop time is modified.
	 * It creates new time slots if necessary, saves the updated time log, and recalculates the timesheet and employee hours.
	 *
	 * @param command - The command containing the time log update data, including options for force delete and manual time slots.
	 * @returns A promise that resolves to the updated `TimeLog`.
	 */

	public async execute(command: TimeLogUpdateCommand): Promise<ITimeLog> {
		// Extract input parameters from the command
		const { id, input, manualTimeSlot, forceDelete = false, history } = command;

		let timeLog: ITimeLog = await this.getTimeLogByIdOrInstance(id);

		// The entry as stored, for its history: the move below writes the changes onto `timeLog` itself.
		const stored: ITimeLog = { ...timeLog };

		// Tenant and organization always come from the stored row, never from the input: the input is
		// (partly) a request body, and spreading its tenantId/organizationId into the update re-pointed
		// the log at another tenant (GHSA-6qvm-3wg4-26w4).
		const { employeeId: previousEmployeeId, organizationId, tenantId, timesheetId: previousTimesheetId } = timeLog;
		debugInDevelopment(this.logger, () => `Tenant ID: ${tenantId}`);
		const changes = omitScopeFields(input);

		// A project, task, client or team the update names is a row of the log's tenant (see time-log-references.ts)
		await assertTimeLogReferencesOfTenant(this.typeOrmTimeLogRepository, changes, tenantId);

		// The employee the log belongs to once updated. `employeeId` is not a scope field: the manual-time update
		// moves a log to another employee of the SAME organization (`TimeLogService.updateManualTime` refuses any
		// other, and any log with tracked screenshots or activity), and what the log owns moves with it — its
		// timesheet, its time slots and the worked hours of both employees.
		const employeeId: ID = changes.employeeId ?? previousEmployeeId;
		const moved = String(employeeId) !== String(previousEmployeeId);

		// The rates the log takes when it becomes someone else's time or another project's; it keeps its own otherwise
		const rates = await this.ratesOfChange(timeLog, changes, employeeId, moved);

		let timesheet: ITimesheet;
		let updateTimeSlots: ITimeSlot[] = [];

		// Check if time slots need to be updated
		let needToUpdateTimeSlots = Boolean(input.startedAt || input.stoppedAt) || moved;
		debugInDevelopment(this.logger, () => `Need to update time slots: ${needToUpdateTimeSlots}`);

		if (needToUpdateTimeSlots) {
			// Generate time slots based on the updated time log details
			const { startedAt, stoppedAt } = { ...timeLog, ...changes };

			// The timesheet of the employee the log now belongs to, for the log's period.
			timesheet = await this.commandBus.execute(
				new TimesheetFirstOrCreateCommand(moved ? startedAt : input.startedAt, employeeId, organizationId)
			);

			updateTimeSlots = this.timeSlotService.generateTimeSlots(startedAt, stoppedAt);
		}

		// Regenerate the existing time slots for the time log
		const timeSlots = this.timeSlotService.generateTimeSlots(timeLog.startedAt, timeLog.stoppedAt);

		// What the log releases — every slot of its range for a move, the start times a shortened range drops
		// otherwise — decided from the slots' links as they are now, BEFORE anything is written: the save below
		// replaces the log's links, after which its own slots no longer point at it.
		const release = needToUpdateTimeSlots
			? await this.planRelease(
					timeLog,
					tenantId,
					organizationId,
					previousEmployeeId,
					moved
						? timeSlots.map((slot) => new Date(slot.startedAt))
						: this.getConflictingStartTimes(timeSlots, updateTimeSlots)
				)
			: undefined;

		if (moved) {
			// A move, in the order that leaves a recoverable state at every failure (no transaction can span the
			// commands below; each writes through its own repositories):
			// (a) the destination — the new employee's slots for the log's range (created where they have none);
			// A break holds no time slots, so it takes none to the new employee either.
			const movesBreak = { ...timeLog, ...changes }.logType === TimeLogType.BREAK;
			let destination: ITimeSlot[] = [];
			if (!movesBreak) {
				destination = await this.bulkCreateTimeSlots(
					updateTimeSlots,
					timeLog,
					employeeId,
					organizationId,
					tenantId
				);
			}
			// (b) ONE save of the log — its new employee, its new timesheet and its new slots together. If it fails,
			// nothing of the previous employee has been touched (at most the new employee keeps blank slots no log
			// holds), and the error propagates;
			Object.assign(timeLog, changes, timesheet ? { timesheetId: timesheet.id } : {}, { timeSlots: destination });
			Object.assign(timeLog, rates);
			await this.writeWithHistory(
				stored,
				timeLog,
				history,
				(repository) => this.saveUpdatedTimeLog(timeLog, repository),
				true
			);
			timeLog = await this.typeOrmTimeLogRepository.findOneBy({ id: timeLog.id });
			// (c) only then the previous employee's slots are released, below. If that fails, the log is fully
			// moved, the previous employee may keep slots that no longer belong to it, and the error propagates.
		} else {
			// Whether the update gives the log the slots of its range (takesSlotsOfItsRange), read before anything is
			// written, so a failed read leaves the log as it was, never stopped without slots. It is asked of the log
			// as the update will store it: an edit may change its source in the same body. The update does not touch
			// the log's slot links, which are read from the stored row.
			const takesRangeSlots =
				needToUpdateTimeSlots &&
				!manualTimeSlot &&
				(await this.takesSlotsOfItsRange({ ...timeLog, ...changes }));

			// Update the time log in the repository
			const logId = timeLog.id;
			// An entry deleted for good since it was first read stops the edit with a 404: the reads below would find
			// no row to answer or to give slots to.
			const writeUpdate = () =>
				this.writeWithHistory(
					stored,
					changes,
					history,
					(repository) =>
						repository.update(
							{ id: logId, tenantId },
							{
								...changes,
								...(timesheet ? { timesheetId: timesheet.id } : {}),
								...rates
							}
						),
					true
				);

			// The time slots of the new range, for Web Timer, and for a heartbeat-posting run that has none
			// (takesRangeSlots, above), are created and linked to the log BEFORE the update writes that range (see
			// `writeWithRangeSlots`). The answer is every slot of the employee at those starts — the ones created and the
			// ones they already had there (another of their logs may share a ten-minute slot) — and, as
			// TimeLogCreateHandler does, it becomes the log's slots below.
			let rangeSlots: ITimeSlot[] = [];
			if (takesRangeSlots) {
				rangeSlots = await this.writeWithRangeSlots(
					updateTimeSlots,
					timeLog,
					employeeId,
					organizationId,
					tenantId,
					writeUpdate
				);
			} else {
				await writeUpdate();
			}

			// Retrieve the updated time log
			timeLog = await this.typeOrmTimeLogRepository.findOneBy({ id: timeLog.id });

			if (needToUpdateTimeSlots) {
				// The slots of its range become the log's slots, so the save keeps the log linked to each of them, an
				// existing slot included.
				if (takesRangeSlots) {
					timeLog.timeSlots = rangeSlots;
				}

				// Update the time log in the repository (a failure propagates, before any slot is released). An update
				// that makes no slot of its own (`manualTimeSlot`: the timer's start move, a deleted time span) has
				// nothing to save that the targeted update above did not write, and saving the row read back would
				// write every column a concurrent call changed since (a timer stop's `isRunning` and `stoppedAt`
				// included) back to what it read.
				if (!manualTimeSlot) {
					await this.saveUpdatedTimeLog(timeLog);
				}
			}
		}

		// Check if time slots need to be updated
		if (needToUpdateTimeSlots) {
			// The release, after the save: a slot only this log held goes, a slot another log still holds stays and
			// loses only this log's link — exactly what deleting the log would leave.
			await this.applyRelease(timeLog, tenantId, organizationId, previousEmployeeId, release, forceDelete);

			// Recalculate timesheets and employee hours
			await this.recalculateTimesheetAndEmployeeHours(timeLog.timesheetId, employeeId);
			debugInDevelopment(
				this.logger,
				() => `Recalculated timesheets and employee hours: ${timeLog.timesheetId}, ${employeeId}`
			);

			// The previous employee's timesheet and worked hours lose the moved log.
			if (moved) {
				await this.recalculateTimesheetAndEmployeeHours(
					String(previousTimesheetId ?? '') !== String(timeLog.timesheetId ?? '')
						? previousTimesheetId
						: undefined,
					previousEmployeeId
				);
			}
		}

		// Return the updated time log
		const updatedTimeLog = await this.typeOrmTimeLogRepository.findOneBy({ id: timeLog.id });

		return updatedTimeLog;
	}

	/**
	 * Whether an update gives the log the time slots of its range. The web timer posts none, so its runs always get
	 * them. A run of a client that posts a slot on each heartbeat (`postsHeartbeatSlots`) gets them only when it has
	 * none, one that never sent a heartbeat, which the day's worked time otherwise leaves out (#11843); one that has
	 * slots keeps those it posted. Desktop and the other trackers post their own.
	 *
	 * @param timeLog - The log as the update will store it: the stored row with the update's changes on top.
	 */
	private async takesSlotsOfItsRange(timeLog: ITimeLog): Promise<boolean> {
		// A break holds no time slots, whoever runs it (see TimeLogCreateHandler)
		if (timeLog.logType === TimeLogType.BREAK) {
			return false;
		}
		if (timeLog.source === TimeLogSourceEnum.WEB_TIMER) {
			return true;
		}
		if (!postsHeartbeatSlots(timeLog.source)) {
			return false;
		}
		const hasSlots = await this.hasTimeSlots(timeLog);
		return !hasSlots;
	}

	/**
	 * The rates an update gives the log: those of the moment when it becomes another member's time (all of them) or
	 * another project's (the client rates), as a new log of that member or project would store; none otherwise, so
	 * the log keeps the rates it was recorded with (see time-log-rates.ts).
	 *
	 * @param timeLog - The log as stored.
	 * @param changes - The requested changes, without the scope fields.
	 * @param employeeId - The employee the log belongs to once updated.
	 * @param moved - Whether the update gives the log to another employee.
	 */
	private async ratesOfChange(
		timeLog: ITimeLog,
		changes: Partial<ITimeLog>,
		employeeId: ID,
		moved: boolean
	): Promise<Partial<ITimeLog>> {
		const namesProject = changes.projectId !== undefined;
		const changesProject = namesProject && String(changes.projectId ?? '') !== String(timeLog.projectId ?? '');
		if (!moved && !changesProject) {
			return {};
		}
		let projectId = timeLog.projectId ?? null;
		if (namesProject) {
			projectId = changes.projectId ?? null;
		}
		let part: TimeLogRatesPart = 'client';
		if (moved) {
			part = 'all';
		}
		const scope = { tenantId: timeLog.tenantId, organizationId: timeLog.organizationId, employeeId, projectId };
		const rates = await this.commandBus.execute(new FindTimeLogRatesCommand(scope, part));
		return rates ?? {};
	}

	/**
	 * Whether any time slot of the log's tenant is linked to the log.
	 *
	 * @param timeLog - The log.
	 */
	private async hasTimeSlots(timeLog: ITimeLog): Promise<boolean> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const em = this.mikroOrmTimeSlotRepository.getEntityManager();
				const count = await em.count('TimeSlot', {
					tenantId: timeLog.tenantId,
					timeLogs: { id: timeLog.id }
				} as any);
				return count > 0;
			}
			case MultiORMEnum.TypeORM:
			default: {
				const query = this.typeOrmTimeSlotRepository.createQueryBuilder('time_slot');
				query
					.innerJoin(`${query.alias}.timeLogs`, 'time_log', p(`"time_log"."id" = :timeLogId`), {
						timeLogId: timeLog.id
					})
					.where(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId: timeLog.tenantId });
				const count = await query.getCount();
				return count > 0;
			}
		}
	}

	/**
	 * Retrieves a time log by its ID or directly returns the instance if provided.
	 *
	 * If the `id` parameter is already a `TimeLog` instance, it is returned as is. Otherwise, it fetches
	 * the time log from the repository using the provided `id`.
	 *
	 * @param id - The time log ID or an instance of `TimeLog`.
	 * @returns A promise that resolves to the `ITimeLog` instance.
	 */
	private async getTimeLogByIdOrInstance(id: ID | TimeLog): Promise<ITimeLog> {
		if (id instanceof TimeLog) {
			return id;
		}
		// An id is resolved inside the caller's tenant only (the raw repository has no tenant scoping).
		const tenantId = RequestContext.currentTenantId();
		const timeLog = tenantId ? await this.typeOrmTimeLogRepository.findOneBy({ id, tenantId }) : null;
		if (!timeLog) {
			throw new NotFoundException('The time log was not found');
		}
		return timeLog;
	}

	/**
	 * Identifies the conflicting start times that need to be removed from time slots.
	 *
	 * This method filters out time slots that have matching `startedAt` times in the new slots and returns
	 * the start times of the slots that need to be removed.
	 *
	 * Two slots match by their whole minute. `generateTimeSlots` keeps the milliseconds of the start it is given on
	 * every slot it computes, so a new start of 09:55:00.500 gave 09:50:00.500, 10:00:00.500 and so on, and a slot's
	 * start never has milliseconds: compared exactly, no slot matched, and every one the log held was released, the ones
	 * it keeps included.
	 *
	 * The start times returned are whole minutes too. The existing slots are regenerated from the log's own start, so a
	 * log started at 12:53:27.123, as a timer's is, gave 12:50:00.123, 13:00:00.123 and so on: no stored slot was found
	 * at those times, and the log kept every slot of the time it dropped.
	 *
	 * @param slots - The existing time slots.
	 * @param newSlots - The newly generated time slots.
	 * @returns An array of conflicting start times that need to be removed.
	 */
	private getConflictingStartTimes(slots: ITimeSlot[], newSlots: ITimeSlot[]): Date[] {
		const minuteOf = (slot: ITimeSlot) => moment(slot.startedAt).startOf('minute').valueOf();
		const kept = new Set(newSlots.map(minuteOf));
		return slots
			.filter((existingSlot) => !kept.has(minuteOf(existingSlot)))
			.map((slot) => new Date(minuteOf(slot)));
	}

	/**
	 * Plans the release of a log's time slots at the given start times — the ones a shortened range drops, or every
	 * one of a log that moves to another employee — from the slots' links as they are when it is called.
	 *
	 * Only the slots linked to THIS log are considered: one only this log holds is to be removed, one another log
	 * still holds (two logs that meet inside one ten-minute slot share it) is to be kept, without this log. That is
	 * the rule the slot cleanup of `TimeLogDeleteHandler` applies; it is decided here, before the log is saved,
	 * because the save replaces the log's links and its own slots then no longer name it. (The slots used to be
	 * removed by start time alone, a neighbour's shared slot with them.)
	 *
	 * @param timeLog - The log whose slots are released.
	 * @param tenantId - The log's tenant.
	 * @param organizationId - The log's organization.
	 * @param employeeId - The employee the slots belong to (the log's, or the one a moved log leaves).
	 * @param startTimes - The slot start times to release.
	 * @returns The slots to remove and the slots to keep without this log.
	 */
	private async planRelease(
		timeLog: ITimeLog,
		tenantId: ID,
		organizationId: ID,
		employeeId: ID,
		startTimes: Date[]
	): Promise<{ remove: ID[]; unlink: ID[] }> {
		// A length check, not `isEmpty`: that helper reads a Date as an empty object, so a list of dates as empty.
		if (startTimes.length === 0) {
			return { remove: [], unlink: [] };
		}

		// Under MikroORM a slot's time logs are a collection, iterable but without array methods
		const logsOf = (slot: ITimeSlot): ITimeLog[] => Array.from(slot.timeLogs ?? []);
		const linked = (await this.findTimeSlots(tenantId, organizationId, employeeId, startTimes)).filter((slot) =>
			logsOf(slot).some((log) => log.id === timeLog.id)
		);
		const heldByAnother = (slot: ITimeSlot) => logsOf(slot).some((log) => log.id !== timeLog.id);

		return {
			remove: linked.filter((slot) => !heldByAnother(slot)).map((slot) => slot.id),
			unlink: linked.filter(heldByAnother).map((slot) => slot.id)
		};
	}

	/**
	 * Applies a planned release (see `planRelease`), after the log is saved.
	 *
	 * The slots only this log held go through the slot cleanup the log-delete path uses (`TimeSlotBulkDeleteCommand`)
	 * in its whole-slot mode — which slots are this log's alone was decided before the save unlinked them — and a
	 * slot another log still holds stays, losing only its link to this log, dropped through the relation itself
	 * (`relation(TimeSlot, 'timeLogs').of(slot).remove(log)`): a desktop-source edit or a timer stop never
	 * re-assigns the log's slots, so its save cannot be relied on to drop it.
	 *
	 * @param timeLog - The log whose slots are released.
	 * @param tenantId - The log's tenant.
	 * @param organizationId - The log's organization.
	 * @param employeeId - The employee the slots belong to.
	 * @param release - The planned release.
	 * @param forceDelete - Hard delete (`true`) or soft delete (`false`) the slots that go.
	 */
	private async applyRelease(
		timeLog: ITimeLog,
		tenantId: ID,
		organizationId: ID,
		employeeId: ID,
		release: { remove: ID[]; unlink: ID[] } | undefined,
		forceDelete: boolean
	): Promise<void> {
		if (!release) {
			return;
		}

		debugInDevelopment(
			this.logger,
			() =>
				`time slots released by time log ${timeLog.id} (${forceDelete ? 'hard' : 'soft'}): ${release.remove.length} removed, ${release.unlink.length} kept`
		);

		// The slots only this log held go.
		if (!isEmpty(release.remove)) {
			await this.commandBus.execute(
				new TimeSlotBulkDeleteCommand(
					{ organizationId, employeeId, timeLog, timeSlotsIds: release.remove, tenantId },
					forceDelete,
					true
				)
			);
		}

		// A slot another log still holds stays, without this log.
		for (const slotId of release.unlink) {
			await this.typeOrmTimeSlotRepository
				.createQueryBuilder()
				.relation(TimeSlot, 'timeLogs')
				.of(slotId)
				.remove(timeLog.id);
		}
	}

	/**
	 * The time slots of an employee at the given start times, with their time logs, screenshots, activities and
	 * minute records.
	 *
	 * Each start is a whole minute (`getConflictingStartTimes`) and is read as that minute: an exact match missed the web
	 * timer's slots, stored with the milliseconds of its start, and on SQLite TypeORM bound the list of dates as they are,
	 * which the driver refuses. Each bound of a range is one date, which every driver binds.
	 *
	 * @param tenantId - The tenant.
	 * @param organizationId - The organization.
	 * @param employeeId - The employee.
	 * @param startTimes - The slot start times.
	 * @param refresh - Whether MikroORM reads the slots and their logs again even when its context holds them: after
	 * writes made through TypeORM in the same request, as the links a write of a range makes (#11889).
	 * @returns The slots found.
	 */
	private async findTimeSlots(
		tenantId: ID,
		organizationId: ID,
		employeeId: ID,
		startTimes: Date[],
		refresh = false
	): Promise<ITimeSlot[]> {
		const minutes = startTimes.map(minuteRange);
		const slots: ITimeSlot[] = [];
		for (let first = 0; first < minutes.length; first += MINUTES_PER_LOOKUP) {
			const batch = minutes.slice(first, first + MINUTES_PER_LOOKUP);
			slots.push(...(await this.findTimeSlotsInMinutes(tenantId, organizationId, employeeId, batch, refresh)));
		}
		return slots;
	}

	/** The time slots of an employee started in one of the given minutes; see {@link findTimeSlots}. */
	private async findTimeSlotsInMinutes(
		tenantId: ID,
		organizationId: ID,
		employeeId: ID,
		minutes: Array<{ from: Date; to: Date }>,
		refresh = false
	): Promise<ITimeSlot[]> {
		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const em = this.mikroOrmTimeSlotRepository.getEntityManager();
				const inMinutes = minutes.map(({ from, to }) => ({ startedAt: { $gte: from, $lt: to } }));
				return (await em.find(
					'TimeSlot',
					{
						organizationId,
						tenantId,
						employeeId,
						$or: inMinutes
					} as any,
					{
						populate: ['timeLogs', 'screenshots', 'activities', 'timeSlotMinutes'],
						...(refresh ? { refresh: true } : {})
					}
				)) as any[];
			}
			case MultiORMEnum.TypeORM:
			default: {
				// Query to fetch conflicting time slots
				const query = this.typeOrmTimeSlotRepository.createQueryBuilder('time_slot');

				// Add joins to the query
				query
					.leftJoinAndSelect(`${query.alias}.timeLogs`, 'timeLogs')
					.leftJoinAndSelect(`${query.alias}.screenshots`, 'screenshots')
					.leftJoinAndSelect(`${query.alias}.activities`, 'activities')
					.leftJoinAndSelect(`${query.alias}.timeSlotMinutes`, 'timeSlotMinutes');

				// Add where clauses to the query
				query
					.where(p(`"${query.alias}"."organizationId" = :organizationId`), { organizationId })
					.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), { tenantId })
					.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), { employeeId })
					.andWhere(
						new Brackets((inMinutes) => {
							minutes.forEach(({ from, to }, index) => {
								const startedAt = `"${query.alias}"."startedAt"`;
								inMinutes.orWhere(
									p(`${startedAt} >= :startFrom${index} AND ${startedAt} < :startTo${index}`),
									{ [`startFrom${index}`]: from, [`startTo${index}`]: to }
								);
							});
						})
					);

				// Get the conflicting time slots
				return query.getMany();
			}
		}
	}

	/**
	 * Bulk creates time slots for a given time log.
	 *
	 * This method enriches the provided time slots by adding additional fields like `employeeId`, `organizationId`,
	 * `tenantId`, and `timeLogId`, along with initializing `keyboard`, `mouse`, and `overall` activity metrics to zero.
	 * It filters out any slots that do not have valid `tenantId` or `organizationId` values and then performs a bulk creation of time slots.
	 *
	 * @param updateTimeSlots - The array of time slots that need to be enriched and created.
	 * @param timeLog - The time log associated with the time slots.
	 * @param employeeId - The ID of the employee associated with the time slots.
	 * @param organizationId - The ID of the organization associated with the time slots.
	 * @param tenantId - The tenant ID associated with the time slots.
	 * @returns A promise that resolves to an array of created time slots.
	 */
	private async bulkCreateTimeSlots(
		updateTimeSlots: ITimeSlot[],
		timeLog: ITimeLog,
		employeeId: ID,
		organizationId: ID,
		tenantId: ID
	): Promise<ITimeSlot[]> {
		const slots = updateTimeSlots
			.map((slot) => ({
				...slot,
				employeeId,
				organizationId,
				tenantId,
				keyboard: 0,
				mouse: 0,
				overall: 0,
				timeLogId: timeLog.id
			}))
			.filter((slot) => slot.tenantId && slot.organizationId); // Filter slots with valid tenant and organization IDs

		// Assign regenerated TimeSlot entries for existed TimeLog
		return await this.timeSlotService.bulkCreate(slots, employeeId, organizationId);
	}

	/**
	 * Gives a log the time slots of its new range, then writes that range (`write`), in this order (#11889): the slots
	 * are created where the employee has none, the log is linked to each one it does not hold yet, and only then is the
	 * range written (a stop's end, and `isRunning: false`). A failure on the way gives the slots at those starts back
	 * as they were (see `giveRangeSlotsBack`) and is raised, so the log is left as it was: a stopped run still runs,
	 * with nothing written, and a stop sent again stops it. Once the range is written, the log holds every slot of it.
	 *
	 * The range used to be written first: a stop whose slot insert failed left the run stopped without slots, out of
	 * the day's worked time, and a stop sent again was refused, as nothing ran any more.
	 *
	 * @param updateTimeSlots - The slots of the new range.
	 * @param timeLog - The log as stored, before the write.
	 * @param employeeId - The log's employee.
	 * @param organizationId - The log's organization.
	 * @param tenantId - The log's tenant.
	 * @param write - The write of the new range.
	 * @returns Every slot of the employee at the range's starts, which become the log's slots.
	 * @throws The error of the insert, of the link or of the write.
	 */
	private async writeWithRangeSlots(
		updateTimeSlots: ITimeSlot[],
		timeLog: ITimeLog,
		employeeId: ID,
		organizationId: ID,
		tenantId: ID,
		write: () => Promise<unknown>
	): Promise<ITimeSlot[]> {
		const starts = updateTimeSlots.map((slot) => moment(slot.startedAt).startOf('minute').toDate());
		// Taken as plain values before any write: under MikroORM the slots read are the request's own instances, which
		// the merge run by the insert, and the reads after it, update in place
		const before = rangeSlotsBefore(
			timeLog,
			await this.findTimeSlots(tenantId, organizationId, employeeId, starts)
		);
		try {
			const rangeSlots = await this.bulkCreateTimeSlots(
				updateTimeSlots,
				timeLog,
				employeeId,
				organizationId,
				tenantId
			);
			await this.linkToRangeSlots(timeLog, rangeSlots, { tenantId, organizationId, employeeId, starts });
			await write();
			return rangeSlots;
		} catch (error) {
			await this.giveRangeSlotsBack(timeLog, before, { tenantId, organizationId, employeeId, starts });
			throw error;
		}
	}

	/**
	 * Links a log to each slot of its range it does not hold yet: the insert links the slots it creates, not the ones
	 * the employee already had at those starts.
	 *
	 * @param timeLog - The log.
	 * @param rangeSlots - The slots of its range.
	 * @param at - The employee's slots to read: those of the employee at the range's starts.
	 */
	private async linkToRangeSlots(timeLog: ITimeLog, rangeSlots: ITimeSlot[], at: IRangeSlotsAt): Promise<void> {
		const rangeIds = new Set(rangeSlots.map((slot) => slot.id));
		const standing = await this.findTimeSlots(at.tenantId, at.organizationId, at.employeeId, at.starts, true);
		const notHeld = standing
			.filter((slot) => rangeIds.has(slot.id) && !holdsSlot(timeLog, slot))
			.map((slot) => slot.id);
		if (notHeld.length > 0) {
			await this.typeOrmTimeSlotRepository
				.createQueryBuilder()
				.relation(TimeSlot, 'timeLogs')
				.of(notHeld)
				.add(timeLog.id);
		}
	}

	/**
	 * Gives back the slots at a range's starts as they were before a failed write of that range (see
	 * `writeWithRangeSlots`): the log lets go of each slot it did not hold then, and a slot created since that only the
	 * log holds is deleted for good, as it holds no screenshot or activity yet (the slot delete removes it only while
	 * the log still holds it alone). A failure here is logged; the write's own error stays the one raised.
	 *
	 * Two things stay as they are:
	 * - the slots of the range a write of the log that went through since stored (another stop of the same run, as
	 *   the stop of a tracking turned off; see `startsWrittenSince`): that write gave the log those slots. The log is
	 *   read again just before, so only a write landing between that read and this cleanup can still lose them;
	 * - the link of a slot at a start where the log held a slot before: the merge of the employee's slots
	 *   (`TimeSlotMergeHandler`, run by the insert) keeps one slot per start and moves the links of the others onto
	 *   it, so the log still holding a slot there holds its own time.
	 *
	 * Once slots were given back, the timesheet and the employee's worked hours are recalculated: the merge counted
	 * the slots it was given, and those deleted here count no more.
	 *
	 * @param timeLog - The log, as read before the write.
	 * @param before - The employee's slots at those starts, and those the log held, as read before the write.
	 * @param at - The employee's slots to read: those of the employee at the range's starts.
	 */
	private async giveRangeSlotsBack(timeLog: ITimeLog, before: IRangeSlotsBefore, at: IRangeSlotsAt): Promise<void> {
		try {
			const { ids: existed, heldIds: heldBeforeIds, heldMinutes: startsHeldBefore } = before;
			const standing = await this.findTimeSlots(at.tenantId, at.organizationId, at.employeeId, at.starts, true);
			let taken = standing.filter((slot) => holdsSlot(timeLog, slot) && !heldBeforeIds.has(slot.id));
			if (taken.length === 0) {
				return;
			}
			const writtenSince = await this.startsWrittenSince(timeLog, at.tenantId);
			taken = taken.filter((slot) => !writtenSince.has(slotMinute(slot)));

			const heldByThisLogAlone = (slot: ITimeSlot) =>
				Array.from(slot.timeLogs ?? []).every((log) => log.id === timeLog.id);
			const created = taken
				.filter((slot) => !existed.has(slot.id) && heldByThisLogAlone(slot))
				.map((slot) => slot.id);
			const linked = taken
				.filter((slot) => !created.includes(slot.id) && !startsHeldBefore.has(slotMinute(slot)))
				.map((slot) => slot.id);

			if (created.length > 0) {
				const { organizationId, employeeId, tenantId } = at;
				await this.commandBus.execute(
					new TimeSlotBulkDeleteCommand(
						{ organizationId, employeeId, tenantId, timeLog, timeSlotsIds: created },
						true,
						false
					)
				);
			}
			if (linked.length > 0) {
				await this.typeOrmTimeSlotRepository
					.createQueryBuilder()
					.relation(TimeSlot, 'timeLogs')
					.of(linked)
					.remove(timeLog.id);
			}
			if (created.length > 0 || linked.length > 0) {
				await this.recalculateTimesheetAndEmployeeHours(timeLog.timesheetId, at.employeeId);
			}
		} catch (undoError) {
			this.logger.error(
				`Error while giving back the time slots of time log ${timeLog.id} after a failed write: ${undoError?.message ?? undoError}`,
				undoError?.stack
			);
		}
	}

	/**
	 * The slot starts of the log's range as it is now stored, when a write of the log went through since it was read
	 * before a failed write of its range (see `giveRangeSlotsBack`): another stop of the same run, from a tracking turned
	 * off or from another API process. That write gave the log the slots of the range it stored. None while the log is
	 * stored as it was read (its range and whether it runs), or is no longer there.
	 *
	 * @param timeLog - The log, as read before the failed write.
	 * @param tenantId - The log's tenant.
	 */
	private async startsWrittenSince(timeLog: ITimeLog, tenantId: ID): Promise<Set<number>> {
		const stored = await this.typeOrmTimeLogRepository.findOneBy({ id: timeLog.id, tenantId });
		const isAsRead =
			!stored ||
			(Boolean(stored.isRunning) === Boolean(timeLog.isRunning) &&
				isSameInstant(stored.startedAt, timeLog.startedAt) &&
				isSameInstant(stored.stoppedAt, timeLog.stoppedAt));
		if (isAsRead) {
			return new Set();
		}
		return new Set(this.timeSlotService.generateTimeSlots(stored.startedAt, stored.stoppedAt).map(slotMinute));
	}

	/**
	 * Runs the write of an edit. Edited by a person (`history` given), the write and the entry's history row run in
	 * one transaction, or neither does. The values before are those of the entry read under lock in that transaction:
	 * an edit saved since the entry was first read is the one this edit replaces, and none can come in between.
	 * Otherwise the write runs alone, as before.
	 *
	 * @param stored - The entry as first read, which names the row.
	 * @param written - What the write stores: the changes of an update, the whole entry of a save.
	 * @param history - Given by the routes through which a person edits an entry.
	 * @param write - The write, through the repository it is handed.
	 * @param refusesDeletedEntry - Whether an entry deleted for good since it was first read stops the edit with a
	 * NotFoundException: a save (a move's) would insert the row again, and after an update, which matches no row, the
	 * handler would read back no entry. Otherwise nothing is written and the write answers undefined.
	 */
	private async writeWithHistory<T>(
		stored: ITimeLog,
		written: Partial<ITimeLog>,
		history: TimeLogHistoryOptions | undefined,
		write: (repository: Repository<TimeLog>) => Promise<T>,
		refusesDeletedEntry = false
	): Promise<T | undefined> {
		const recordsHistory = Boolean(history) && Boolean(this.dataSource);
		if (!recordsHistory) {
			return write(this.typeOrmTimeLogRepository);
		}
		return this.dataSource.transaction(async (manager) => {
			const current = await manager.findOne(TimeLog, {
				where: { id: stored.id, tenantId: stored.tenantId },
				withDeleted: true,
				...lockedForChange()
			});
			// An entry deleted for good in the meantime: nothing is written, nor recorded. TypeORM's save inserts a row
			// no row has the key of, so a move stops here, before the previous employee's slots are released.
			if (!current) {
				if (refusesDeletedEntry) {
					throw new NotFoundException('The time log was deleted.');
				}
				return undefined;
			}
			const result = await write(manager.getRepository(TimeLog));
			// A field written as undefined is left as stored (TypeORM skips it), so it is no change of the history
			const definedWritten = Object.fromEntries(
				Object.entries(written).filter(([, value]) => value !== undefined)
			) as Partial<ITimeLog>;
			const edited = { ...current, ...definedWritten } as ITimeLog;
			const change = updatedChange(current, edited);
			if (change) {
				await recordTimeLogHistory(manager, [
					{ subject: historySubject(edited), change, reason: history.reason }
				]);
			}
			return result;
		});
	}

	/**
	 * Saves the updated time log to the repository.
	 *
	 * @param timeLog - The time log to be saved.
	 * @param repository - The repository to save through: a transaction's, when the save is recorded in the history.
	 * @returns A promise that resolves to the saved `ITimeLog` or throws an error if saving fails.
	 */
	private async saveUpdatedTimeLog(
		timeLog: ITimeLog,
		repository: Repository<TimeLog> = this.typeOrmTimeLogRepository
	): Promise<ITimeLog> {
		try {
			return await repository.save(timeLog);
		} catch (error) {
			// Logged as before, and re-thrown: a swallowed failure answered the row as if it had been saved, while
			// the writes around it (a move's employee and slots) went ahead.
			console.log('Failed to update the time log at line: 217', error);
			throw error;
		}
	}

	/**
	 * Recalculates the timesheet activities and updates the employee's total worked hours.
	 *
	 * This method first recalculates the total activity for the given timesheet by executing the
	 * `TimesheetRecalculateCommand`. Then, if an `employeeId` is provided, it updates the total
	 * worked hours for that employee by executing the `UpdateEmployeeTotalWorkedHoursCommand`.
	 *
	 * @param timesheetId - The ID of the timesheet for which the activity needs to be recalculated; none is recalculated without one.
	 * @param employeeId - The ID of the employee whose total worked hours should be updated. If `null` or `undefined`, no update will be performed for the employee.
	 * @returns A promise that resolves when both recalculation operations are complete.
	 */

	private async recalculateTimesheetAndEmployeeHours(timesheetId: ID | undefined, employeeId: ID): Promise<void> {
		// Recalculate timesheets (none to recalculate without one: a moved log's previous employee may keep the same)
		if (timesheetId) {
			await this.commandBus.execute(new TimesheetRecalculateCommand(timesheetId));
		}

		// Update employee total worked hours
		if (employeeId) {
			await this.commandBus.execute(new UpdateEmployeeTotalWorkedHoursCommand(employeeId));
		}
	}
}
