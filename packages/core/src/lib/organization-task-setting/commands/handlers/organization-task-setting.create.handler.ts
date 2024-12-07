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

	/**
	 * The execution of a command to create organization task settings.
	 * This method tries to create a new organization task setting using the provided command and inputs.
	 *
	 * @param command An instance of OrganizationTaskSettingCreateCommand containing the necessary information to create an organization task setting.
	 * @returns A promise that resolves to an instance of IOrganizationTaskSetting, representing the newly created organization task setting.
	 */
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
