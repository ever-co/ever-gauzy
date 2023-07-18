import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationTaskSetting } from '@gauzy/contracts';
import { OrganizationTaskSettingService } from '../../organization-task-setting.service';
import { OrganizationTaskSettingUpdateCommand } from '../organization-task-setting.update.command';

@CommandHandler(OrganizationTaskSettingUpdateCommand)
export class OrganizationTaskSettingUpdateHandler implements ICommandHandler<OrganizationTaskSettingUpdateCommand> {
	constructor(
		private readonly _organizationTaskSettingService: OrganizationTaskSettingService
	) { }

	public async execute(
		command: OrganizationTaskSettingUpdateCommand
	): Promise<IOrganizationTaskSetting> {
		const { id, input } = command;
		await this._organizationTaskSettingService.update(id, input);

		return await this._organizationTaskSettingService.findOneByIdString(id);
	}
}
