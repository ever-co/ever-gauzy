import { BadRequestException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationTaskSetting } from '@gauzy/contracts';
import { OrganizationTaskSettingService } from '../../organization-task-setting.service';
import { OrganizationTaskSettingCreateCommand } from '../organization-task-setting.create.command';

@CommandHandler(OrganizationTaskSettingCreateCommand)
export class OrganizationTaskSettingCreateHandler implements ICommandHandler<OrganizationTaskSettingCreateCommand> {

	constructor(
		private readonly _organizationTaskSettingService: OrganizationTaskSettingService
	) { }

	public async execute(
		command: OrganizationTaskSettingCreateCommand
	): Promise<IOrganizationTaskSetting> {
		try {
			const { input } = command;
			return await this._organizationTaskSettingService.create(input);
		} catch (error) {
			console.log('Error while creating organization task setting', error);
			throw new BadRequestException(error);
		}
	}
}
