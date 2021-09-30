import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IIntegrationEntitySetting } from '@gauzy/contracts';
import { IntegrationEntitySettingUpdateCommand } from './../integration-entity-setting.update.command';
import { IntegrationEntitySettingService } from './../../integration-entity-setting.service';
import { IntegrationTenantService } from './../../../integration-tenant/integration-tenant.service';

@CommandHandler(IntegrationEntitySettingUpdateCommand)
export class IntegrationEntitySettingUpdateHandler
	implements ICommandHandler<IntegrationEntitySettingUpdateCommand> {
	
	constructor(
		private readonly _integrationEntitySettingService: IntegrationEntitySettingService,
		private readonly _integrationTenantService: IntegrationTenantService
	) {}

	public async execute(
		command: IntegrationEntitySettingUpdateCommand
	): Promise<IIntegrationEntitySetting[]> {
		const { input, integrationId } = command;
		
		await this._integrationTenantService.findOneByIdString(integrationId);
		return await this._integrationEntitySettingService.bulkUpdateOrCreate(input);
	}
}
