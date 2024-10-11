import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { IOrganizationContact } from '@gauzy/contracts';
import { OrganizationContactUpdateCommand } from '../organization-contact-update.command';
import { OrganizationContactService } from '../../organization-contact.service';
import { ContactService } from '../../../contact/contact.service';
import { isNotEmpty } from '@gauzy/common';

@CommandHandler(OrganizationContactUpdateCommand)
export class OrganizationContactUpdateHandler implements ICommandHandler<OrganizationContactUpdateCommand> {
	constructor(
		private readonly _organizationContactService: OrganizationContactService,
		private readonly _contactService: ContactService
	) {}

	/**
	 * Updates an organization contact based on a given command and retrieves the updated contact.
	 *
	 * @param command Contains the ID and new data for updating the organization contact.
	 * @returns A Promise resolving to the updated organization contact.
	 * @throws BadRequestException for any errors during the update process.
	 */
	public async execute(command: OrganizationContactUpdateCommand): Promise<IOrganizationContact> {
		try {
			const { id, input } = command;

			// Destructure organizationId from the input, and get tenantId either from the current RequestContext or from the input.
			let { organizationId } = input;

			// Create/Update contact details of created organization
			try {
				input.contact = await this._contactService.create({
					...input.contact,
					organization: { id: organizationId }
				});
			} catch (error) {
				console.log(
					'Error occurred during creation of contact details or creating the organization contact:',
					error
				);
			}

			if (isNotEmpty(input.projects)) {
				input.projects.forEach((project) => {
					delete project.members;
				});
			}

			// Update the organization contact using the provided ID and input data.
			await this._organizationContactService.create({
				...input,
				id
			});

			// Retrieve and return the updated organization contact.
			return this._organizationContactService.findOneByIdString(id);
		} catch (error) {
			// Re-throw the error as a BadRequestException.
			throw new BadRequestException(error);
		}
	}
}
