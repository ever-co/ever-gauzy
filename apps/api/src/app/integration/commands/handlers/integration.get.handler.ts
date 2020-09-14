import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IntegrationGetCommand } from '..';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Integration } from '../../integration.entity';

@CommandHandler(IntegrationGetCommand)
export class IntegrationGetHandler
	implements ICommandHandler<IntegrationGetCommand> {
	constructor(
		@InjectRepository(Integration)
		readonly repository: Repository<Integration>
	) {}

	public async execute(
		command: IntegrationGetCommand
	): Promise<Integration[]> {
		const { input } = command;

		const query = this.repository.createQueryBuilder('integration');
		query
			.leftJoinAndSelect(
				'integration.integrationTypes',
				'integrationTypes'
			)
			.where('"integrationTypes"."id" = :id', {
				id: input.integrationTypeId
			})
			.andWhere('LOWER(integration.name) LIKE :name', {
				name: `${input.searchQuery.toLowerCase()}%`
			});

		if (input['filter'] === 'true') {
			query.andWhere('integration.isPaid = :isPaid', {
				isPaid: true
			});
		}
		if (input['filter'] === 'false') {
			query.andWhere('integration.isPaid = :isPaid', {
				isPaid: false
			});
		}

		return await query.getMany();
	}
}
