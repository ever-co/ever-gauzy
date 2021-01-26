import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IntegrationTypeGetCommand } from '..';
import { InjectRepository } from '@nestjs/typeorm';
import { IntegrationType } from '../../integration-type.entity';
import { Repository } from 'typeorm';

@CommandHandler(IntegrationTypeGetCommand)
export class IntegrationTypeGetHandler
	implements ICommandHandler<IntegrationTypeGetCommand> {
	constructor(
		@InjectRepository(IntegrationType)
		readonly repository: Repository<IntegrationType>
	) {}

	public async execute(
		command: IntegrationTypeGetCommand
	): Promise<IntegrationType[]> {
		return await this.repository.find({
			order: {
				order: 'ASC'
			}
		});
	}
}
