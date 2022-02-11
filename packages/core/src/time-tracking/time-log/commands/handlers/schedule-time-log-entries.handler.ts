import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import * as moment from 'moment';
import { isEmpty, isNotEmpty } from "@gauzy/common";
import { TimeLog } from './../../time-log.entity';
import { ScheduleTimeLogEntriesCommand } from '../schedule-time-log-entries.command';

@CommandHandler(ScheduleTimeLogEntriesCommand)
export class ScheduleTimeLogEntriesHandler 
	implements ICommandHandler<ScheduleTimeLogEntriesCommand> {

	constructor(
		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>
	) {}

	public async execute(command: ScheduleTimeLogEntriesCommand) {
		const timeLogs = await this.timeLogRepository.find({
			where: (query: SelectQueryBuilder<TimeLog>) => {
				query.andWhere(`"${query.alias}"."stoppedAt" IS NULL`);
			},
			relations: ['timeSlots']
		});
		for await (const timeLog of timeLogs) {
			const logDifference = moment().diff(moment(timeLog.startedAt), 'minutes');
			if (
				isEmpty(timeLog.timeSlots) &&
				logDifference > 10
			) {
				await this.timeLogRepository.save({
					id: timeLog.id,
					stoppedAt: timeLog.startedAt,
					...timeLog,
				});
			} else if (isNotEmpty(timeLog.timeSlots)) {
				const [lastTimeSlot] = timeLog.timeSlots.reverse();
				const slotDifference = moment().diff(moment(lastTimeSlot.stoppedAt), 'minutes');
				if (slotDifference > 10) {
					await this.timeLogRepository.save({
						id: timeLog.id,
						stoppedAt: timeLog.startedAt
					});
				}
			}
		}
	}
}
