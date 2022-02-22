import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import * as moment from 'moment';
import { isEmpty, isNotEmpty } from "@gauzy/common";
import { getConfig } from '@gauzy/config';
import { TimeLog } from './../../time-log.entity';
import { ScheduleTimeLogEntriesCommand } from '../schedule-time-log-entries.command';
import { ITimeLog } from '@gauzy/contracts';

@CommandHandler(ScheduleTimeLogEntriesCommand)
export class ScheduleTimeLogEntriesHandler 
	implements ICommandHandler<ScheduleTimeLogEntriesCommand> {

	constructor(
		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>
	) {}

	public async execute(command: ScheduleTimeLogEntriesCommand) {
		const { timeLog } = command;
		let timeLogs: ITimeLog[] = [];
		if (timeLog) {
			timeLogs = await this.timeLogRepository.find({
				where: (query: SelectQueryBuilder<TimeLog>) => {
					query.andWhere(`"${query.alias}"."id" =: id`, { id: timeLog.id });
				},
				relations: ['timeSlots']
			});
		} else {
			timeLogs = await this.timeLogRepository.find({
				where: (query: SelectQueryBuilder<TimeLog>) => {
					query.andWhere(`"${query.alias}"."stoppedAt" IS NULL`);
				},
				relations: ['timeSlots']
			});
		}
		
		for await (const timeLog of timeLogs) {
			const logDifference = moment().diff(moment.utc(timeLog.startedAt), 'minutes');
			if (
				isEmpty(timeLog.timeSlots) &&
				logDifference > 10
			) {
				await this.timeLogRepository.save({
					id: timeLog.id,
					stoppedAt: timeLog.startedAt,
					isRunning: false
				});
			} else if (isNotEmpty(timeLog.timeSlots)) {
				const [lastTimeSlot] = timeLog.timeSlots.reverse();

				let stoppedAt: any;
				let slotDifference: any;

				const duration = timeLog.timeSlots.reduce(
					(sum: number, current: any) => sum + current.duration, 0
				);
				/**
				 * Adjust stopped date as per database selection
				 */
				if (getConfig().dbConnectionOptions.type === 'sqlite') {
					stoppedAt = moment.utc(lastTimeSlot.startedAt).add(duration, 'seconds').format('YYYY-MM-DD HH:mm:ss.SSS');
					slotDifference = moment.utc(moment()).diff(stoppedAt, 'minutes');
				} else {
					stoppedAt = moment(lastTimeSlot.startedAt).add(duration, 'seconds').toDate();
					slotDifference = moment().diff(moment.utc(stoppedAt), 'minutes');
				}

				if (slotDifference > 10) {
					await this.timeLogRepository.save({
						id: timeLog.id,
						stoppedAt: stoppedAt,
						isRunning: false
					});
				}
			} else {
				/**
				 * Stop previous pending timer anyway.
				 * If we have any pending TimeLog entry
				 */
				await this.timeLogRepository.save({
					id: timeLog.id,
					isRunning: false
				});
			}
		}
	}
}
