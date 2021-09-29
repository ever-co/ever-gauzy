import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IntegrationSettingGetCommand } from '..';
import { IntegrationSettingService } from '../../integration-setting.service';
import { IntegrationSetting } from '../../integration-setting.entity';
import { RequestContext } from '../../../core/context';

@CommandHandler(IntegrationSettingGetCommand)
export class IntegrationSettingGetHandler
	implements ICommandHandler<IntegrationSettingGetCommand> {
	constructor(
		private readonly integrationSettingService: IntegrationSettingService
	) {}

	public async execute(
		command: IntegrationSettingGetCommand
	): Promise<IntegrationSetting> {
		const { input } = command;
		const tenantId = RequestContext.currentTenantId();
		if (input.where instanceof Object) {
			input.where = Object.assign(input.where, { tenantId });
		}
		const { record } = await this.integrationSettingService.findOneOrFailByOptions(
			input
		);
		return record;
	}
}
