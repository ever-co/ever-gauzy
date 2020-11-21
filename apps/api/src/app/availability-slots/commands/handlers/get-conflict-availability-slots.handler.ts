import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as moment from 'moment';
import { AvailabilitySlot } from '../../availability-slots.entity';
import { GetConflictAvailabilitySlotsCommand } from '../get-conflict-availability-slots.command';

@CommandHandler(GetConflictAvailabilitySlotsCommand)
export class GetConflictAvailabilitySlotsHandler
	implements ICommandHandler<GetConflictAvailabilitySlotsCommand> {
	constructor(
		@InjectRepository(AvailabilitySlot)
		private readonly timeLogRepository: Repository<AvailabilitySlot>
	) {}

	public async execute(
		command: GetConflictAvailabilitySlotsCommand
	): Promise<AvailabilitySlot[]> {
		const { input } = command;

		const startedAt = moment.utc(input.startTime).toDate();
		const stoppedAt = moment.utc(input.endTime).toDate();
		let conflictQuery = this.timeLogRepository.createQueryBuilder();

		conflictQuery = conflictQuery
			.where(`"${conflictQuery.alias}"."employeeId" = :employeeId`, {
				employeeId: input.employeeId
			})
			.andWhere(`"${conflictQuery.alias}"."deletedAt" IS null`)
			.andWhere(
				`("${conflictQuery.alias}"."startTime", "${conflictQuery.alias}"."endTime") OVERLAPS (timestamptz '${startedAt}', timestamptz '${stoppedAt}')`
			);

		if (input.type) {
			conflictQuery.andWhere(`${conflictQuery.alias}.type = :type`, {
				type: input.type
			});
		}

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
