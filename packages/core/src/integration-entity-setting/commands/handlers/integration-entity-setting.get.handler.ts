import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IIntegrationEntitySetting, IPagination } from '@gauzy/contracts';
import { IntegrationEntitySettingGetCommand } from './../integration-entity-setting.get.command';
import { IntegrationEntitySettingService } from './../../integration-entity-setting.service';

@CommandHandler(IntegrationEntitySettingGetCommand)
export class IntegrationEntitySettingGetHandler implements ICommandHandler<IntegrationEntitySettingGetCommand> {

	constructor(
		private readonly _integrationEntitySettingService: IntegrationEntitySettingService
	) { }

	/**
	 * Execute the get command for integration entity settings.
	 *
	 * @param command - The IntegrationEntitySettingGetCommand containing the integrationId.
	 * @returns A promise resolving to paginated integration entity settings.
	 */
	public async execute(command: IntegrationEntitySettingGetCommand): Promise<IPagination<IIntegrationEntitySetting>> {
		const { integrationId } = command;
		return await this._integrationEntitySettingService.getIntegrationEntitySettings(integrationId);
	}
}
