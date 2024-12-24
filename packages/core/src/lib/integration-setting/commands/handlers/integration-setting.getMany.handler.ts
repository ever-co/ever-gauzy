import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IIntegrationSetting } from '@gauzy/contracts';
import { IntegrationSettingGetManyCommand } from './../integration-setting.getMany.command';
import { RequestContext } from '../../../core/context';
import { IntegrationSettingService } from '../../integration-setting.service';

@CommandHandler(IntegrationSettingGetManyCommand)
export class IntegrationSettingGetManyHandler implements ICommandHandler<IntegrationSettingGetManyCommand> {

	constructor(
		private readonly _integrationSettingService: IntegrationSettingService
	) { }

	/**
	 * Executes a command to retrieve multiple integration settings.
	 *
	 * @param command - The command to execute for retrieving integration settings.
	 * @returns A Promise that resolves to an array of integration settings.
	 */
	public async execute(command: IntegrationSettingGetManyCommand): Promise<IIntegrationSetting[]> {
		// Extract the input parameters from the command
		const { input } = command;

		// Get the current tenant ID from the RequestContext
		const tenantId = RequestContext.currentTenantId();

		// Append the tenant ID to the 'where' clause if it's an object
		if (input.where instanceof Object) {
			input.where = Object.assign(input.where, { tenantId });
		}

		// Retrieve the integration settings
		const { items } = await this._integrationSettingService.findAll(input);

		return items;
	}
}
