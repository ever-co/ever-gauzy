import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import { TimeLog } from './../../time-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeSlotService } from '../../../time-slot/time-slot.service';
import * as _ from 'underscore';
import { DeleteTimeSpanCommand } from '../delete-time-span.command';
import { TimeLogUpdateCommand } from '../time-log-update.command';
import { TimeLogDeleteCommand } from '../time-log-delete.command';
import { moment } from '../../../../core/moment-extend';
import { ITimeLog } from '@gauzy/contracts';
import { isNotEmpty } from '@gauzy/common';
import { TimeSlot } from './../../../../core/entities/internal';
import { TimeSlotRangeDeleteCommand } from './../../../time-slot/commands';

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
		const { id } = timeLog;
		const { start, end } = newTime;

		const refreshTimeLog = await this.timeLogRepository.findOne(id);
		const { startedAt, stoppedAt, employeeId } = refreshTimeLog;

		const newTimeRange = moment.range(start, end);
		const dbTimeRange = moment.range(startedAt, stoppedAt);

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
				return await this.commandBus.execute(
					new TimeSlotRangeDeleteCommand(
						employeeId,
						start,
						end
					)
				);
			}
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
				if (remainingDuration > 0) {
					await this.commandBus.execute(
						new TimeLogUpdateCommand(
							{
								startedAt: end
							},
							timeLog,
							true
						)
					);
					return await this.commandBus.execute(
						new TimeSlotRangeDeleteCommand(
							employeeId,
							start,
							end
						)
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
				if (remainingDuration > 0) {
					await this.commandBus.execute(
						new TimeLogUpdateCommand(
							{
								stoppedAt: start
							},
							timeLog,
							true
						)
					);
					return await this.commandBus.execute(
						new TimeSlotRangeDeleteCommand(
							employeeId,
							start,
							end
						)
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
				const remainingDuration = moment(start).diff(
					moment(startedAt),
					'seconds'
				);
				const timeLogClone: TimeLog = _.omit(timeLog, [
					'createdAt',
					'updatedAt',
					'id'
				]);
				try {
					if (remainingDuration > 0) {
						timeLog.stoppedAt = start;
						await this.timeLogRepository.save(timeLog);
					} else {
						/*
						 * Delete if remaining duration 0 seconds
						 */
						await this.commandBus.execute(
							new TimeLogDeleteCommand(timeLog, true)
						);
					}
					await this.commandBus.execute(
						new TimeSlotRangeDeleteCommand(
							employeeId,
							start,
							end
						)
					);
				} catch (error) {
					console.error(`Error while split time entires: ${remainingDuration}`);
				}

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
					try {
						const timeSlots = await this.syncTimeSlots(newLog);
						if (isNotEmpty(timeSlots)) {
							let timeLogs: ITimeLog[] = [];
							timeLogs = timeLogs.concat(newLog);

							for await (const timeSlot of timeSlots) {
								timeSlot.timeLogs = timeLogs;
							}

							await this.timeSlotRepository.save(timeSlots);
						}
					} catch (error) {
						console.log('Error while synce TimeSlot & TimeLog', error)
					}
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
			organizationId
		} = timeLog;

		let startDate: any = moment(startedAt);
		startDate
			.set('minute', startDate.get('minute') - (startDate.get('minute') % 10))
			.set('second', 0)
			.set('millisecond', 0);

		let endDate: any = moment(stoppedAt);
		endDate
			.set('minute', endDate.get('minute') + (endDate.get('minute') % 10) - 1)
			.set('second', 59)
			.set('millisecond', 0);
	
		return await this.timeSlotService.getTimeSlots({
			startDate: moment(startDate).toDate(),
			endDate: moment(endDate).toDate(),
			organizationId,
			employeeIds: [employeeId]
		});
	}
}
