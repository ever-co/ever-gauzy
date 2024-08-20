import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { Brackets, SelectQueryBuilder, WhereExpressionBuilder } from 'typeorm';
import * as moment from 'moment';
import { isEmpty, isNotEmpty } from '@gauzy/common';
import { ITimeLog } from '@gauzy/contracts';
import { prepareSQLQuery as p } from './../../../../database/database.helper';
import { TimeLog } from './../../time-log.entity';
import { ScheduleTimeLogEntriesCommand } from '../schedule-time-log-entries.command';
import { RequestContext } from './../../../../core/context';
import { TypeOrmTimeLogRepository } from '../../repository/type-orm-time-log.repository';

@CommandHandler(ScheduleTimeLogEntriesCommand)
export class ScheduleTimeLogEntriesHandler implements ICommandHandler<ScheduleTimeLogEntriesCommand> {
	constructor(private readonly typeOrmTimeLogRepository: TypeOrmTimeLogRepository) {}

	/**
	 * Schedule TimeLog Entries
	 *
	 * @param command
	 * @returns
	 */
	public async execute(command: ScheduleTimeLogEntriesCommand): Promise<void> {
		const { timeLog } = command;
		let timeLogs: ITimeLog[] = [];

		// Query the timeLogs
		const query = this.typeOrmTimeLogRepository.createQueryBuilder('time_log');
		query.setFindOptions({
			relations: { timeSlots: true }
		});

		if (timeLog) {
			// Get the tenantId
			const tenantId = RequestContext.currentTenantId() || timeLog.tenantId;

			// Get the organizationId
			const { organizationId, employeeId } = timeLog;

			query.where((qb: SelectQueryBuilder<TimeLog>) => {
				qb.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						web.andWhere(p(`"${qb.alias}"."employeeId" = :employeeId`), { employeeId });
						web.andWhere(p(`"${qb.alias}"."organizationId" = :organizationId`), { organizationId });
						web.andWhere(p(`"${qb.alias}"."tenantId" = :tenantId`), { tenantId });
					})
				);
				qb.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						web.andWhere(
							new Brackets((web: WhereExpressionBuilder) => {
								web.andWhere(p(`"${qb.alias}"."stoppedAt" IS NOT NULL`));
								web.andWhere(p(`"${qb.alias}"."isRunning" = :isRunning`), { isRunning: true });
							})
						);
						web.orWhere(
							new Brackets((web: WhereExpressionBuilder) => {
								web.andWhere(p(`"${qb.alias}"."stoppedAt" IS NULL`));
							})
						);
					})
				);
				console.log('Schedule Time Log Query For Tenant Organization Entries', qb.getQueryAndParameters());
			});
		} else {
			query.where((qb: SelectQueryBuilder<TimeLog>) => {
				qb.andWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						web.andWhere(p(`"${qb.alias}"."stoppedAt" IS NOT NULL`));
						web.andWhere(p(`"${qb.alias}"."isRunning" = :isRunning`), { isRunning: true });
					})
				);
				qb.orWhere(
					new Brackets((web: WhereExpressionBuilder) => {
						web.andWhere(p(`"${qb.alias}"."stoppedAt" IS NULL`));
					})
				);
				console.log('Schedule Time Log Query For All Entries', query.getQueryAndParameters());
			});
		}

		// Get all pending TimeLog entries
		timeLogs = await query.getMany();

		// Loop through all the timeLogs
		for await (const timeLog of timeLogs) {
			const { timeSlots } = timeLog;

			// Calculate the minutes difference
			const minutes = moment().diff(moment.utc(timeLog.startedAt), 'minutes');

			// Handle case where there are no time slots
			if (isEmpty(timeLog.timeSlots)) {
				// If the minutes difference is greater than 10, update the stoppedAt date
				if (minutes > 10) {
					console.log('Schedule Time Log Entry Updated StoppedAt Using StartedAt', timeLog.startedAt);

					// Calculate the stoppedAt date
					const stoppedAt = moment.utc(timeLog.startedAt).add(10, 'seconds').toDate();

					// Calculate the stoppedAt date
					await this.typeOrmTimeLogRepository.save({
						id: timeLog.id,
						stoppedAt
					});
				}
			}
			// Handle case where there are time slots
			else if (isNotEmpty(timeLog.timeSlots)) {
				// Calculate the duration
				const duration = timeSlots.reduce<number>((sum, { duration }) => sum + duration, 0);

				// Calculate the stoppedAt date
				const stoppedAt = moment.utc(timeLog.startedAt).add(duration, 'seconds').toDate();

				// Calculate the minutes difference
				const minutes = moment.utc().diff(moment.utc(stoppedAt), 'minutes');

				console.log('Schedule Time Log Entry Updated StoppedAt Using StoppedAt', stoppedAt);

				// If the minutes difference is greater than 10, update the stoppedAt date
				if (minutes > 10) {
					await this.typeOrmTimeLogRepository.save({
						id: timeLog.id,
						stoppedAt
					});
				}
			}

			/**
			 * Stop previous pending timer anyway.
			 * If we have any pending TimeLog entry
			 */
			await this.typeOrmTimeLogRepository.save({
				id: timeLog.id,
				isRunning: false
			});
			console.log('Schedule Time Log Entry Updated Entry', timeLog);
		}
	}
}
