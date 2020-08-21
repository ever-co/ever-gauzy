import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import { TimeLog } from '../../../time-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeSlotService } from '../../../time-slot/time-slot.service';
import * as _ from 'underscore';
import { DeleteTimeSpanCommand } from '../delete-time-span.command';
import { TimeLogUpdateCommand } from '../time-log-update.command';
import { TimeLogDeleteCommand } from '../time-log-delete.command';
import { moment } from '../../../../core/moment-extend';

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

		const newTimeRange = moment.range(start, end);
		const dbTimeRange = moment.range(timeLog.startedAt, timeLog.stoppedAt);

		/* Check is overlaping time or not.
		 */
		if (!newTimeRange.overlaps(dbTimeRange, { adjacent: false })) {
			console.log('not overlaping', newTimeRange, dbTimeRange);
			return false;
		}

		if (
			moment(timeLog.startedAt).isBetween(
				moment(start),
				moment(end),
				null,
				'[]'
			)
		) {
			if (
				moment(timeLog.stoppedAt).isBetween(
					moment(start),
					moment(end),
					null,
					'[]'
				)
			) {
				/* Delete time log because overlap entire time.
				 * New Start time							New Stop time
				 *  |----------------------------------------------|
				 * 		DB Start Time				DB Stop Time
				 *  			|----------------------------|
				 */
				console.log('Delete time log because overlap entire time');

				await this.commandBus.execute(
					new TimeLogDeleteCommand(timeLog, true)
				);
			} else {
				/* Update start time
				 * New Start time							New Stop time
				 *  |----------------------------------------------|
				 * 						DB Start Time							DB Stop Time
				 *  							|---------------------------------------|
				 */
				console.log('Update start time');
				const reamingDueration = moment(timeLog.stoppedAt).diff(
					moment(end),
					'seconds'
				);
				if (reamingDueration > 0) {
					await this.commandBus.execute(
						new TimeLogUpdateCommand(
							{
								startedAt: end
							},
							timeLog
						)
					);
				} else {
					/* Delete if reaming dueration 0 seconds */
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
				/* Update stopped time
				 * 			New Start time							New Stop time
				 *  			|----------------------------------------------|
				 * DB Start Time			DB Stop Time
				 *  	|-----------------------|
				 */
				console.log('Update stopped time');
				const reamingDueration = moment(end).diff(
					moment(timeLog.startedAt),
					'seconds'
				);

				if (reamingDueration > 0) {
					await this.commandBus.execute(
						new TimeLogUpdateCommand(
							{
								stoppedAt: start
							},
							timeLog
						)
					);
				} else {
					/* Delete if reaming dueration 0 seconds */
					await this.commandBus.execute(
						new TimeLogDeleteCommand(timeLog)
					);
				}
			} else {
				/* Split database time in two entries.
				 * 		New Start time (start)			New Stop time (end)
				 *  			|----------------------------|
				 * DB Start Time (startedAt)					DB Stop Time (stoppedAt)
				 *  |--------------------------------------------------|
				 */
				console.log('Split database time in two entries');
				const reamingDueration = moment(start).diff(
					moment(timeLog.startedAt),
					'seconds'
				);
				const timeLogClone: TimeLog = _.omit(timeLog, [
					'createdAt',
					'updatedAt',
					'id'
				]);

				if (reamingDueration > 0) {
					timeLog.stoppedAt = start;

					timeLog.timeSlots = await this.timeSlotService.getTimeSlots(
						{
							startDate: timeLog.startedAt,
							endDate: moment(timeLog.stoppedAt)
								.subtract(1, 'second')
								.toDate()
						}
					);

					await this.timeLogRepository.save(timeLog);
				} else {
					/* Delete if reaming dueration 0 seconds */
					await this.commandBus.execute(
						new TimeLogDeleteCommand(timeLog, true)
					);
				}

				this.timeSlotService.rangeDelete(
					timeLog.employeeId,
					start,
					end
				);

				const newLog = timeLogClone;
				newLog.startedAt = end;

				// const range = moment.range(newLog.startedAt, newLog.stoppedAt)
				// console.log(range, Array.from(range.by('minutes', { step: 10, excludeEnd: true })).map(m => m.format('YYYY-MM-DD HH:mm:ss')));

				newLog.timeSlots = await this.timeSlotService.getTimeSlots({
					startDate: newLog.startedAt,
					endDate: moment(newLog.stoppedAt)
						.subtract(1, 'second')
						.toDate()
				});

				const newLogReamingDueration = moment(newLog.stoppedAt).diff(
					moment(newLog.startedAt),
					'seconds'
				);

				/* Insert if reaming dueration is more 0 seconds */
				if (newLogReamingDueration > 0) {
					await this.timeLogRepository.save(newLog);
				}
			}
		}
		return true;
	}
}
