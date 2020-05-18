import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IntegrationTenantCreateCommand } from '../../../integration-tenant/commands/integration-tenant.create.command';
import { IntegrationTenantService } from '../../../integration-tenant/integration-tenant.service';
import { IntegrationTenant } from '../../../integration-tenant/integration-tenant.entity';
import { RequestContext } from '../../../core/context';

@CommandHandler(IntegrationTenantCreateCommand)
export class IntegrationTenantCreateHandler
	implements ICommandHandler<IntegrationTenantCreateCommand> {
	constructor(private _integrationTenantService: IntegrationTenantService) {}

	public async execute(
		command: IntegrationTenantCreateCommand
	): Promise<IntegrationTenant> {
		const { input } = command;
		const user = RequestContext.currentUser();
		const { tenantId } = user;

		return await this._integrationTenantService.addIntegration({
			...input,
			tenantId
		});
	}
}
