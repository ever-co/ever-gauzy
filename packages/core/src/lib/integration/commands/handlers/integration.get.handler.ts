import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IIntegration } from '@gauzy/contracts';
import { IntegrationGetCommand } from './../integration.get.command';
import { prepareSQLQuery as p } from './../../../database/database.helper';
import { TypeOrmIntegrationRepository } from '../../repository/type-orm-integration.repository';

@CommandHandler(IntegrationGetCommand)
export class IntegrationGetHandler implements ICommandHandler<IntegrationGetCommand> {
	constructor(private readonly typeOrmIntegrationRepository: TypeOrmIntegrationRepository) {}

	/**
	 *
	 * @param command
	 * @returns
	 */
	public async execute(command: IntegrationGetCommand): Promise<IIntegration[]> {
		const { input } = command;
		const { integrationTypeId, searchQuery, filter } = input;

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
