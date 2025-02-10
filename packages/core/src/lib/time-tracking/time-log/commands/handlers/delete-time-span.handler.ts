import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import { omit } from 'underscore';
import { ID, ITimeLog, ITimeSlot } from '@gauzy/contracts';
import { isEmpty, isNotEmpty } from '@gauzy/utils';
import { moment } from '../../../../core/moment-extend';
import { TimesheetRecalculateCommand } from './../../../timesheet/commands';
import { TimeLog } from './../../time-log.entity';
import { DeleteTimeSpanCommand } from '../delete-time-span.command';
import { TimeLogUpdateCommand } from '../time-log-update.command';
import { TimeLogDeleteCommand } from '../time-log-delete.command';
import { TimeSlotService } from '../../../time-slot/time-slot.service';
import { TimeSlotBulkDeleteCommand } from './../../../time-slot/commands';
import { getStartEndIntervals } from './../../../time-slot/utils';
import { TypeOrmTimeLogRepository } from '../../repository/type-orm-time-log.repository';
import { TypeOrmTimeSlotRepository } from '../../../time-slot/repository/type-orm-time-slot.repository';

@CommandHandler(DeleteTimeSpanCommand)
export class DeleteTimeSpanHandler implements ICommandHandler<DeleteTimeSpanCommand> {
	constructor(
		readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository,
		readonly typeOrmTimeSlotRepository: TypeOrmTimeSlotRepository,
		private readonly _commandBus: CommandBus,
		private readonly _timeSlotService: TimeSlotService
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
		const { startedAt, stoppedAt, employeeId, organizationId } = log;

		const newTimeRange = moment.range(start, end); // Calculate the new time rang
		const dbTimeRange = moment.range(startedAt, stoppedAt); // Calculate the database time range

		/*
		 * Check is overlapping time or not.
		 */
		if (!newTimeRange.overlaps(dbTimeRange, { adjacent: false })) {
			console.log('Not Overlapping', newTimeRange, dbTimeRange);

			// Handle non-overlapping time ranges
			await this.handleNonOverlappingTimeRange(log, timeSlot, employeeId, organizationId, forceDelete);
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
				console.log('Delete time log because overlap entire time.');
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
				console.log(`Partial overlap: update started time or delete`);
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
				console.log(`Partial overlap: update stopped time or delete`);
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
				console.log('Split database time in two entries.');
				await this.handleTimeLogSplitting(
					timeLog,
					timeSlot,
					organizationId,
					employeeId,
					start,
					end,
					startedAt,
					forceDelete
				);
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
		// Delete the associated time slots
		const timeSlotsIds = [timeSlot.id];

		// Bulk delete the time slots
		await this._commandBus.execute(
			new TimeSlotBulkDeleteCommand(
				{
					organizationId,
					employeeId,
					timeLog,
					timeSlotsIds
				},
				forceDelete,
				true
			)
		);

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
				console.log(`update startedAt time to ${end}`);
				// Update the started at time
				let timeLog: ITimeLog = await this._commandBus.execute(
					new TimeLogUpdateCommand({ startedAt: end }, log, true, forceDelete)
				);

				// Delete the associated time slots
				const timeSlotsIds = [slot.id];

				// Bulk delete the time slots
				await this._commandBus.execute(
					new TimeSlotBulkDeleteCommand(
						{
							organizationId,
							employeeId,
							timeLog,
							timeSlotsIds
						},
						forceDelete,
						true
					)
				);

				// Check if there are any remaining time slots
				timeLog = await this.typeOrmTimeLogRepository.findOne({
					where: { id: timeLog.id },
					relations: { timeSlots: true }
				});

				// If no remaining time slots, delete the time log
				if (isEmpty(timeLog.timeSlots)) {
					// Delete TimeLog if remaining timeSlots are 0
					await this.deleteTimeLog(timeLog, forceDelete);
				}
			} catch (error) {
				console.log('Error while updating startedAt time', error);
			}
		} else {
			// Delete the time log if remaining duration is 0
			console.log('Remaining duration is 0, so we are deleting the time log during update startedAt time');
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
				console.log(`update stoppedAt time to ${start}`);

				// Update the stoppedAt time
				let timeLog: ITimeLog = await this._commandBus.execute(
					new TimeLogUpdateCommand({ stoppedAt: start }, log, true, forceDelete)
				);

				// Delete the associated time slots
				const timeSlotsIds = [slot.id];

				// Bulk delete the time slots
				await this._commandBus.execute(
					new TimeSlotBulkDeleteCommand(
						{
							organizationId,
							employeeId,
							timeLog,
							timeSlotsIds
						},
						forceDelete,
						true
					)
				);

				// Check if there are any remaining time slots
				timeLog = await this.typeOrmTimeLogRepository.findOne({
					where: { id: timeLog.id },
					relations: { timeSlots: true }
				});

				// If no remaining time slots, delete the time log
				if (isEmpty(timeLog.timeSlots)) {
					await this.deleteTimeLog(timeLog, forceDelete);
				}
			} catch (error) {
				console.log('Error while updating stoppedAt time', error);
			}
		} else {
			console.log('Remaining duration is 0, so we are deleting the time log during update stoppedAt time');
			await this.deleteTimeLog(log, forceDelete);
		}
	}

	/**
	 * Handles splitting a time log into two entries and processing the associated time slots.
	 *
	 * @param timeLog - The original time log to split.
	 * @param timeSlot - The related time slot.
	 * @param organizationId - The organization ID.
	 * @param employeeId - The employee ID.
	 * @param start - The new start time.
	 * @param end - The new end time.
	 * @param startedAt - The original start time of the time log.
	 */
	private async handleTimeLogSplitting(
		timeLog: ITimeLog,
		timeSlot: ITimeSlot,
		organizationId: ID,
		employeeId: ID,
		start: Date,
		end: Date,
		startedAt: Date,
		forceDelete: boolean = false
	): Promise<void> {
		const startedAtMoment = moment(startedAt); // Get the started at moment
		const startMoment = moment(start); // Get the start moment
		const remainingDuration = startMoment.diff(startedAtMoment, 'seconds'); // Calculate the remaining duration

		// If there is remaining duration
		if (remainingDuration > 0) {
			try {
				timeLog.stoppedAt = start;
				await this.typeOrmTimeLogRepository.save(timeLog);
			} catch (error) {
				console.error(`Error while updating stoppedAt time for ID: ${timeLog.id}`, error);
			}
		} else {
			// Delete the old time log if remaining duration is 0
			await this.deleteTimeLog(timeLog, forceDelete);
		}

		try {
			// Delete the associated time slots
			const timeSlotsIds = [timeSlot.id];

			// Bulk delete the time slots
			await this._commandBus.execute(
				new TimeSlotBulkDeleteCommand(
					{
						organizationId,
						employeeId,
						timeLog,
						timeSlotsIds
					},
					forceDelete,
					true
				)
			);
		} catch (error) {
			console.error(`Error while splitting time entries: ${remainingDuration}`, error);
		}

		// Handle the creation of the new time log
		await this.createAndSyncNewTimeLog(timeLog, end);
	}

	/**
	 * Creates and syncs the new time log if the duration is greater than 0.
	 *
	 * @param timeLog - The original time log (will be cloned).
	 * @param end - The new start time for the new log.
	 */
	private async createAndSyncNewTimeLog(timeLog: ITimeLog, end: Date): Promise<void> {
		const clone: TimeLog = omit(timeLog, ['createdAt', 'updatedAt', 'id']);
		const newLog = clone;
		newLog.startedAt = end;

		// Calculate the remaining duration of the new log
		const newLogRemainingDuration = moment(newLog.stoppedAt).diff(moment(newLog.startedAt), 'seconds');

		// If there is remaining duration
		if (newLogRemainingDuration > 0) {
			try {
				await this.typeOrmTimeLogRepository.save(newLog);
			} catch (error) {
				console.log('Error while creating new log', error, newLog);
			}

			try {
				// Sync time slots for the new time log
				const slots = await this.syncTimeSlots(newLog);
				console.log('sync time slots for new log', { slots }, { newLog });

				// Assign the new log to time slots and save
				if (isNotEmpty(slots)) {
					// Assign the new log to time slots and save
					for await (const ts of slots) {
						ts.timeLogs = [newLog];
					}

					await this.typeOrmTimeSlotRepository.save(slots);
				}
			} catch (error) {
				console.error('Error while creating or syncing new log and time slots', error);
			}
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
			console.log(`Error while, delete time log because overlap entire time for ID: ${timeLog.id}`, error);
		}
	}

	/**
	 * Synchronizes time slots for the provided time log.
	 *
	 * This method calculates the start and end intervals based on the `startedAt` and `stoppedAt`
	 * values from the provided time log. It then retrieves the corresponding time slots for the
	 * specified employee and organization within that time range. The time slot synchronization
	 * is triggered with the `syncSlots` flag set to true.
	 *
	 * @param timeLog - The time log containing the data used to synchronize time slots (start, stop, employeeId, organizationId).
	 * @returns A promise that resolves to the retrieved time slots within the specified range for the employee and organization.
	 */
	private async syncTimeSlots(timeLog: ITimeLog): Promise<ITimeSlot[]> {
		const { startedAt, stoppedAt, employeeId, organizationId } = timeLog;

		// Calculate start and end intervals based on the time log's start and stop times
		const { start, end } = getStartEndIntervals(moment(startedAt), moment(stoppedAt));

		// Retrieve and return the corresponding time slots within the interval for the given employee and organization
		return await this._timeSlotService.getTimeSlots({
			startDate: moment(start).toDate(),
			endDate: moment(end).toDate(),
			organizationId,
			employeeIds: [employeeId],
			syncSlots: true
		});
	}
}
