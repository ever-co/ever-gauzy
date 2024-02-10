import { ICommandHandler, CommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import * as moment from 'moment';
import { ConfigService } from '@gauzy/config';
import { IAvailabilitySlot } from '@gauzy/contracts';
import { AvailabilitySlot } from '../../availability-slots.entity';
import { GetConflictAvailabilitySlotsCommand } from '../get-conflict-availability-slots.command';
import { RequestContext } from './../../../core/context';
import { DatabaseTypeEnum } from '@gauzy/config';
import { prepareSQLQuery as p } from './../../../database/database.helper';
import { TypeOrmAvailabilitySlotRepository } from '../../repository/type-orm-availability-slot.repository';
import { MikroOrmAvailabilitySlotRepository } from '../../repository/mikro-orm-availability-slot.repository';

@CommandHandler(GetConflictAvailabilitySlotsCommand)
export class GetConflictAvailabilitySlotsHandler implements ICommandHandler<GetConflictAvailabilitySlotsCommand> {

	constructor(
		@InjectRepository(AvailabilitySlot)
		readonly typeOrmAvailabilitySlotRepository: TypeOrmAvailabilitySlotRepository,

		readonly mikroOrmAvailabilitySlotRepository: MikroOrmAvailabilitySlotRepository,

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

		const query = this.typeOrmAvailabilitySlotRepository.createQueryBuilder();
		query.andWhere(p(`"${query.alias}"."tenantId" = :tenantId`), {
			tenantId
		});
		query.andWhere(p(`"${query.alias}"."employeeId" = :employeeId`), {
			employeeId
		});

		switch (this.configService.dbConnectionOptions.type) {
			case DatabaseTypeEnum.sqlite:
			case DatabaseTypeEnum.betterSqlite3:
				query.andWhere(`'${startedAt}' >= "${query.alias}"."startTime" AND '${startedAt}' <= "${query.alias}"."endTime"`);
				break;
			case DatabaseTypeEnum.postgres:
				query.andWhere(
					`(
						"${query.alias}"."startTime", "${query.alias}"."endTime") OVERLAPS (timestamptz '${startedAt}', timestamptz '${stoppedAt}'
					)`
				);
				break;
			case DatabaseTypeEnum.mysql:
				query.andWhere(
					p(`(
						("${query.alias}"."startTime" BETWEEN CAST('${startedAt}' AS DATETIME) AND CAST('${stoppedAt}' AS DATETIME))
						OR
						("${query.alias}"."endTime" BETWEEN CAST('${startedAt}' AS DATETIME) AND CAST('${stoppedAt}' AS DATETIME))
						OR
						("${query.alias}"."startTime" <= CAST('${startedAt}' AS DATETIME) AND "${query.alias}"."endTime" >= CAST('${stoppedAt}' AS DATETIME))
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
