import { HttpException, HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IntegrationTenantGetCommand } from '../../../integration-tenant/commands/integration-tenant.get.command';
import { IntegrationTenantService } from '../../../integration-tenant/integration-tenant.service';
import { IntegrationTenant } from '../../../integration-tenant/integration-tenant.entity';

@CommandHandler(IntegrationTenantGetCommand)
export class IntegrationTenantGetHandler implements ICommandHandler<IntegrationTenantGetCommand> {
	constructor(private readonly _integrationTenantService: IntegrationTenantService) {}

	public async execute(command: IntegrationTenantGetCommand): Promise<IntegrationTenant> {
		try {
			const { input } = command;
			return await this._integrationTenantService.findOneByOptions(input);
		} catch (error) {
			// Handle errors and return an appropriate error response
			throw new HttpException(
				`Failed to get integration tenant: ${error.message}`,
				HttpStatus.INTERNAL_SERVER_ERROR
			);
		}
	}
}
