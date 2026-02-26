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
				const where: any = {
					integrationTypes: { id: integrationTypeId }
				};

				if (searchQuery) {
					where.name = { $ilike: `${searchQuery.toLowerCase()}%` };
				}

				if (filter === 'true' || filter === 'false') {
					where.isPaid = filter === 'true';
				}

				const items = await this.mikroOrmIntegrationRepository.find(where, {
					populate: ['integrationTypes'] as any,
					orderBy: { order: 'ASC' } as any
				});

				return items as IIntegration[];
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
