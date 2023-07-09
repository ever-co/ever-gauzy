import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationTasksSettings } from '@gauzy/contracts';
import { OrganizationTasksSettingsService } from '../../organization-tasks-settings.service';
import { OrganizationTasksSettingsUpdateCommand } from '../organization-tasks-settings.update.command';

@CommandHandler(OrganizationTasksSettingsUpdateCommand)
export class OrganizationTasksSettingsUpdateHandler implements ICommandHandler<OrganizationTasksSettingsUpdateCommand> {
	constructor(private readonly organizationTasksSettingsService: OrganizationTasksSettingsService) {}

	public async execute(command: OrganizationTasksSettingsUpdateCommand): Promise<IOrganizationTasksSettings> {
		const { id, input } = command;
		const record = await this.organizationTasksSettingsService.findOneByIdString(id);
		if (!record) {
			throw new NotFoundException(`The requested record was not found`);
		}
		//This will call save() with the id so that task[] also get saved accordingly
		return this.organizationTasksSettingsService.create({
			id,
			...input
		});
	}
}
