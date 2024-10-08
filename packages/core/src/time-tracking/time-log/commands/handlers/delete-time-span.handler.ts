import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import * as _ from 'underscore';
import { ITimeLog, ITimeSlot } from '@gauzy/contracts';
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

		const { startedAt, stoppedAt, employeeId, organizationId, timesheetId } = log;

		const newTimeRange = moment.range(start, end);
		const dbTimeRange = moment.range(startedAt, stoppedAt);

		console.log({ newTimeRange, dbTimeRange });
		/*
		 * Check is overlapping time or not.
		 */
		if (!newTimeRange.overlaps(dbTimeRange, { adjacent: false })) {
			console.log('Not Overlapping', newTimeRange, dbTimeRange);
			/**
			 * If TimeSlot Not Overlapping the TimeLog
			 * Still we have to remove that TimeSlot with screenshots/activities
			 */
			if (employeeId && start && end) {
				const timeSlotsIds = [timeSlot.id];
				await this._commandBus.execute(
					new TimeSlotBulkDeleteCommand(
						{
							organizationId,
							employeeId,
							timeLog: log,
							timeSlotsIds
						},
						forceDelete,
						true
					)
				);
				await this._commandBus.execute(new TimesheetRecalculateCommand(timesheetId));
			}
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
				try {
					await this._commandBus.execute(new TimeLogDeleteCommand(log, forceDelete));
				} catch (error) {
					console.log('Error while, delete time log because overlap entire time.', error);
				}
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
								true
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
						if (isEmpty(updatedTimeLog.timeSlots)) {
							await this._commandBus.execute(new TimeLogDeleteCommand(updatedTimeLog, forceDelete));
						}
					} catch (error) {
						console.log('Error while, updating startedAt time', error);
					}
				} else {
					console.log('Delete startedAt time log.');
					try {
						/*
						 * Delete if remaining duration 0 seconds
						 */
						await this._commandBus.execute(new TimeLogDeleteCommand(log, forceDelete));
					} catch (error) {
						console.log('Error while, deleting time log for startedAt time', error);
					}
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
					console.log('Update stoppedAt time.');
					try {
						let updatedTimeLog: ITimeLog = await this._commandBus.execute(
							new TimeLogUpdateCommand(
								{
									stoppedAt: start
								},
								timeLog,
								true
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
						if (isEmpty(updatedTimeLog.timeSlots)) {
							await this._commandBus.execute(new TimeLogDeleteCommand(updatedTimeLog, forceDelete));
						}
					} catch (error) {
						console.log('Error while, updating stoppedAt time', error);
					}
				} else {
					console.log('Delete stoppedAt time log.');
					try {
						/*
						 * Delete if remaining duration 0 seconds
						 */
						await this._commandBus.execute(new TimeLogDeleteCommand(log, forceDelete));
					} catch (error) {
						console.log('Error while, deleting time log for stoppedAt time', error);
					}
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
				const timeLogClone: TimeLog = _.omit(timeLog, ['createdAt', 'updatedAt', 'id']);
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
