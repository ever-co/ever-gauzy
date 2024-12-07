import { HttpException, HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IntegrationTenantCreateCommand } from '../../commands/integration-tenant.create.command';
import { IntegrationTenantService } from '../../integration-tenant.service';
import { IntegrationTenant } from '../../integration-tenant.entity';

@CommandHandler(IntegrationTenantCreateCommand)
export class IntegrationTenantCreateHandler implements ICommandHandler<IntegrationTenantCreateCommand> {
	constructor(private readonly _integrationTenantService: IntegrationTenantService) {}

	public async execute(command: IntegrationTenantCreateCommand): Promise<IntegrationTenant> {
		try {
			const { input } = command;
			return await this._integrationTenantService.create(input);
		} catch (error) {
			// Handle errors and return an appropriate error response
			console.log(`Failed to create integration tenant: %s`, error.message);
			throw new HttpException(`Failed to create integration tenant: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}
}
