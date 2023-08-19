import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IntegrationTenantUpdateCommand } from '../../commands';
import { IntegrationTenantService } from '../../integration-tenant.service';
import { IntegrationTenant } from '../../integration-tenant.entity';

@CommandHandler(IntegrationTenantUpdateCommand)
export class IntegrationTenantUpdateHandler implements ICommandHandler<IntegrationTenantUpdateCommand> {

    constructor(
        private readonly _integrationTenantService: IntegrationTenantService
    ) { }

    public async execute(
        command: IntegrationTenantUpdateCommand
    ): Promise<IntegrationTenant> {
        const { id, input } = command;
        return await this._integrationTenantService.create({
            ...input,
            id
        });
    }
}
