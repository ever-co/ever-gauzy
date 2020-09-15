import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { TimeLog } from '../../../time-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as moment from 'moment';
import { IGetConflictTimeLogCommand } from '../get-conflict-time-log.command';

@CommandHandler(IGetConflictTimeLogCommand)
export class GetConflictTimeLogHandler
	implements ICommandHandler<IGetConflictTimeLogCommand> {
	constructor(
		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>
	) {}

	public async execute(
		command: IGetConflictTimeLogCommand
	): Promise<TimeLog[]> {
		const { input } = command;

		const startedAt = moment.utc(input.startDate).toISOString();
		const stoppedAt = moment.utc(input.endDate).toISOString();
		let conflictQuery = this.timeLogRepository.createQueryBuilder();

		conflictQuery = conflictQuery
			.where(`"${conflictQuery.alias}"."employeeId" = :employeeId`, {
				employeeId: input.employeeId
			})
			.andWhere(`"${conflictQuery.alias}"."deletedAt" IS null`)
			.andWhere(
				`("${conflictQuery.alias}"."startedAt", "${conflictQuery.alias}"."stoppedAt") OVERLAPS (timestamptz '${startedAt}', timestamptz '${stoppedAt}')`
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
