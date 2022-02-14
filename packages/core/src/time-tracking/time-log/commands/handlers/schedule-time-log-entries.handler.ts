import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import * as moment from 'moment';
import { isEmpty, isNotEmpty } from "@gauzy/common";
import { getConfig } from '@gauzy/config';
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
			const logDifference = moment().diff(moment.utc(timeLog.startedAt), 'minutes');
			if (
				isEmpty(timeLog.timeSlots) &&
				logDifference > 10
			) {
				await this.timeLogRepository.save({
					id: timeLog.id,
					stoppedAt: timeLog.startedAt
				});
			} else if (isNotEmpty(timeLog.timeSlots)) {
				const [lastTimeSlot] = timeLog.timeSlots.reverse();

				let stoppedAt: any;
				let slotDifference: any;

				/**
				 * Adjust stopped date as per database selection
				 */
				if (getConfig().dbConnectionOptions.type === 'sqlite') {
					stoppedAt = moment.utc(lastTimeSlot.startedAt)
						.add(lastTimeSlot.duration, 'seconds')
						.format('YYYY-MM-DD HH:mm:ss.SSS');
					slotDifference = moment.utc(moment()).diff(stoppedAt, 'minutes');
				} else {
					stoppedAt = moment(lastTimeSlot.startedAt)
						.add(lastTimeSlot.duration, 'seconds')
						.toDate();
					slotDifference = moment().diff(moment.utc(stoppedAt), 'minutes');
				}

				if (slotDifference > 10) {
					await this.timeLogRepository.save({
						id: timeLog.id,
						stoppedAt: stoppedAt
					});
				}
			}
		}
	}
}
