import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as moment from 'moment';
import { ConfigService } from '@gauzy/config';
import { IAvailabilitySlot } from '@gauzy/contracts';
import { AvailabilitySlot } from '../../availability-slots.entity';
import { GetConflictAvailabilitySlotsCommand } from '../get-conflict-availability-slots.command';
import { RequestContext } from './../../../core/context';
import { prepareSQLQuery as p, databaseTypes } from '@gauzy/config';

@CommandHandler(GetConflictAvailabilitySlotsCommand)
export class GetConflictAvailabilitySlotsHandler
	implements ICommandHandler<GetConflictAvailabilitySlotsCommand> {
	constructor(
		@InjectRepository(AvailabilitySlot)
		private readonly availabilitySlotRepository: Repository<AvailabilitySlot>,

		private readonly configService: ConfigService
	) { }

	public async execute(
		command: GetConflictAvailabilitySlotsCommand
	): Promise<IAvailabilitySlot[]> {

		const { input } = command;
		const { startTime, endTime, employeeId, organizationId } = input;
		const tenantId = RequestContext.currentTenantId() || input.tenantId;

		const startedAt = moment(startTime).toISOString();
		const stoppedAt = moment(endTime).toISOString();

		const query = this.availabilitySlotRepository.createQueryBuilder();
		query.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), {
			tenantId
		});
		query.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), {
			employeeId
		});

		switch (this.configService.dbConnectionOptions.type) {
			case databaseTypes.sqlite:
			case databaseTypes.betterSqlite3:
				query.andWhere(`'${startedAt}' >= "${query.alias}"."startTime" AND '${startedAt}' <= "${query.alias}"."endTime"`);
				break;
			case databaseTypes.postgres:
				query.andWhere(
					`(
						"${query.alias}"."startTime", "${query.alias}"."endTime") OVERLAPS (timestamptz '${startedAt}', timestamptz '${stoppedAt}'
					)`
				);
				break;
			case databaseTypes.mysql:
				query.andWhere(
					p(`(
						"${query.alias}"."startTime", "${query.alias}"."endTime") OVERLAPS (timestamptz '${startedAt}', timestamptz '${stoppedAt}'
					)`)
				);
				break;
			default:
				throw Error(
					`cannot compare startTime/endTime due to unsupported database type: ${this.configService.dbConnectionOptions.type}`
				);
		}

		// organization and tenant for availability slots conflicts
		if (organizationId) {
			query.andWhere(p(`"${query.alias}"."organizationId" = :organizationId`), {
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
