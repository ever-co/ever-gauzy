import { Logger } from '@nestjs/common';
import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import { omit } from 'underscore';
import { ID, ITimeLog, ITimeSlot } from '@gauzy/contracts';
import { isEmpty } from '@gauzy/utils';
import { moment } from '../../../../core/moment-extend';
import { TimesheetRecalculateCommand } from './../../../timesheet/commands';
import { TimeLog } from './../../time-log.entity';
import { DeleteTimeSpanCommand } from '../delete-time-span.command';
import { TimeLogUpdateCommand } from '../time-log-update.command';
import { TimeLogDeleteCommand } from '../time-log-delete.command';
import { TimeSlotBulkDeleteCommand } from './../../../time-slot/commands';
import { TimeSlot } from '../../../time-slot/time-slot.entity';
import { TypeOrmTimeLogRepository } from '../../repository/type-orm-time-log.repository';
import { TypeOrmTimeSlotRepository } from '../../../time-slot/repository/type-orm-time-slot.repository';

/** A time slot covers the ten minutes from its start, as `TimeSlotSubscriber` sets its `stoppedAt`. */
const TIME_SLOT_MINUTES = 10;

/**
 * Whether time from `from` to `to` reaches into the ten minutes of a time slot.
 *
 * @param timeSlot - The time slot.
 * @param from - The start of the time.
 * @param to - The end of the time.
 */
function reachesTimeSlot(timeSlot: ITimeSlot, from: Date, to: Date): boolean {
	const slotStart = moment(timeSlot.startedAt);
	const slotEnd = slotStart.clone().add(TIME_SLOT_MINUTES, 'minutes');
	const startsBeforeSlotEnds = moment(from).isBefore(slotEnd);
	const endsAfterSlotStarts = moment(to).isAfter(slotStart);
	return startsBeforeSlotEnds && endsAfterSlotStarts;
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

		// Callers send one command per slot of a conflicting log. When the new range covers that log, the
		// command for its first slot deletes the whole log, so the next ones find nothing left to trim.
		if (!log) {
			return false;
		}

		const { startedAt, stoppedAt, employeeId, organizationId } = log;

		const newTimeRange = moment.range(start, end); // Calculate the new time rang
		const dbTimeRange = moment.range(startedAt, stoppedAt); // Calculate the database time range

		/*
		 * Check is overlapping time or not.
		 */
		if (!newTimeRange.overlaps(dbTimeRange, { adjacent: false })) {
			this.debug(() => `Not Overlapping ${JSON.stringify({ newTimeRange, dbTimeRange })}`);

			// Handle non-overlapping time ranges
			await this.handleNonOverlappingTimeRange(log, timeSlot, employeeId, organizationId, forceDelete);
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
					timeSlot,
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
					timeSlot,
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
				await this.handleTimeLogSplitting(log, timeSlot, start, end, forceDelete);
			}
		}

		return true;
	}

	/**
	 * Handles non-overlapping time ranges by deleting the time log and associated time slots,
	 * and recalculating the timesheet.
	 *
	 * @param timeLog - The time log associated with the non-overlapping time range.
	 * @param timeSlot - The time slot to be deleted.
	 * @param employeeId - The ID of the employee associated with the time log.
	 * @param organizationId - The ID of the organization.
	 * @param forceDelete - A flag indicating whether to perform a hard delete.
	 */
	private async handleNonOverlappingTimeRange(
		timeLog: ITimeLog,
		timeSlot: ITimeSlot,
		employeeId: ID,
		organizationId: ID,
		forceDelete: boolean = false
	): Promise<void> {
		await this.deleteSpanTimeSlots(timeLog, [timeSlot.id], organizationId, employeeId, forceDelete);

		// Recalculate the timesheet
		await this._commandBus.execute(new TimesheetRecalculateCommand(timeLog.timesheetId));
	}

	/**
	 * Updates the start time or deletes the time log if remaining duration is 0.
	 *
	 * @param log - The time log to update or delete.
	 * @param slot - The related time slot.
	 * @param organizationId - The organization ID.
	 * @param employeeId - The employee ID.
	 * @param end - The new end time.
	 * @param stoppedAt - The current stopped time of the log.
	 */
	private async updateStartTimeOrDelete(
		log: ITimeLog,
		slot: ITimeSlot,
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

				await this.deleteSpanTimeSlots(timeLog, [slot.id], organizationId, employeeId, forceDelete);
				await this.deleteTimeLogWithoutTimeSlots(timeLog, forceDelete);
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
	 * @param slot - The related time slot.
	 * @param organizationId - The organization ID.
	 * @param employeeId - The employee ID.
	 * @param start - The new start time.
	 * @param startedAt - The original start time of the time log.
	 * @param end - The new end time for the time log.
	 */
	private async updateStopTimeOrDelete(
		log: ITimeLog,
		slot: ITimeSlot,
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

				// Update the stoppedAt time
				const timeLog: ITimeLog = await this._commandBus.execute(
					new TimeLogUpdateCommand({ stoppedAt: start }, log, true, forceDelete)
				);

				await this.deleteSpanTimeSlots(timeLog, [slot.id], organizationId, employeeId, forceDelete);
				await this.deleteTimeLogWithoutTimeSlots(timeLog, forceDelete);
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
	 * @param timeSlot - The time slot deleted with the span.
	 * @param start - The start of the span, where the log now stops.
	 * @param end - The end of the span, where the copy starts.
	 * @param forceDelete - Hard delete (`true`) or soft delete (`false`).
	 */
	private async handleTimeLogSplitting(
		log: TimeLog,
		timeSlot: ITimeSlot,
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

			await this.deleteSpanTimeSlots(log, [timeSlot.id], organizationId, employeeId, forceDelete);
		} catch (error) {
			this.logger.error(`Error while splitting time log ${log.id}: ${error?.message ?? error}`, error?.stack);
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
	 * Deletes the time slots the span takes from the log, whatever other log holds them.
	 *
	 * @param timeLog - The log the span is taken from.
	 * @param timeSlotsIds - The time slots to delete.
	 * @param organizationId - The log's organization.
	 * @param employeeId - The log's employee.
	 * @param forceDelete - Hard delete (`true`) or soft delete (`false`).
	 */
	private async deleteSpanTimeSlots(
		timeLog: ITimeLog,
		timeSlotsIds: ID[],
		organizationId: ID,
		employeeId: ID,
		forceDelete: boolean
	): Promise<void> {
		await this._commandBus.execute(
			new TimeSlotBulkDeleteCommand({ organizationId, employeeId, timeLog, timeSlotsIds }, forceDelete, true)
		);
	}

	/**
	 * Deletes the log once it holds no time slot.
	 *
	 * @param timeLog - The log the span was taken from.
	 * @param forceDelete - Hard delete (`true`) or soft delete (`false`).
	 */
	private async deleteTimeLogWithoutTimeSlots(timeLog: ITimeLog, forceDelete: boolean): Promise<void> {
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
