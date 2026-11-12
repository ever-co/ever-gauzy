import { Logger } from '@nestjs/common';
import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import { omit } from 'underscore';
import { ID, IDateRange, ITimeLog, ITimeSlot } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/utils';
import { moment } from '../../../../core/moment-extend';
import { TimesheetRecalculateCommand } from './../../../timesheet/commands';
import { TimeLog } from './../../time-log.entity';
import { DeleteTimeSpanCommand } from '../delete-time-span.command';
import { TimeLogUpdateCommand } from '../time-log-update.command';
import { TimeLogDeleteCommand } from '../time-log-delete.command';
import { TimeSlotBulkDeleteCommand } from './../../../time-slot/commands';
import { TimeSlot } from '../../../time-slot/time-slot.entity';
import { reachesTimeSlot, timeSlotEnd } from '../../../time-slot/utils';
import { TypeOrmTimeLogRepository } from '../../repository/type-orm-time-log.repository';
import { TypeOrmTimeSlotRepository } from '../../../time-slot/repository/type-orm-time-slot.repository';

/**
 * The time slots a span takes from a log. Deleting a time slot names it: it goes whatever other log holds it, and
 * the log goes once it holds no slot. Time saved over a log names none: the slots whose time on the log lies inside
 * the span go, each only where no other log holds it, and the log keeps the time it has left.
 */
interface SpanTimeSlots {
	ids: ID[];
	named: boolean;
}

/**
 * Whether all the time the log has in a time slot lies inside the span, so the slot keeps nothing of the log once the
 * span is taken out. A slot the log's time does not reach is not the span's to take.
 *
 * @param timeSlot - One of the log's time slots.
 * @param log - The log, as stored before the span is taken out.
 * @param span - The span taken out of the log.
 */
function isLogTimeInSpan(timeSlot: ITimeSlot, log: ITimeLog, span: IDateRange): boolean {
	const logTimeStart = moment.max(moment(timeSlot.startedAt), moment(log.startedAt));
	const logTimeEnd = moment.min(moment(timeSlotEnd(timeSlot)), moment(log.stoppedAt));
	const logReachesSlot = logTimeStart.isBefore(logTimeEnd);
	const startsInSpan = logTimeStart.isSameOrAfter(span.start);
	const endsInSpan = logTimeEnd.isSameOrBefore(span.end);
	return logReachesSlot && startsInSpan && endsInSpan;
}

/**
 * The time slots the span takes from the log: the one the caller names, or those whose time on the log lies inside
 * the span.
 *
 * @param log - The log, as stored before the span is taken out, with its time slots.
 * @param span - The span taken out of the log.
 * @param timeSlot - The time slot the caller deletes, if any.
 */
function spanTimeSlotsOf(log: ITimeLog, span: IDateRange, timeSlot?: ITimeSlot): SpanTimeSlots {
	if (timeSlot) {
		return { ids: [timeSlot.id], named: true };
	}
	const timeSlotsInSpan = (log.timeSlots ?? []).filter((slot) => isLogTimeInSpan(slot, log, span));
	return { ids: timeSlotsInSpan.map((slot) => slot.id), named: false };
}

@CommandHandler(DeleteTimeSpanCommand)
export class DeleteTimeSpanHandler implements ICommandHandler<DeleteTimeSpanCommand> {
	private readonly logger = new Logger(DeleteTimeSpanHandler.name);

	constructor(
		readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		private readonly _commandBus: CommandBus
	) {}

	/**
	 * Execute delete time span logic
	 *
	 * @param command - The command containing newTime, timeLog, and timeSlot
	 * @returns Promise<boolean>
	 */
	public async execute(command: DeleteTimeSpanCommand) {
		const { newTime, timeLog, timeSlot, forceDelete } = command;
		const { id } = timeLog;
		const { start, end } = newTime;

		// Retrieve the time log with the specified ID
		const log = await this.typeOrmTimeLogRepository.findOne({
			where: { id },
			relations: { timeSlots: true }
		});

		// Deleting several time slots sends one command per slot and log: once one of them has deleted the log (its
		// last slot, or a span covering it), the next ones find nothing left to trim.
		if (!log) {
			return false;
		}

		// The TypeORM conflict lookup lists only logs holding time slots: time saved over a log holding none, which
		// the MikroORM lookup lists too, leaves it as it is.
		const savesTimeOverLog = !timeSlot;
		const holdsNoTimeSlot = isEmpty(log.timeSlots);
		if (savesTimeOverLog && holdsNoTimeSlot) {
			return false;
		}

		const { startedAt, stoppedAt, employeeId, organizationId } = log;
		const spanTimeSlots = spanTimeSlotsOf(log, newTime, timeSlot);

		const newTimeRange = moment.range(start, end); // Calculate the new time rang
		const dbTimeRange = moment.range(startedAt, stoppedAt); // Calculate the database time range

		/*
		 * Check is overlapping time or not.
		 */
		if (!newTimeRange.overlaps(dbTimeRange, { adjacent: false })) {
			this.debug(() => `Not Overlapping ${JSON.stringify({ newTimeRange, dbTimeRange })}`);

			// Handle non-overlapping time ranges
			await this.handleNonOverlappingTimeRange(log, spanTimeSlots, employeeId, organizationId, forceDelete);
			return true;
		}

		if (moment(startedAt).isBetween(moment(start), moment(end), null, '[]')) {
			if (moment(stoppedAt).isBetween(moment(start), moment(end), null, '[]')) {
				/*
				 * Delete time log because overlap entire time.
				 * New Start time							New Stop time
				 * |-----------------------------------------------------|
				 * 		DB Start Time				DB Stop Time
				 *  		|--------------------------------------|
				 */
				// Overlap entire time: delete time log
				this.debug(() => 'Delete time log because overlap entire time.');
				await this.deleteTimeLog(log, forceDelete);
			} else {
				/*
				 * Update start time
				 * New Start time							New Stop time
				 * |-----------------------------------------------------|
				 * 		DB Start Time				DB Stop Time
				 * 		|--------------------------------------	|
				 */
				// Partial overlap: update start time or delete
				this.debug(() => 'Partial overlap: update started time or delete');
				await this.updateStartTimeOrDelete(
					log,
					spanTimeSlots,
					organizationId,
					employeeId,
					end,
					stoppedAt,
					forceDelete
				);
			}
		} else {
			if (moment(timeLog.stoppedAt).isBetween(moment(start), moment(end), null, '[]')) {
				/*
				 * Update stopped time
				 * New Start time							New Stop time
				 * |----------------------------------------------------|
				 * 		DB Start Time				DB Stop Time
				 * 		|--------------------------------------|
				 */
				this.debug(() => 'Partial overlap: update stopped time or delete');
				await this.updateStopTimeOrDelete(
					log,
					spanTimeSlots,
					organizationId,
					employeeId,
					start,
					startedAt,
					end,
					forceDelete
				);
			} else {
				/*
				 * Split database time in two entries.
				 * New Start time (start)						New Stop time (end)
				 * |---------------------------------------------------------------|
				 * 		DB Start Time (startedAt)	DB Stop Time (stoppedAt)
				 *  		|--------------------------------------------------|
				 */
				this.debug(() => 'Split database time in two entries.');
				await this.handleTimeLogSplitting(log, spanTimeSlots, start, end, forceDelete);
			}
		}

		return true;
	}

	/**
	 * Handles non-overlapping time ranges by deleting the time log and associated time slots,
	 * and recalculating the timesheet.
	 *
	 * @param timeLog - The time log associated with the non-overlapping time range.
	 * @param spanTimeSlots - The time slots the span takes.
	 * @param employeeId - The ID of the employee associated with the time log.
	 * @param organizationId - The ID of the organization.
	 * @param forceDelete - A flag indicating whether to perform a hard delete.
	 */
	private async handleNonOverlappingTimeRange(
		timeLog: ITimeLog,
		spanTimeSlots: SpanTimeSlots,
		employeeId: ID,
		organizationId: ID,
		forceDelete: boolean = false
	): Promise<void> {
		await this.deleteSpanTimeSlots(timeLog, spanTimeSlots, organizationId, employeeId, forceDelete);

		// Recalculate the timesheet
		await this._commandBus.execute(new TimesheetRecalculateCommand(timeLog.timesheetId));
	}

	/**
	 * Updates the start time or deletes the time log if remaining duration is 0.
	 *
	 * @param log - The time log to update or delete.
	 * @param spanTimeSlots - The time slots the span takes.
	 * @param organizationId - The organization ID.
	 * @param employeeId - The employee ID.
	 * @param end - The new end time.
	 * @param stoppedAt - The current stopped time of the log.
	 */
	private async updateStartTimeOrDelete(
		log: ITimeLog,
		spanTimeSlots: SpanTimeSlots,
		organizationId: ID,
		employeeId: ID,
		end: Date,
		stoppedAt: Date,
		forceDelete: boolean = false
	): Promise<void> {
		const stoppedAtMoment = moment(stoppedAt); // Get the stopped at moment
		const endMoment = moment(end); // Get the end moment
		const remainingDuration = stoppedAtMoment.diff(endMoment, 'seconds'); // Calculate the remaining duration

		// If there is remaining duration
		if (remainingDuration > 0) {
			// Update the start time if there is remaining duration
			try {
				this.debug(() => `update startedAt time to ${end}`);
				// Update the started at time
				const timeLog: ITimeLog = await this._commandBus.execute(
					new TimeLogUpdateCommand({ startedAt: end }, log, true, forceDelete)
				);

				await this.deleteSpanTimeSlots(timeLog, spanTimeSlots, organizationId, employeeId, forceDelete);
				await this.deleteTimeLogWithoutTimeSlots(timeLog, spanTimeSlots, forceDelete);
			} catch (error) {
				this.logger.warn(`Error while updating startedAt time: ${error?.message ?? error}`, { stack: error?.stack });
			}
		} else {
			// Delete the time log if remaining duration is 0
			this.debug(() => 'Remaining duration is 0, so we are deleting the time log during update startedAt time');
			await this.deleteTimeLog(log, forceDelete);
		}
	}

	/**
	 * Updates the stoppedAt time for a given time log, or deletes it if the remaining duration is 0.
	 *
	 * @param log - The time log to update or delete.
	 * @param spanTimeSlots - The time slots the span takes.
	 * @param organizationId - The organization ID.
	 * @param employeeId - The employee ID.
	 * @param start - The new start time.
	 * @param startedAt - The original start time of the time log.
	 * @param end - The new end time for the time log.
	 */
	private async updateStopTimeOrDelete(
		log: ITimeLog,
		spanTimeSlots: SpanTimeSlots,
		organizationId: ID,
		employeeId: ID,
		start: Date,
		startedAt: Date,
		end: Date,
		forceDelete: boolean = false
	): Promise<void> {
		const startedAtMoment = moment(startedAt); // Get the started at moment
		const endMoment = moment(end); // Get the end moment
		const remainingDuration = endMoment.diff(startedAtMoment, 'seconds'); // Calculate the remaining duration

		// If there is remaining duration
		if (remainingDuration > 0) {
			// Update the stoppedAt time if there is remaining duration
			try {
				this.debug(() => `update stoppedAt time to ${start}`);

				// The start is named too: an update without one files the log under the current week's timesheet.
				const timeLog: ITimeLog = await this._commandBus.execute(
					new TimeLogUpdateCommand({ startedAt, stoppedAt: start }, log, true, forceDelete)
				);

				await this.deleteSpanTimeSlots(timeLog, spanTimeSlots, organizationId, employeeId, forceDelete);
				await this.deleteTimeLogWithoutTimeSlots(timeLog, spanTimeSlots, forceDelete);
			} catch (error) {
				this.logger.warn(`Error while updating stoppedAt time: ${error?.message ?? error}`, { stack: error?.stack });
			}
		} else {
			this.debug(() => 'Remaining duration is 0, so we are deleting the time log during update stoppedAt time');
			await this.deleteTimeLog(log, forceDelete);
		}
	}

	/**
	 * Splits the log around the span: the log keeps its time before the span, and a copy of it takes the time after,
	 * with the time slots that time reaches. The copy is saved first, so a failure further on can only count its time
	 * twice.
	 *
	 * @param log - The log the span lies inside, with its time slots.
	 * @param spanTimeSlots - The time slots the span takes.
	 * @param start - The start of the span, where the log now stops.
	 * @param end - The end of the span, where the copy starts.
	 * @param forceDelete - Hard delete (`true`) or soft delete (`false`).
	 */
	private async handleTimeLogSplitting(
		log: TimeLog,
		spanTimeSlots: SpanTimeSlots,
		start: Date,
		end: Date,
		forceDelete = false
	): Promise<void> {
		const { startedAt, stoppedAt, organizationId, employeeId } = log;
		const timeSlots = log.timeSlots ?? [];
		const tailTimeSlots = timeSlots.filter((slot) => reachesTimeSlot(slot, end, stoppedAt));
		const timeSlotsLeavingLog = tailTimeSlots.filter((slot) => !reachesTimeSlot(slot, startedAt, start));

		try {
			const tail: TimeLog = omit(log, ['id', 'createdAt', 'updatedAt', 'timeSlots']);
			tail.startedAt = end;
			tail.timeSlots = tailTimeSlots;
			await this.typeOrmTimeLogRepository.save(tail);

			await this.unlinkTimeSlots(log, timeSlotsLeavingLog);

			// The start is named too: an update without one files the log under the current week's timesheet.
			await this._commandBus.execute(
				new TimeLogUpdateCommand({ startedAt, stoppedAt: start }, log, true, forceDelete)
			);

			await this.deleteSpanTimeSlots(log, spanTimeSlots, organizationId, employeeId, forceDelete);
		} catch (error) {
			this.logger.error(`Error while splitting time log ${log.id}: ${error?.message ?? error}`, error?.stack);
			// Passed on: the copy may already be saved while the log still covers its time, so the caller must not go
			// on as if the span were out of the log.
			throw error;
		}
	}

	/**
	 * Drops the log from time slots its time no longer reaches; another log holding one of them keeps it.
	 *
	 * @param log - The log leaving the time slots.
	 * @param timeSlots - The time slots it leaves.
	 */
	private async unlinkTimeSlots(log: ITimeLog, timeSlots: ITimeSlot[]): Promise<void> {
		for (const timeSlot of timeSlots) {
			await this.typeOrmTimeSlotRepository
				.createQueryBuilder()
				.relation(TimeSlot, 'timeLogs')
				.of(timeSlot.id)
				.remove(log.id);
		}
	}

	/**
	 * Deletes a time log if it overlaps the entire time range.
	 *
	 * @param timeLog - The log to delete.
	 * @param forceDelete - Whether to hard delete (default: false).
	 * @returns Promise<void> - Resolves when deletion is complete.
	 */

	private async deleteTimeLog(timeLog: ITimeLog, forceDelete: boolean = false): Promise<void> {
		try {
			// Execute the TimeLogDeleteCommand to delete the time log
			await this._commandBus.execute(new TimeLogDeleteCommand(timeLog, forceDelete));
		} catch (error) {
			// Log any errors that occur during deletion
			this.logger.warn(
				`Error while deleting the time log overlapping the entire time for ID: ${timeLog.id}: ${error?.message ?? error}`,
				{ stack: error?.stack }
			);
		}
	}

	/**
	 * Deletes the time slots the span takes from the log (see `SpanTimeSlots`).
	 *
	 * @param timeLog - The log the span is taken from.
	 * @param spanTimeSlots - The time slots the span takes.
	 * @param organizationId - The log's organization.
	 * @param employeeId - The log's employee.
	 * @param forceDelete - Hard delete (`true`) or soft delete (`false`).
	 */
	private async deleteSpanTimeSlots(
		timeLog: ITimeLog,
		spanTimeSlots: SpanTimeSlots,
		organizationId: ID,
		employeeId: ID,
		forceDelete: boolean
	): Promise<void> {
		const { ids: timeSlotsIds, named } = spanTimeSlots;

		// Given no ids, the bulk delete would select every time slot of the employee.
		if (isEmpty(timeSlotsIds)) {
			return;
		}

		await this._commandBus.execute(
			new TimeSlotBulkDeleteCommand({ organizationId, employeeId, timeLog, timeSlotsIds }, forceDelete, named)
		);
	}

	/**
	 * Deletes the log once the slot named for deletion was its last (see `SpanTimeSlots`).
	 *
	 * @param timeLog - The log the span was taken from.
	 * @param spanTimeSlots - The time slots the span took.
	 * @param forceDelete - Hard delete (`true`) or soft delete (`false`).
	 */
	private async deleteTimeLogWithoutTimeSlots(
		timeLog: ITimeLog,
		spanTimeSlots: SpanTimeSlots,
		forceDelete: boolean
	): Promise<void> {
		if (!spanTimeSlots.named) {
			return;
		}

		const stored = await this.typeOrmTimeLogRepository.findOne({
			where: { id: timeLog.id },
			relations: { timeSlots: true }
		});

		if (isEmpty(stored.timeSlots)) {
			await this.deleteTimeLog(stored, forceDelete);
		}
	}

	/**
	 * Diagnostic trace of the overlap handling, at debug level: the message is built only when debug logging
	 * is on (these ran as unconditional console output before).
	 *
	 * @param message - Builds the message to be logged.
	 */
	private debug(message: () => string): void {
		if (Logger.isLevelEnabled('debug')) {
			this.logger.debug(message());
		}
	}
}
