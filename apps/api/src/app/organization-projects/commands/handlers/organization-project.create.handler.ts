import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrganizationProjectCreateCommand } from '../organization-project.create.command';
import { OrganizationProjectsService } from '../../organization-projects.service';
import { OrganizationProjects } from '@gauzy/models';

@CommandHandler(OrganizationProjectCreateCommand)
export class OrganizationProjectCreateHandler
	implements ICommandHandler<OrganizationProjectCreateCommand> {
	constructor(private readonly ops: OrganizationProjectsService) {}

	public async execute(
		command: OrganizationProjectCreateCommand
	): Promise<OrganizationProjects> {
		return this.ops.create(command.input);
	}
}
