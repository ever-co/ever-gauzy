import { HttpException, HttpStatus } from '@nestjs/common';
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
            // Handle errors and return an appropriate error response
            console.log(`Failed to update integration tenant: %s`, error.message);
            throw new HttpException(`Failed to update integration tenant: ${error.message}`, HttpStatus.BAD_REQUEST);
        }
    }
}
