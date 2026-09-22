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

		// Scope to the request's tenant when there is one. Webhook callers (e.g. the GitHub Probot
		// hooks) run without a request context: their lookup is keyed on the installation id and is
		// legitimately cross-tenant, so a null tenantId must not be written into the where (it used to
		// be dropped by TypeORM; now null means IS NULL and would match nothing).
		if (input.where instanceof Object && tenantId) {
			input.where = Object.assign(input.where, { tenantId });
		}

		const { record } = await this.integrationSettingService.findOneOrFailByOptions(input);
		return record;
	}
}
