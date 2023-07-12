import { NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationTaskSetting } from '@gauzy/contracts';
import { OrganizationTaskSettingService } from '../../organization-task-setting.service';
import { OrganizationTaskSettingUpdateCommand } from '../organization-task-setting.update.command';

@CommandHandler(OrganizationTaskSettingUpdateCommand)
export class OrganizationTaskSettingUpdateHandler
	implements ICommandHandler<OrganizationTaskSettingUpdateCommand>
{
	constructor(
		private readonly organizationTaskSettingService: OrganizationTaskSettingService
	) {}

	public async execute(
		command: OrganizationTaskSettingUpdateCommand
	): Promise<IOrganizationTaskSetting> {
		const { id, input } = command;
		const record =
			await this.organizationTaskSettingService.findOneByIdString(id);
		if (!record) {
			throw new NotFoundException(`The requested record was not found`);
		}
		await this.organizationTaskSettingService.update(
			{ id },
			{
				...input,
			}
		);

		return await this.organizationTaskSettingService.findOneByIdString(id);
	}
}
