import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import { TimeLog } from './../../../time-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { getRepository, Repository } from 'typeorm';
import { TimeSlotService } from '../../../time-slot/time-slot.service';
import * as _ from 'underscore';
import { DeleteTimeSpanCommand } from '../delete-time-span.command';
import { TimeLogUpdateCommand } from '../time-log-update.command';
import { TimeLogDeleteCommand } from '../time-log-delete.command';
import { moment } from '../../../../core/moment-extend';
import { ITimeLog } from '@gauzy/contracts';

@CommandHandler(DeleteTimeSpanCommand)
export class DeleteTimeSpanHandler
	implements ICommandHandler<DeleteTimeSpanCommand> {
	constructor(
		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,
		private readonly commandBus: CommandBus,
		private readonly timeSlotService: TimeSlotService
	) {}

	public async execute(command: DeleteTimeSpanCommand) {
		const { newTime, timeLog } = command;
		const { start, end } = newTime;
		const {
			startedAt,
			stoppedAt,
			employeeId,
			organizationId,
			tenantId
		} = timeLog;

		const newTimeRange = moment.range(start, end);
		const dbTimeRange = moment.range(startedAt, stoppedAt);

		console.log({ start, end });
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

					let startDate: any = moment(startedAt);
					startDate.set(
						'minute',
						startDate.get('minute') - (startDate.get('minute') % 10)
					);
					startDate.set('second', 0);
					startDate.set('millisecond', 0);

					let endDate: any = moment(start);
					endDate.set(
						'minute',
						endDate.get('minute') + (endDate.get('minute') % 10) - 1
					);
					endDate.set('second', 59);
					endDate.set('millisecond', 0);

					timeLog.timeSlots = await this.timeSlotService.getTimeSlots(
						{
							startDate: startDate,
							endDate: endDate,
							organizationId,
							tenantId,
							employeeIds: [employeeId]
						}
					);
					console.log('Existed Timelog Split Entry:', timeLog);
					await this.timeLogRepository.save(timeLog);
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

				let startDate: any = moment(end);
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

				console.log(
					'New Time Log:',
					{
						startedAt: newLog.startedAt,
						stoppedAt: newLog.stoppedAt
					},
					{ startDate, endDate }
				);

				newLog.timeSlots = await this.timeSlotService.getTimeSlots({
					startDate: moment(startDate).toDate(),
					endDate: moment(endDate).subtract(1, 'second').toDate(),
					organizationId,
					tenantId,
					employeeIds: [employeeId]
				});

				const newLogRemainingDuration = moment(newLog.stoppedAt).diff(
					moment(newLog.startedAt),
					'seconds'
				);

				console.log('New Timelog Split Entry:', newLog);
				/*
				 * Insert if remaining duration is more 0 seconds
				 */
				if (newLogRemainingDuration > 0) {
					await this.timeLogRepository.save(newLog);
				}
			}
		}
		return true;
	}
}
