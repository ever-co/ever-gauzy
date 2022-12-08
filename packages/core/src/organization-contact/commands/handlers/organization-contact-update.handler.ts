import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { IOrganizationContact } from '@gauzy/contracts';
import { OrganizationContactUpdateCommand } from '../organization-contact-update.command';
import { OrganizationContactService } from '../../organization-contact.service';

@CommandHandler(OrganizationContactUpdateCommand)
export class OrganizationContactUpdateHandler implements ICommandHandler<OrganizationContactUpdateCommand> {

	constructor(
		private readonly organizationContactService: OrganizationContactService
	) {}

	public async execute(
		command: OrganizationContactUpdateCommand
	): Promise<IOrganizationContact> {
		try {
			const { id, input } = command;
			//We are using create here because create calls the method save()
			//We need save() to save ManyToMany relations
			return await this.organizationContactService.create({
				id,
				...input
			});
		} catch (error) {
			throw new BadRequestException(error);
		}
	}
}