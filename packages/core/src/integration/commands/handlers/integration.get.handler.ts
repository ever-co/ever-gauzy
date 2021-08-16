import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IIntegration } from '@gauzy/contracts';
import { IntegrationGetCommand } from './../integration.get.command';
import { Integration } from '../../integration.entity';

@CommandHandler(IntegrationGetCommand)
export class IntegrationGetHandler
	implements ICommandHandler<IntegrationGetCommand> {
	constructor(
		@InjectRepository(Integration)
		private readonly repository: Repository<Integration>
	) {}

	public async execute(
		command: IntegrationGetCommand
	): Promise<IIntegration[]> {
		const { input } = command;
		const { integrationTypeId, searchQuery, filter } = input;
		const query = this.repository.createQueryBuilder('integration');
		query
			.leftJoinAndSelect(
				'integration.integrationTypes',
				'integrationTypes'
			)
			.where('"integrationTypes"."id" = :id', {
				id: integrationTypeId
			})
			.andWhere(`LOWER(${query.alias}.name) LIKE :name`, {
				name: `${searchQuery.toLowerCase()}%`
			});

		if (filter === 'true') {
			query.andWhere(`${query.alias}.isPaid = :isPaid`, {
				isPaid: true
			});
		}
		if (filter === 'false') {
			query.andWhere(`${query.alias}.isPaid = :isPaid`, {
				isPaid: false
			});
		}
		return await query.orderBy(`${query.alias}.order`, 'ASC').getMany();
	}
}
