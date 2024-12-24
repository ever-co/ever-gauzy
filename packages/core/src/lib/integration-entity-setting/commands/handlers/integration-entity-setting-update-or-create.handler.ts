import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IIntegrationEntitySetting } from '@gauzy/contracts';
import { IntegrationEntitySettingUpdateOrCreateCommand } from '../integration-entity-setting-update-or-create.command';
import { IntegrationEntitySettingService } from '../../integration-entity-setting.service';
import { IntegrationTenantService } from '../../../integration-tenant/integration-tenant.service';

@CommandHandler(IntegrationEntitySettingUpdateOrCreateCommand)
export class IntegrationEntitySettingUpdateOrCreateHandler implements ICommandHandler<IntegrationEntitySettingUpdateOrCreateCommand> {

	constructor(
		private readonly _integrationEntitySettingService: IntegrationEntitySettingService,
		private readonly _integrationTenantService: IntegrationTenantService
	) { }

	/**
	 * Execute the update command for integration entity settings.
	 *
	 * @param command - The IntegrationEntitySettingUpdateOrCreateCommand containing the input and integrationId.
	 * @returns A promise resolving to an array of updated or created integration entity settings.
	 */
	public async execute(command: IntegrationEntitySettingUpdateOrCreateCommand): Promise<IIntegrationEntitySetting[]> {
		const { input, integrationId } = command;

		await this._integrationTenantService.findOneByIdString(integrationId);
		return await this._integrationEntitySettingService.bulkUpdateOrCreate(input);
	}
}
