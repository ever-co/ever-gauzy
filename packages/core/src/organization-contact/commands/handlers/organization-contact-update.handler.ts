import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '@nestjs/common';
import { IOrganizationContact } from '@gauzy/contracts';
import { OrganizationContactUpdateCommand } from '../organization-contact-update.command';
import { OrganizationContactService } from '../../organization-contact.service';

@CommandHandler(OrganizationContactUpdateCommand)
export class OrganizationContactUpdateHandler implements ICommandHandler<OrganizationContactUpdateCommand> {

	constructor(
		private readonly _organizationContactService: OrganizationContactService
	) { }

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
