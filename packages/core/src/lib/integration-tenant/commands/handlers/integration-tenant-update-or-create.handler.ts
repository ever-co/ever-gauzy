import { Injectable } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IIntegrationTenant } from '@gauzy/contracts';
import { IntegrationTenantService } from '../../integration-tenant.service';
import { IntegrationTenantCreateCommand } from '../integration-tenant.create.command';
import { IntegrationTenantUpdateOrCreateCommand } from '../integration-tenant-update-or-create.command';
import { IntegrationTenantUpdateCommand } from '../integration-tenant.update.command';

@Injectable()
@CommandHandler(IntegrationTenantUpdateOrCreateCommand)
export class IntegrationTenantUpdateOrCreateHandler implements ICommandHandler<IntegrationTenantUpdateOrCreateCommand> {
	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _integrationTenantService: IntegrationTenantService
	) {}

	/**
	 * Execute the IntegrationTenantUpdateOrCreateCommand to update or create an integration tenant.
	 *
	 * @param command - The IntegrationTenantUpdateOrCreateCommand containing the options and input data.
	 * @returns {Promise<IIntegrationTenant>} - A promise that resolves with the updated or newly created integration tenant.
	 */
	public async execute(command: IntegrationTenantUpdateOrCreateCommand): Promise<IIntegrationTenant> {
		const { options, input } = command;

		// Try to find the corresponding integration tenant
		try {
			const integration = await this._integrationTenantService.findOneByWhereOptions(options);

			// Update the corresponding integration tenant with the new input data
			return await this._commandBus.execute(new IntegrationTenantUpdateCommand(integration.id, input));
		} catch (error) {
			// Create a corresponding integration tenant with the new input data
			return await this._commandBus.execute(new IntegrationTenantCreateCommand(input));
		}
	}
}
