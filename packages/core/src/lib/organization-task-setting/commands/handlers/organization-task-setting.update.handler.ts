import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IOrganizationTaskSetting } from '@gauzy/contracts';
import { OrganizationTaskSettingService } from '../../organization-task-setting.service';
import { OrganizationTaskSettingUpdateCommand } from '../organization-task-setting.update.command';

@CommandHandler(OrganizationTaskSettingUpdateCommand)
export class OrganizationTaskSettingUpdateHandler implements ICommandHandler<OrganizationTaskSettingUpdateCommand> {
	constructor(
		private readonly _organizationTaskSettingService: OrganizationTaskSettingService
	) { }

	/**
	 * Executes the update operation for organization task settings.
	 *
	 * @param command - The command containing the identifier and updated settings.
	 * @returns A Promise resolving to the updated organization task settings.
	 * @throws Throws an error if the update operation fails.
	 */
	public async execute(
		command: OrganizationTaskSettingUpdateCommand
	): Promise<IOrganizationTaskSetting> {
		try {
			// Destructure the command to obtain the identifier and updated settings.
			const { id, input } = command;

			// Update the organization task settings using the provided service.
			await this._organizationTaskSettingService.update(id, input);

			// Retrieve and return the updated organization task settings.
			return await this._organizationTaskSettingService.findOneByIdString(id);
		} catch (error) {
			// Handle errors during the update operation.
			console.error('Error during organization task settings update:', error);
		}
	}
}
