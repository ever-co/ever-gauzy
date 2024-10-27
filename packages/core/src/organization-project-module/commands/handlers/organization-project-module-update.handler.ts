import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UpdateResult } from 'typeorm';
import { IOrganizationProjectModule } from '@gauzy/contracts';
import { OrganizationProjectModuleUpdateCommand } from '../organization-project-module-update.command';
import { OrganizationProjectModuleService } from 'organization-project-module/organization-project-module.service';

@CommandHandler(OrganizationProjectModuleUpdateCommand)
export class OrganizationProjectModuleUpdateHandler implements ICommandHandler<OrganizationProjectModuleUpdateCommand> {
	constructor(private readonly organizationProjectModuleService: OrganizationProjectModuleService) {}

	/**
	 * @description Executes the OrganizationProjectModuleUpdateCommand
	 * @param {OrganizationProjectModuleUpdateCommand} command  The command containing the Module ID and update data.
	 * @returns The updated module.
	 * @memberof OrganizationProjectModuleUpdateHandler
	 */
	public async execute(
		command: OrganizationProjectModuleUpdateCommand
	): Promise<IOrganizationProjectModule | UpdateResult> {
		const { id, input } = command;
		return await this.organizationProjectModuleService.update(id, input);
	}
}
