import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import { omit } from 'underscore';
import { ID, ITimeLog, ITimeSlot } from '@gauzy/contracts';
import { isEmpty, isNotEmpty } from '@gauzy/common';
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
				const remainingDuration = moment(stoppedAt).diff(moment(end), 'seconds');
				if (remainingDuration > 0) {
					try {
						console.log('Update startedAt time.');
						let updatedTimeLog: ITimeLog = await this._commandBus.execute(
							new TimeLogUpdateCommand(
								{
									startedAt: end
								},
								log,
								true,
								forceDelete
							)
						);
						const timeSlotsIds = [timeSlot.id];
						await this._commandBus.execute(
							new TimeSlotBulkDeleteCommand(
								{
									organizationId,
									employeeId,
									timeLog: updatedTimeLog,
									timeSlotsIds
								},
								forceDelete,
								true
							)
						);
						/*
						 * Delete TimeLog if remaining timeSlots are 0
						 */
						updatedTimeLog = await this.typeOrmTimeLogRepository.findOne({
							where: {
								id: updatedTimeLog.id
							},
							relations: {
								timeSlots: true
							}
						});

						// If no remaining time slots, delete the time log
						if (isEmpty(updatedTimeLog.timeSlots)) {
							await this.deleteTimeLog(updatedTimeLog, forceDelete);
						}
					} catch (error) {
						console.log('Error while, updating startedAt time', error);
					}
				} else {
					console.log('Delete startedAt time log.');
					// Delete if remaining duration 0 seconds
					await this.deleteTimeLog(log, forceDelete);
				}
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
				const remainingDuration = moment(end).diff(moment(startedAt), 'seconds');
				if (remainingDuration > 0) {
					try {
						console.log('Update stoppedAt time.');
						let updatedTimeLog: ITimeLog = await this._commandBus.execute(
							new TimeLogUpdateCommand(
								{
									stoppedAt: start
								},
								timeLog,
								true,
								forceDelete
							)
						);
						const timeSlotsIds = [timeSlot.id];
						await this._commandBus.execute(
							new TimeSlotBulkDeleteCommand(
								{
									organizationId,
									employeeId,
									timeLog: updatedTimeLog,
									timeSlotsIds
								},
								forceDelete,
								true
							)
						);

						/*
						 * Delete TimeLog if remaining timeSlots are 0
						 */
						updatedTimeLog = await this.typeOrmTimeLogRepository.findOne({
							where: {
								id: updatedTimeLog.id
							},
							relations: {
								timeSlots: true
							}
						});

						// If no remaining time slots, delete the time log
						if (isEmpty(updatedTimeLog.timeSlots)) {
							await this.deleteTimeLog(updatedTimeLog, forceDelete);
						}
					} catch (error) {
						console.log('Error while, updating stoppedAt time', error);
					}
				} else {
					console.log('Delete stoppedAt time log.');
					// Delete if remaining duration 0 seconds
					await this.deleteTimeLog(log, forceDelete);
				}
			} else {
				/*
				 * Split database time in two entries.
				 * New Start time (start)						New Stop time (end)
				 * |---------------------------------------------------------------|
				 * 		DB Start Time (startedAt)	DB Stop Time (stoppedAt)
				 *  		|--------------------------------------------------|
				 */
				console.log('Split database time in two entries.');
				const remainingDuration = moment(start).diff(moment(startedAt), 'seconds');
				const timeLogClone: TimeLog = omit(timeLog, ['createdAt', 'updatedAt', 'id']);
				try {
					if (remainingDuration > 0) {
						try {
							timeLog.stoppedAt = start;
							await this.typeOrmTimeLogRepository.save(timeLog);
						} catch (error) {
							console.error(`Error while updating old timelog`, error);
						}
					} else {
						/*
						 * Delete if remaining duration 0 seconds
						 */
						try {
							await this._commandBus.execute(new TimeLogDeleteCommand(log, forceDelete));
						} catch (error) {
							console.error(`Error while deleting old timelog`, error);
						}
					}
					const timeSlotsIds = [timeSlot.id];
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
					console.error(`Error while split time entires: ${remainingDuration}`);
				}

				const newLog = timeLogClone;
				newLog.startedAt = end;

				const newLogRemainingDuration = moment(newLog.stoppedAt).diff(moment(newLog.startedAt), 'seconds');
				/*
				 * Insert if remaining duration is more 0 seconds
				 */
				if (newLogRemainingDuration > 0) {
					try {
						await this.typeOrmTimeLogRepository.save(newLog);
					} catch (error) {
						console.log('Error while creating new log', error, newLog);
					}

					try {
						const timeSlots = await this.syncTimeSlots(newLog);
						console.log('Sync TimeSlots for new log', { timeSlots }, { newLog });
						if (isNotEmpty(timeSlots)) {
							let timeLogs: ITimeLog[] = [];
							timeLogs = timeLogs.concat(newLog);

							for await (const timeSlot of timeSlots) {
								timeSlot.timeLogs = timeLogs;
							}

							try {
								await this.typeOrmTimeSlotRepository.save(timeSlots);
							} catch (error) {
								console.log('Error while creating new TimeSlot & TimeLog entires', error, timeSlots);
							}
						}
					} catch (error) {
						console.log('Error while syncing TimeSlot & TimeLog', error);
					}
				}
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
		const timeSlotsIds = [timeSlot.id];

		// Delete the time log and its associated time slots
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
	): Promise<void> {}

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
	): Promise<void> {}

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
	): Promise<void> {}

	/**
	 * Creates and syncs the new time log if the duration is greater than 0.
	 *
	 * @param timeLog - The original time log (will be cloned).
	 * @param end - The new start time for the new log.
	 */
	private async createAndSyncNewTimeLog(timeLog: ITimeLog, end: Date): Promise<void> {}

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
