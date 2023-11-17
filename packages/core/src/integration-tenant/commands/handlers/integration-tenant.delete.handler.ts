import { HttpException, HttpStatus } from '@nestjs/common';
import { CommandBus, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IntegrationEnum } from '@gauzy/contracts';
import { GithubInstallationDeleteCommand } from './../../../integration/github/commands';
import { IntegrationTenantService } from '../../integration-tenant.service';
import { IntegrationTenantDeleteCommand } from '../integration-tenant.delete.command';
import { DeleteResult } from 'typeorm';

@CommandHandler(IntegrationTenantDeleteCommand)
export class IntegrationTenantDeleteHandler implements ICommandHandler<IntegrationTenantDeleteCommand> {

    constructor(
        private readonly _commandBus: CommandBus,
        private readonly _integrationTenantService: IntegrationTenantService
    ) { }

    /**
 * Execute the command to delete the integration tenant.
 * @param command - The IntegrationTenantDeleteCommand instance.
 */
    public async execute(command: IntegrationTenantDeleteCommand): Promise<DeleteResult> {
        try {
            // Extract information from the command
            const { id, options } = command;
            const { tenantId, organizationId } = options;

            // Find the integration tenant by ID along with related data
            const integration = await this._integrationTenantService.findOneByIdString(id, {
                where: {
                    tenantId,
                    organizationId,
                },
                relations: {
                    integration: true,
                    settings: true
                }
            });

            // Check the provider type of the integration and perform actions accordingly
            switch (integration.integration.provider) {
                case IntegrationEnum.GITHUB:
                    // Execute a command to delete GitHub installation
                    this._commandBus.execute(
                        new GithubInstallationDeleteCommand(integration)
                    );
                    break;
                // Add cases for other integration providers if needed
                default:
                    // Handle other integration providers if needed
                    break;
            }

            // Delete the integration tenant
            return await this._integrationTenantService.delete(id, {
                where: {
                    tenantId,
                    organizationId,
                }
            });
        } catch (error) {
            // Handle errors and return an appropriate error response
            console.log(`Failed to delete integration tenant: %s`, error.message);
            throw new HttpException(`Failed to delete integration tenant: ${error.message}`, HttpStatus.BAD_REQUEST);
        }
    }
}
