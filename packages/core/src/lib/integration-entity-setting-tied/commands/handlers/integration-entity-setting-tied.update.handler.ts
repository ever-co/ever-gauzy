import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IntegrationEntitySettingTiedService } from './../../integration-entity-setting-tied.service';
import { IntegrationEntitySettingTiedUpdateCommand } from '../integration-entity-setting-tied.update.command';
import { IntegrationTenantService } from './../../../integration-tenant/integration-tenant.service';

@CommandHandler(IntegrationEntitySettingTiedUpdateCommand)
export class IntegrationEntitySettingTiedUpdateHandler
	implements ICommandHandler<IntegrationEntitySettingTiedUpdateCommand> {

	constructor(
		private readonly _integrationEntitySettingTiedService: IntegrationEntitySettingTiedService,
		private readonly _integrationTenantService: IntegrationTenantService
	) { }

	public async execute(
		command: IntegrationEntitySettingTiedUpdateCommand
	): Promise<any> {
		const { input, integrationId } = command;

		await this._integrationTenantService.findOneByIdString(integrationId);
		return await this._integrationEntitySettingTiedService.bulkUpdateOrCreate(input);
	}
}
