import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationProjectTasksSettings } from '@gauzy/contracts';
import { OrganizationProjectTasksSettingsService } from '../../organization-project-tasks-settings.service';
import { OrganizationProjectTasksSettingsUpdateCommand } from '../organization-project-tasks-settings.update.command';

@CommandHandler(OrganizationProjectTasksSettingsUpdateCommand)
export class OrganizationProjectTasksSettingsUpdateHandler
	implements ICommandHandler<OrganizationProjectTasksSettingsUpdateCommand>
{
	constructor(private readonly organizationProjectTasksSettingsService: OrganizationProjectTasksSettingsService) {}

	public async execute(
		command: OrganizationProjectTasksSettingsUpdateCommand
	): Promise<IOrganizationProjectTasksSettings> {
		const { id, input } = command;
		const record = await this.organizationProjectTasksSettingsService.findOneByIdString(id);
		if (!record) {
			throw new NotFoundException(`The requested record was not found`);
		}
		//This will call save() with the id so that task[] also get saved accordingly
		return this.organizationProjectTasksSettingsService.create({
			id,
			...input
		});
	}
}
