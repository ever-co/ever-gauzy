import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationProject } from '@gauzy/contracts';
import { OrganizationProjectUpdateCommand } from '../organization-project-update.command';
import { OrganizationProjectService } from '../../organization-project.service';

@CommandHandler(OrganizationProjectUpdateCommand)
export class OrganizationProjectUpdateHandler implements ICommandHandler<OrganizationProjectUpdateCommand> {
	constructor(private readonly _organizationProjectService: OrganizationProjectService) {}

	/**
	 * Executes the update of an organization project using the provided command data.
	 *
	 * @param {OrganizationProjectUpdateCommand} command - The command containing the input data for updating the organization project.
	 * @returns {Promise<IOrganizationProject>} - Returns a promise that resolves with the updated organization project.
	 *
	 * @throws {BadRequestException} - Throws a BadRequestException if an error occurs during the update process.
	 */
	public async execute(command: OrganizationProjectUpdateCommand): Promise<IOrganizationProject> {
		const { id, input } = command;

		// Update the organization project using the provided input
		await this._organizationProjectService.update(id, input);

		// Find the updated organization project by ID
		return await this._organizationProjectService.findOneByIdString(id);
	}
}
