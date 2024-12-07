import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrganizationSprintCreateCommand } from '../organization-sprint.create.command';
import { OrganizationSprintService } from '../../organization-sprint.service';
import { IOrganizationSprint } from '@gauzy/contracts';

@CommandHandler(OrganizationSprintCreateCommand)
export class OrganizationSprintCreateHandler implements ICommandHandler<OrganizationSprintCreateCommand> {
	constructor(private readonly _organizationSprintService: OrganizationSprintService) {}

	/**
	 *  Executes the creation of an organization sprint
	 * @param {OrganizationSprintCreateCommand} command The command containing the input data for creating the organization sprint.
	 * @returns {Promise<IOrganizationSprint>} - Returns a promise that resolves with the created organization sprint.
	 * @throws {BadRequestException} - Throws a BadRequestException if an error occurs during the creation process.
	 * @memberof OrganizationSprintCreateHandler
	 */
	public async execute(command: OrganizationSprintCreateCommand): Promise<IOrganizationSprint> {
		// Destructure the input data from command
		const { input } = command;

		// Create and return organization sprint
		return await this._organizationSprintService.create(input);
	}
}
