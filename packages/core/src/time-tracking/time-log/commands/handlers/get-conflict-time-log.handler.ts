import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as moment from 'moment';
import { ConfigService, databaseTypes } from '@gauzy/config';
import { prepareSQLQuery as p } from './../../../../database/database.helper';
import { TimeLog } from './../../time-log.entity';
import { IGetConflictTimeLogCommand } from '../get-conflict-time-log.command';
import { RequestContext } from './../../../../core/context';

@CommandHandler(IGetConflictTimeLogCommand)
export class GetConflictTimeLogHandler implements ICommandHandler<IGetConflictTimeLogCommand> {

	constructor(
		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>,
		private readonly configService: ConfigService
	) { }

	public async execute(
		command: IGetConflictTimeLogCommand
	): Promise<TimeLog[]> {
		const { input } = command;

		const tenantId = RequestContext.currentTenantId() || input.tenantId;
		const { employeeId, organizationId } = input;

		const startedAt = moment.utc(input.startDate).toISOString();
		const stoppedAt = moment.utc(input.endDate).toISOString();

		let conflictQuery = this.timeLogRepository.createQueryBuilder();

		let query: string = ``;
		switch (this.configService.dbConnectionOptions.type) {
			case databaseTypes.sqlite:
			case databaseTypes.betterSqlite3:
				query = `'${startedAt}' >= "${conflictQuery.alias}"."startedAt" and '${startedAt}' <= "${conflictQuery.alias}"."stoppedAt"`;
				break;
			case databaseTypes.postgres:
				query = `("${conflictQuery.alias}"."startedAt", "${conflictQuery.alias}"."stoppedAt") OVERLAPS (timestamptz '${startedAt}', timestamptz '${stoppedAt}')`;
				break;
			case databaseTypes.mysql:
				query = p(`"${conflictQuery.alias}"."startedAt" BETWEEN '${startedAt}' AND '${stoppedAt}' AND "${conflictQuery.alias}"."stoppedAt" BETWEEN '${startedAt}' AND '${stoppedAt}'`);
				break;
			default:
				throw Error(`cannot get conflict time log due to unsupported database type: ${this.configService.dbConnectionOptions.type}`);

		}
		conflictQuery = conflictQuery
			.innerJoinAndSelect(`${conflictQuery.alias}.timeSlots`, 'timeSlots')
			.where(p(`"${conflictQuery.alias}"."employeeId" = :employeeId`), { employeeId })
			.andWhere(p(`"${conflictQuery.alias}"."tenantId" = :tenantId`), { tenantId })
			.andWhere(p(`"${conflictQuery.alias}"."organizationId" = :organizationId`), { organizationId })
			.andWhere(query);
		if (input.relations) {
			input.relations.forEach((relation) => {
				conflictQuery = conflictQuery.leftJoinAndSelect(
					`${conflictQuery.alias}.${relation}`,
					relation
				);
			});
		}
		if (input.ignoreId) {
			conflictQuery = conflictQuery.andWhere(
				`${conflictQuery.alias}.id NOT IN (:...id)`,
				{
					id:
						input.ignoreId instanceof Array
							? input.ignoreId
							: [input.ignoreId]
				}
			);
		}
		return await conflictQuery.getMany();
	}
}
