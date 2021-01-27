import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IntegrationSettingCreateCommand } from '..';
import { IntegrationSettingService } from '../../integration-setting.service';
import { IIntegrationSetting } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';

@CommandHandler(IntegrationSettingCreateCommand)
export class IntegrationSettingCreateHandler
	implements ICommandHandler<IntegrationSettingCreateCommand> {
	constructor(
		private readonly integrationSettingService: IntegrationSettingService
	) {}

	public async execute(
		command: IntegrationSettingCreateCommand
	): Promise<IIntegrationSetting> {
		const { input } = command;
		const tenantId = RequestContext.currentTenantId();
		return await this.integrationSettingService.create(
			Object.assign(input, { tenantId })
		);
	}
}
