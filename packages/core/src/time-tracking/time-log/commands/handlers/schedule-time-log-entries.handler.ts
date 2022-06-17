import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import * as moment from 'moment';
import { isEmpty, isNotEmpty } from "@gauzy/common";
import { getConfig } from '@gauzy/config';
import { ITimeLog } from '@gauzy/contracts';
import { TimeLog } from './../../time-log.entity';
import { ScheduleTimeLogEntriesCommand } from '../schedule-time-log-entries.command';
import { RequestContext } from './../../../../core/context';

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
			const { organizationId, employeeId } = timeLog;
			const tenantId = RequestContext.currentTenantId();

			timeLogs = await this.timeLogRepository.find({
				where: (query: SelectQueryBuilder<TimeLog>) => {
					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							qb.andWhere(`"${query.alias}"."employeeId" = :employeeId`, { employeeId });
							qb.andWhere(`"${query.alias}"."organizationId" = :organizationId`, { organizationId });
							qb.andWhere(`"${query.alias}"."tenantId" = :tenantId`, { tenantId });
						})
					);
					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							qb.andWhere(
								new Brackets((qb: WhereExpressionBuilder) => {
									qb.andWhere(`"${query.alias}"."stoppedAt" IS NOT NULL`);
									qb.andWhere(`"${query.alias}"."isRunning" = :isRunning`, { isRunning: true });
								})
							);
							qb.orWhere(
								new Brackets((qb: WhereExpressionBuilder) => {
									qb.andWhere(`"${query.alias}"."stoppedAt" IS NULL`);
								})
							);
						})
					);
					console.log('Schedule Time Log Query For Tenant Organization Entries', query.getQueryAndParameters());
				},
				relations: ['timeSlots']
			});
		} else {
			timeLogs = await this.timeLogRepository.find({
				where: (query: SelectQueryBuilder<TimeLog>) => {
					query.andWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							qb.andWhere(`"${query.alias}"."stoppedAt" IS NOT NULL`);
							qb.andWhere(`"${query.alias}"."isRunning" = :isRunning`, { isRunning: true });
						})
					);
					query.orWhere(
						new Brackets((qb: WhereExpressionBuilder) => {
							qb.andWhere(`"${query.alias}"."stoppedAt" IS NULL`);
						})
					);
					console.log('Schedule Time Log Query For All Entries', query.getQueryAndParameters());
				},
				relations: ['timeSlots']
			});
		}
		
		for await (const timeLog of timeLogs) {
			console.log('Schedule Time Log Entry', timeLog);
			const logDifference = moment().diff(moment.utc(timeLog.startedAt), 'minutes');
			if (
				isEmpty(timeLog.timeSlots) &&
				logDifference > 10
			) {
				console.log('Schedule Time Log Entry Updated StoppedAt', timeLog.startedAt);
				await this.timeLogRepository.save({
					id: timeLog.id,
					stoppedAt: moment(timeLog.startedAt).add(10, 'seconds').toDate()
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

				console.log('Schedule Time Log Entry Updated StoppedAt', stoppedAt);
				if (slotDifference > 10) {
					await this.timeLogRepository.save({
						id: timeLog.id,
						stoppedAt: stoppedAt
					});
				}
			}
			/**
			 * Stop previous pending timer anyway.
			 * If we have any pending TimeLog entry
			 */
			await this.timeLogRepository.save({
				id: timeLog.id,
				isRunning: false
			});
			console.log('Schedule Time Log Entry Updated Entry', timeLog);
		}
	}
}
