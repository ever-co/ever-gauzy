import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as moment from 'moment';
import { ConfigService } from '@gauzy/config';
import { TimeLog } from './../../time-log.entity';
import { IGetConflictTimeLogCommand } from '../get-conflict-time-log.command';
import { RequestContext } from './../../../../core/context';

@CommandHandler(IGetConflictTimeLogCommand)
export class GetConflictTimeLogHandler
	implements ICommandHandler<IGetConflictTimeLogCommand> {
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

		conflictQuery = conflictQuery
			.innerJoinAndSelect(`${conflictQuery.alias}.timeSlots`, 'timeSlots')
			.where(`"${conflictQuery.alias}"."employeeId" = :employeeId`, { employeeId })
			.andWhere(`"${conflictQuery.alias}"."tenantId" = :tenantId`, { tenantId })
			.andWhere(`"${conflictQuery.alias}"."organizationId" = :organizationId`, { organizationId })
			.andWhere(
				['sqlite', 'better-sqlite3'].includes(this.configService.dbConnectionOptions.type)
					? `'${startedAt}' >= "${conflictQuery.alias}"."startedAt" and '${startedAt}' <= "${conflictQuery.alias}"."stoppedAt"`
					: `("${conflictQuery.alias}"."startedAt", "${conflictQuery.alias}"."stoppedAt") OVERLAPS (timestamptz '${startedAt}', timestamptz '${stoppedAt}')`
			);

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
