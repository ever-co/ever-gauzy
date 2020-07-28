import { ICommandHandler, CommandBus, CommandHandler } from '@nestjs/cqrs';
import { TimeLog } from '../../../time-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TimeSlotService } from '../../../time-slot/time-slot.service';
import * as _ from 'underscore';
import { DeleteTimeSpanCommand } from '../delete-time-span.command';
import * as moment from 'moment';
import { TimeLogUpdateCommand } from '../time-log-update.command';
import { TimeLogDeleteCommand } from '../time-log-delete.command';

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

		console.log('deleteTimeSpan', {
			startedAt: timeLog.startedAt,
			stoppedAt: timeLog.stoppedAt,
			start,
			end
		});
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
				console.log(
					'deleteTimeSpan Delete time log because overlap entire time'
				);

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
				console.log('deleteTimeSpan Update start time');
				const reamingDueration = moment(timeLog.stoppedAt).diff(
					moment(end),
					'seconds'
				);
				console.log(
					'deleteTimeSpan reamingDueration',
					reamingDueration
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
				console.log('deleteTimeSpan Update stopped time');
				const reamingDueration = moment(end).diff(
					moment(timeLog.startedAt),
					'seconds'
				);
				console.log(
					'deleteTimeSpan reamingDueration',
					reamingDueration
				);
				if (reamingDueration > 0) {
					await this.timeLogRepository.update(
						{
							id: timeLog.id
						},
						{
							stoppedAt: start
						}
					);
				} else {
					/* Delete if reaming dueration 0 seconds */
					await this.commandBus.execute(
						new TimeLogDeleteCommand(timeLog)
					);
				}
			} else {
				/* Split database time in two entries.
				 * 		New Start time				New Stop time
				 *  			|----------------------------|
				 * DB Start Time									DB Stop Time
				 *  |--------------------------------------------------|
				 */
				console.log(
					'deleteTimeSpan Split database time in two entries'
				);
				const reamingDueration = moment(end).diff(
					moment(timeLog.startedAt),
					'seconds'
				);
				console.log(
					'deleteTimeSpan reamingDueration',
					reamingDueration
				);
				if (reamingDueration > 0) {
					await this.timeLogRepository.update(
						{
							id: timeLog.id
						},
						{
							stoppedAt: start
						}
					);
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

				const newLog = _.omit(timeLog, [
					'createdAt',
					'updatedAt',
					'id'
				]);
				newLog.startedAt = end;
				const newLogreamingDueration = moment(newLog.stoppedAt).diff(
					moment(newLog.startedAt),
					'seconds'
				);

				console.log(
					'deleteTimeSpan newLogreamingDueration',
					newLogreamingDueration,
					newLog
				);
				/* Insert if reaming dueration is more 0 seconds */
				if (newLogreamingDueration > 0) {
					await this.timeLogRepository.insert(newLog);
				}
			}
		}
		return true;
	}
}
