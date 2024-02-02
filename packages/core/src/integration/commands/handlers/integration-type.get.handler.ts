import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { InjectRepository } from '@nestjs/typeorm';
import { IIntegrationType } from '@gauzy/contracts';
import { IntegrationTypeGetCommand } from '../integration-type.get.command';
import { IntegrationType } from '../../integration-type.entity';
import { TypeOrmIntegrationTypeRepository } from '../../repository/type-orm-integration-type.repository';

@CommandHandler(IntegrationTypeGetCommand)
export class IntegrationTypeGetHandler implements ICommandHandler<IntegrationTypeGetCommand> {

	constructor(
		@InjectRepository(IntegrationType)
		readonly typeOrmIntegrationTypeRepository: TypeOrmIntegrationTypeRepository
	) { }

	/**
	 *
	 * @param command
	 * @returns
	 */
	public async execute(
		command: IntegrationTypeGetCommand
	): Promise<IIntegrationType[]> {
		return await this.typeOrmIntegrationTypeRepository.find({
			order: {
				order: 'ASC'
			}
		});
	}
}
