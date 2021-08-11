import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { OrganizationProjectCreateCommand } from '../organization-project.create.command';
import { OrganizationProjectService } from '../../organization-project.service';
import { IOrganizationProject } from '@gauzy/contracts';

@CommandHandler(OrganizationProjectCreateCommand)
export class OrganizationProjectCreateHandler
	implements ICommandHandler<OrganizationProjectCreateCommand> {
	constructor(
		private readonly organizationProjectService: OrganizationProjectService
	) {}

	public async execute(
		command: OrganizationProjectCreateCommand
	): Promise<IOrganizationProject> {
		return this.organizationProjectService.create(command.input);
	}
}
