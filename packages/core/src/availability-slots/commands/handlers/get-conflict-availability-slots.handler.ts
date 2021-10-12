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
		private readonly availabilitySlotRepository: Repository<AvailabilitySlot>,

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

		const query = this.availabilitySlotRepository.createQueryBuilder();
		query.andWhere(`"${query.alias}"."tenantId" = :tenantId`, {
			tenantId
		});
		query.andWhere(`"${query.alias}"."employeeId" = :employeeId`, {
			employeeId
		});

		query.andWhere(
			this.configService.dbConnectionOptions.type === 'sqlite'
				? `'${startedAt}' >= "${query.alias}"."startTime" AND '${startedAt}' <= "${query.alias}"."endTime"`
				: `("${query.alias}"."startTime", "${query.alias}"."endTime") OVERLAPS (timestamptz '${startedAt}', timestamptz '${stoppedAt}')`
		);

		// organization and tenant for availability slots conflicts
		if (organizationId) {
			query.andWhere(`"${query.alias}"."organizationId" = :organizationId`, {
				organizationId
			});
		}

		if (input.type) {
			query.andWhere(`${query.alias}.type = :type`, {
				type: input.type 
			});
		}

		if (input.relations) {
			input.relations.forEach((relation) => {
				query.leftJoinAndSelect(
					`${query.alias}.${relation}`,
					relation
				);
			});
		}

		if (input.ignoreId) {
			query.andWhere(
				`${query.alias}.id NOT IN (:...id)`,
				{
					id:
						input.ignoreId instanceof Array
							? input.ignoreId
							: [input.ignoreId]
				}
			);
		}

		return await query.getMany();
	}
}
