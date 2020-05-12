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
		return await this.repository
			.createQueryBuilder('integration')
			.leftJoinAndSelect(
				'integration.integrationTypes',
				'integrationTypes'
			)
			.where('"integrationTypes"."id" = :id', {
				id: input.integrationTypeId
			})
			.andWhere('LOWER(integration.name) LIKE :name', {
				name: `${input.searchQuery.toLowerCase()}%`
			})
			.getMany();
	}
}
