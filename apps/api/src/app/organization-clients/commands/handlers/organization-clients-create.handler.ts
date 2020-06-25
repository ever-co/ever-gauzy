import { OrganizationClients } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrganizationClientsCreateCommand } from '../organization-clients-create.commant';
import { OrganizationClientsService } from '../../organization-clients.service';
import { ContactsService } from '../../../contacts/contacts.service';

@CommandHandler(OrganizationClientsCreateCommand)
export class OrganizationClientsCreateHandler
	implements ICommandHandler<OrganizationClientsCreateCommand> {
	constructor(
		private readonly organizationClientsService: OrganizationClientsService
	) // private readonly contactsService: ContactsService
	{}

	public async execute(
		command: OrganizationClientsCreateCommand
	): Promise<OrganizationClients> {
		const { input } = command;
		console.log(input);
		// await this.contactsService.create(input);

		return await this.organizationClientsService.create(input);
	}
}
