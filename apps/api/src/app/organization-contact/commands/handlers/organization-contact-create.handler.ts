import { IOrganizationContact } from '@gauzy/models';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrganizationContactCreateCommand } from '../organization-contact-create.command';
import { OrganizationContactService } from '../../organization-contact.service';

@CommandHandler(OrganizationContactCreateCommand)
export class OrganizationContactCreateHandler
	implements ICommandHandler<OrganizationContactCreateCommand> {
	constructor(
		private readonly organizationContactService: OrganizationContactService
	) {}

	public async execute(
		command: OrganizationContactCreateCommand
	): Promise<IOrganizationContact> {
		const { input } = command;

		return await this.organizationContactService.create(input);
	}
}
