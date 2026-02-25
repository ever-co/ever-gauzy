import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IIntegration } from '@gauzy/contracts';
import { IntegrationGetCommand } from './../integration.get.command';
import { prepareSQLQuery as p } from './../../../database/database.helper';
import { MultiORM, MultiORMEnum, getORMType } from './../../../core/utils';
import { TypeOrmIntegrationRepository } from '../../repository/type-orm-integration.repository';
import { MikroOrmIntegrationRepository } from '../../repository/mikro-orm-integration.repository';

@CommandHandler(IntegrationGetCommand)
export class IntegrationGetHandler implements ICommandHandler<IntegrationGetCommand> {
	protected ormType: MultiORM = getORMType();

	constructor(
		private readonly typeOrmIntegrationRepository: TypeOrmIntegrationRepository,
		private readonly mikroOrmIntegrationRepository: MikroOrmIntegrationRepository
	) {}

	/**
	 *
	 * @param command
	 * @returns
	 */
	public async execute(command: IntegrationGetCommand): Promise<IIntegration[]> {
		const { input } = command;
		const { integrationTypeId, searchQuery, filter } = input;

		switch (this.ormType) {
			case MultiORMEnum.MikroORM: {
				const knex = this.mikroOrmIntegrationRepository.getKnex();
				const qb = knex('integration')
					.withSchema(knex.userParams.schema)
					.join('integration_integration_type', 'integration_integration_type.integrationId', 'integration.id')
					.where('integration_integration_type.integrationTypeId', integrationTypeId)
					.andWhereRaw('LOWER("integration"."name") LIKE ?', [`${searchQuery.toLowerCase()}%`])
					.orderBy('integration.order', 'asc');

				if (filter === 'true' || filter === 'false') {
					qb.andWhere('integration.isPaid', filter === 'true');
				}

				return await qb.select('integration.*');
			}
			case MultiORMEnum.TypeORM:
			default: {
				const query = this.typeOrmIntegrationRepository.createQueryBuilder('integration');
				query.leftJoinAndSelect('integration.integrationTypes', 'integrationTypes');
				query.where(p('"integrationTypes"."id" = :id'), { id: integrationTypeId });
				query.andWhere(`LOWER(${query.alias}.name) LIKE :name`, { name: `${searchQuery.toLowerCase()}%` });

				if (filter === 'true' || filter === 'false') {
					query.andWhere(`${query.alias}.isPaid = :isPaid`, { isPaid: filter === 'true' });
				}

				return await query.orderBy(`${query.alias}.order`, 'ASC').getMany();
			}
		}
	}
}
