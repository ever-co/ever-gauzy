import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { TimeLog } from '../../../time-log.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as moment from 'moment';
import { GetConfictTimeLogCommand } from '../get-confict-time-log.command';

@CommandHandler(GetConfictTimeLogCommand)
export class GetConfictTimeLogHandler
	implements ICommandHandler<GetConfictTimeLogCommand> {
	constructor(
		@InjectRepository(TimeLog)
		private readonly timeLogRepository: Repository<TimeLog>
	) {}

	public async execute(
		command: GetConfictTimeLogCommand
	): Promise<TimeLog[]> {
		const { input } = command;

		const startedAt = moment.utc(input.startDate).toISOString();
		const stoppedAt = moment.utc(input.endDate).toISOString();
		let confictQuery = this.timeLogRepository.createQueryBuilder();

		confictQuery = confictQuery
			.where(`"${confictQuery.alias}"."employeeId" = :employeeId`, {
				employeeId: input.employeeId
			})
			.andWhere(`"${confictQuery.alias}"."deletedAt" IS null`)
			.andWhere(
				`("${confictQuery.alias}"."startedAt", "${confictQuery.alias}"."stoppedAt") OVERLAPS (timestamptz '${startedAt}', timestamptz '${stoppedAt}')`
			);

		if (input.relations) {
			input.relations.forEach((relation) => {
				confictQuery = confictQuery.leftJoinAndSelect(
					`${confictQuery.alias}.${relation}`,
					relation
				);
			});
		}

		if (input.ignoreId) {
			confictQuery = confictQuery.andWhere(
				`${confictQuery.alias}.id NOT IN (:...id)`,
				{
					id:
						input.ignoreId instanceof Array
							? input.ignoreId
							: [input.ignoreId]
				}
			);
		}
		return await confictQuery.getMany();
	}
}
