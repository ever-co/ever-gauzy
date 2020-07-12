import { OrganizationClients } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrganizationClientsCreateCommand } from '../organization-clients-create.commant';
import { OrganizationClientsService } from '../../organization-clients.service';

@CommandHandler(OrganizationClientsCreateCommand)
export class OrganizationClientsCreateHandler
	implements ICommandHandler<OrganizationClientsCreateCommand> {
	constructor(
		private readonly organizationClientsService: OrganizationClientsService
	) {}

	public async execute(
		command: OrganizationClientsCreateCommand
	): Promise<OrganizationClients> {
		const { input } = command;

		return await this.organizationClientsService.create(input);
	}
}
