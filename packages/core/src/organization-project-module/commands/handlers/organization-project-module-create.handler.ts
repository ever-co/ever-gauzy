import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationProjectModule } from '@gauzy/contracts';
import { OrganizationProjectModuleCreateCommand } from '../organization-project-module-create.command';
import { OrganizationProjectModuleService } from 'organization-project-module/organization-project-module.service';

@CommandHandler(OrganizationProjectModuleCreateCommand)
export class OrganizationProjectModuleCreateHandler implements ICommandHandler<OrganizationProjectModuleCreateCommand> {
	constructor(private readonly organizationProjectModuleService: OrganizationProjectModuleService) {}

	/**
	 * @description Executes the OrganizationProjectModuleCreateCommand
	 * @param {OrganizationProjectModuleCreateCommand} command  The command containing the Module create data.
	 * @returns The created module.
	 * @memberof OrganizationProjectModuleCreateHandler
	 */
	public async execute(command: OrganizationProjectModuleCreateCommand): Promise<IOrganizationProjectModule> {
		const { input } = command;
		return await this.organizationProjectModuleService.create(input);
	}
}
