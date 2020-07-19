import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IntegrationTenantGetCommand } from '../../../integration-tenant/commands/integration-tenant.get.command';
import { IntegrationTenantService } from '../../../integration-tenant/integration-tenant.service';
import { IntegrationTenant } from '../../../integration-tenant/integration-tenant.entity';

@CommandHandler(IntegrationTenantGetCommand)
export class IntegrationTenantGetHandler
	implements ICommandHandler<IntegrationTenantGetCommand> {
	constructor(private _integrationTenantService: IntegrationTenantService) {}

	public async execute(
		command: IntegrationTenantGetCommand
	): Promise<IntegrationTenant> {
		const { input } = command;
		return await this._integrationTenantService.findOne(input);
	}
}
