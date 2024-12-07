import { HttpException, HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IIntegrationSetting } from '@gauzy/contracts';
import { IntegrationSettingUpdateCommand } from '../integration-setting.update.command';
import { IntegrationSettingService } from '../../integration-setting.service';

@CommandHandler(IntegrationSettingUpdateCommand)
export class IntegrationSettingUpdateHandler implements ICommandHandler<IntegrationSettingUpdateCommand> {
	constructor(
		private readonly _integrationSettingService: IntegrationSettingService
	) { }

	/**
	 * Execute the IntegrationSettingUpdateCommand to bulk update or create integration settings.
	 *
	 * @param command - The IntegrationSettingUpdateCommand containing the input settings and integration ID.
	 * @returns {Promise<IIntegrationSetting[]>} - A promise that resolves with an array of updated or created integration settings.
	 */
	public async execute(command: IntegrationSettingUpdateCommand): Promise<IIntegrationSetting[]> {
		try {
			const { input, integrationId } = command;

			// Call the service method to bulk update or create integration settings
			return await this._integrationSettingService.bulkUpdateOrCreate(integrationId, input);
		} catch (error) {
			// Handle errors and return an appropriate error response
			console.log(`Failed to update integration settings: ${error.message}`);
			throw new HttpException(`Failed to update integration settings: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}
}
