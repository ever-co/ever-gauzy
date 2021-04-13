import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import { TimeLog } from './../../../time-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeSlotService } from '../../../time-slot/time-slot.service';
import * as _ from 'underscore';
import { DeleteTimeSpanCommand } from '../delete-time-span.command';
import { TimeLogUpdateCommand } from '../time-log-update.command';
import { TimeLogDeleteCommand } from '../time-log-delete.command';
import { moment } from '../../../../core/moment-extend';
import { ITimeLog, ITimeSlot } from '@gauzy/contracts';
import { TimeSlot } from './../../../../core';

@CommandHandler(DeleteTimeSpanCommand)
export class DeleteTimeSpanHandler
	implements ICommandHandler<DeleteTimeSpanCommand> {
	constructor(
		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,

		@InjectRepository(TimeSlot)
		private readonly timeSlotRepository: Repository<TimeSlot>,
		private readonly commandBus: CommandBus,
		private readonly timeSlotService: TimeSlotService
	) {}

	public async execute(command: DeleteTimeSpanCommand) {
		const { newTime, timeLog } = command;
		const { start, end } = newTime;
		const { startedAt, stoppedAt, employeeId } = timeLog;

		const newTimeRange = moment.range(start, end);
		const dbTimeRange = moment.range(startedAt, stoppedAt);

		console.log({ start, end });
		console.log({ startedAt, stoppedAt });
		/*
		 * Check is overlaping time or not.
		 */
		if (!newTimeRange.overlaps(dbTimeRange, { adjacent: false })) {
			console.log('Not Overlaping', newTimeRange, dbTimeRange);
			return false;
		}

		if (
			moment(startedAt).isBetween(moment(start), moment(end), null, '[]')
		) {
			if (
				moment(stoppedAt).isBetween(
					moment(start),
					moment(end),
					null,
					'[]'
				)
			) {
				/*
				 * Delete time log because overlap entire time.
				 * New Start time							New Stop time
				 * |-----------------------------------------------------|
				 * 		DB Start Time				DB Stop Time
				 *  		|--------------------------------------|
				 */
				console.log('Delete time log because overlap entire time:', {
					start,
					end
				});
				await this.commandBus.execute(
					new TimeLogDeleteCommand(timeLog, true)
				);
			} else {
				/*
				 * Update start time
				 * New Start time							New Stop time
				 * |-----------------------------------------------------|
				 * 		DB Start Time				DB Stop Time
				 * 		|--------------------------------------	|
				 */
				const remainingDuration = moment(stoppedAt).diff(
					moment(end),
					'seconds'
				);
				console.log('Update Time Log Start Time:', remainingDuration);
				if (remainingDuration > 0) {
					await this.commandBus.execute(
						new TimeLogUpdateCommand(
							{
								startedAt: end
							},
							timeLog
						)
					);
					await this.timeSlotService.rangeDelete(
						employeeId,
						start,
						end
					);
				} else {
					/*
					 * Delete if remaining duration 0 seconds
					 */
					await this.commandBus.execute(
						new TimeLogDeleteCommand(timeLog, true)
					);
				}
			}
		} else {
			if (
				moment(timeLog.stoppedAt).isBetween(
					moment(start),
					moment(end),
					null,
					'[]'
				)
			) {
				/*
				 * Update stopped time
				 * New Start time							New Stop time
				 * |----------------------------------------------------|
				 * 		DB Start Time				DB Stop Time
				 * 		|--------------------------------------|
				 */
				const remainingDuration = moment(end).diff(
					moment(startedAt),
					'seconds'
				);
				console.log('Update Time Log Stop Time:', remainingDuration);
				if (remainingDuration > 0) {
					await this.commandBus.execute(
						new TimeLogUpdateCommand(
							{
								stoppedAt: start
							},
							timeLog
						)
					);
					await this.timeSlotService.rangeDelete(
						employeeId,
						start,
						end
					);
				} else {
					/*
					 * Delete if remaining duration 0 seconds
					 */
					await this.commandBus.execute(
						new TimeLogDeleteCommand(timeLog, true)
					);
				}
			} else {
				/*
				 * Split database time in two entries.
				 * New Start time (start)						New Stop time (end)
				 * |---------------------------------------------------------------|
				 * 		DB Start Time (startedAt)	DB Stop Time (stoppedAt)
				 *  		|--------------------------------------------------|
				 */
				console.log('Split database time logs in two entries');
				const remainingDuration = moment(start).diff(
					moment(startedAt),
					'seconds'
				);
				const timeLogClone: TimeLog = _.omit(timeLog, [
					'createdAt',
					'updatedAt',
					'id'
				]);
				console.log(
					'Split Time Log Remaining Duration:',
					remainingDuration
				);

				if (remainingDuration > 0) {
					timeLog.stoppedAt = start;
					await this.timeLogRepository.save(timeLog);
					await this.syncTimeSlots(timeLog).then((timeSlots) => {
						console.log(
							'Existed Timelog Split Entry:',
							timeLog,
							timeSlots
						);
					});
				} else {
					/*
					 * Delete if remaining duration 0 seconds
					 */
					await this.commandBus.execute(
						new TimeLogDeleteCommand(timeLog, true)
					);
				}

				await this.timeSlotService.rangeDelete(employeeId, start, end);

				const newLog = timeLogClone;
				newLog.startedAt = end;

				const newLogRemainingDuration = moment(newLog.stoppedAt).diff(
					moment(newLog.startedAt),
					'seconds'
				);

				/*
				 * Insert if remaining duration is more 0 seconds
				 */
				if (newLogRemainingDuration > 0) {
					await this.timeLogRepository.save(newLog);
					await this.syncTimeSlots(newLog).then((timeSlots) => {
						console.log(
							'New Timelog Split Entry:',
							newLog,
							timeSlots
						);
						(async () => {
							if (timeSlots.length) {
								let timeLogs: ITimeLog[] = [];
								timeLogs = timeLogs.concat(newLog);

								timeSlots.forEach((timeSlot: ITimeSlot) => {
									timeSlot.timeLogs = timeLogs;
								});
								await this.timeSlotRepository.save(timeSlots);
							}
						})();
					});
				}
			}
		}
		return true;
	}

	private async syncTimeSlots(timeLog: ITimeLog) {
		const {
			startedAt,
			stoppedAt,
			employeeId,
			organizationId,
			tenantId
		} = timeLog;

		let startDate: any = moment(startedAt);
		startDate.set(
			'minute',
			startDate.get('minute') - (startDate.get('minute') % 10)
		);
		startDate.set('second', 0);
		startDate.set('millisecond', 0);

		let endDate: any = moment(stoppedAt);
		endDate.set(
			'minute',
			endDate.get('minute') + (endDate.get('minute') % 10) - 1
		);
		endDate.set('second', 59);
		endDate.set('millisecond', 0);

		return await this.timeSlotService.getTimeSlots({
			startDate: moment(startDate).toDate(),
			endDate: moment(endDate).subtract(1, 'second').toDate(),
			organizationId,
			tenantId,
			employeeIds: [employeeId]
		});
	}
}
