import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationSprint } from '@gauzy/contracts';
import { OrganizationSprintService } from '../../organization-sprint.service';
import { OrganizationSprintUpdateCommand } from '../organization-sprint.update.command';

@CommandHandler(OrganizationSprintUpdateCommand)
export class OrganizationSprintUpdateHandler implements ICommandHandler<OrganizationSprintUpdateCommand> {
	constructor(private readonly organizationSprintService: OrganizationSprintService) {}

	public async execute(command: OrganizationSprintUpdateCommand): Promise<IOrganizationSprint> {
		const { id, input } = command;

		// Update the organization sprint using the provided input
		await this.organizationSprintService.update(id, input);

		// Find the updated organization project by ID
		return await this.organizationSprintService.findOneByIdString(id);
	}
}
