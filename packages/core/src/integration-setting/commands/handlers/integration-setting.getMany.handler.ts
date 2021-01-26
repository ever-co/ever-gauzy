import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IntegrationSettingGetManyCommand } from '..';
import { IntegrationSettingService } from '../../integration-setting.service';
import { IIntegrationSetting } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';

@CommandHandler(IntegrationSettingGetManyCommand)
export class IntegrationSettingGetManyHandler
	implements ICommandHandler<IntegrationSettingGetManyCommand> {
	constructor(private readonly isService: IntegrationSettingService) {}

	public async execute(
		command: IntegrationSettingGetManyCommand
	): Promise<IIntegrationSetting[]> {
		const { input } = command;
		const tenantId = RequestContext.currentTenantId();
		if (input.where instanceof Object) {
			input.where = Object.assign(input.where, { tenantId });
		}
		const { items } = await this.isService.findAll(input);
		return items;
	}
}
