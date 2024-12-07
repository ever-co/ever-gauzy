import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IIntegrationSetting } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { IntegrationSettingGetCommand } from './../integration-setting.get.command';
import { IntegrationSettingService } from '../../integration-setting.service';

@CommandHandler(IntegrationSettingGetCommand)
export class IntegrationSettingGetHandler implements ICommandHandler<IntegrationSettingGetCommand> {
	constructor(private readonly integrationSettingService: IntegrationSettingService) {}

	/**
	 * Executes the 'IntegrationSettingGetCommand' to retrieve an integration setting.
	 *
	 * @param command - The 'IntegrationSettingGetCommand' containing the input for the query.
	 * @returns A promise that resolves to an 'IIntegrationSetting' object.
	 */
	public async execute(command: IntegrationSettingGetCommand): Promise<IIntegrationSetting> {
		const { input } = command;
		const tenantId = RequestContext.currentTenantId();

		if (input.where instanceof Object) {
			input.where = Object.assign(input.where, { tenantId });
		}

		const { record } = await this.integrationSettingService.findOneOrFailByOptions(input);
		return record;
	}
}
