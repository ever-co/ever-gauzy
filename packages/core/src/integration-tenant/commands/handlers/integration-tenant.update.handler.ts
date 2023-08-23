import { BadRequestException } from '@nestjs/common';
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
        try {
            const { id, input } = command;

            await this._integrationTenantService.update(id, input);
            return await this._integrationTenantService.findOneByIdString(id);
        } catch (error) {
            throw new BadRequestException(error);
        }
    }
}
