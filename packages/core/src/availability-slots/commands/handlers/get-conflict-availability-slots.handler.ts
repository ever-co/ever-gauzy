import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as moment from 'moment';
import { ConfigService } from '@gauzy/config';
import { IAvailabilitySlot } from '@gauzy/contracts';
import { AvailabilitySlot } from '../../availability-slots.entity';
import { GetConflictAvailabilitySlotsCommand } from '../get-conflict-availability-slots.command';
import { RequestContext } from './../../../core/context';

@CommandHandler(GetConflictAvailabilitySlotsCommand)
export class GetConflictAvailabilitySlotsHandler
	implements ICommandHandler<GetConflictAvailabilitySlotsCommand> {
	constructor(
		@InjectRepository(AvailabilitySlot)
		private readonly timeLogRepository: Repository<AvailabilitySlot>,

		private readonly configService: ConfigService
	) {}

	public async execute(
		command: GetConflictAvailabilitySlotsCommand
	): Promise<IAvailabilitySlot[]> {
		
		const { input } = command;
		const { startTime, endTime, employeeId, organizationId } = input;
		const tenantId = RequestContext.currentTenantId() || input.tenantId;

		const startedAt = moment(startTime).toISOString();
		const stoppedAt = moment(endTime).toISOString();

		const conflictQuery = this.timeLogRepository.createQueryBuilder();
		conflictQuery.andWhere(`"${conflictQuery.alias}"."tenantId" = :tenantId`, {
			tenantId
		});
		conflictQuery.andWhere(`"${conflictQuery.alias}"."employeeId" = :employeeId`, {
			employeeId
		});

		conflictQuery.andWhere(
			this.configService.dbConnectionOptions.type === 'sqlite'
				? `'${startedAt}' >= "${conflictQuery.alias}"."startTime" AND '${startedAt}' <= "${conflictQuery.alias}"."endTime"`
				: `("${conflictQuery.alias}"."startedAt", "${conflictQuery.alias}"."stoppedAt") OVERLAPS (timestamptz '${startedAt}', timestamptz '${stoppedAt}')`
		);

		// organization and tenant for availability slots conflicts
		if (organizationId) {
			conflictQuery.andWhere(`"${conflictQuery.alias}"."organizationId" = :organizationId`, {
				organizationId
			});
		}

		if (input.type) {
			conflictQuery.andWhere(`${conflictQuery.alias}.type = :type`, {
				type: input.type 
			});
		}

		if (input.relations) {
			input.relations.forEach((relation) => {
				conflictQuery.leftJoinAndSelect(
					`${conflictQuery.alias}.${relation}`,
					relation
				);
			});
		}

		if (input.ignoreId) {
			conflictQuery.andWhere(
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
