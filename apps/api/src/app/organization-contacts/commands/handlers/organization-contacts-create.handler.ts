import { OrganizationContacts } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrganizationContactsCreateCommand } from '../organization-contacts-create.commant';
import { OrganizationContactsService } from '../../organization-contacts.service';

@CommandHandler(OrganizationContactsCreateCommand)
export class OrganizationContactsCreateHandler
	implements ICommandHandler<OrganizationContactsCreateCommand> {
	constructor(
		private readonly organizationContactsService: OrganizationContactsService
	) {}

	public async execute(
		command: OrganizationContactsCreateCommand
	): Promise<OrganizationContacts> {
		const { input } = command;

		return await this.organizationContactsService.create(input);
	}
}
