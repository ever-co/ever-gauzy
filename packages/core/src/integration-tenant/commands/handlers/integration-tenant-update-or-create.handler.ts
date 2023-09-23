import { forwardRef, Inject } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IntegrationTenantService } from 'integration-tenant/integration-tenant.service';
import { IntegrationTenantUpdateOrCreateCommand } from '../integration-tenant-update-or-create.command';

@CommandHandler(IntegrationTenantUpdateOrCreateCommand)
export class IntegrationTenantUpdateOrCreateHandler implements ICommandHandler<IntegrationTenantUpdateOrCreateCommand> {

	constructor(
		@Inject(forwardRef(() => IntegrationTenantService))
		private readonly _integrationTenantService: IntegrationTenantService
	) { }

	public async execute(
		event: IntegrationTenantUpdateOrCreateCommand
	) {
		const { options, input } = event;
		console.log({ options, input });
	}
}
