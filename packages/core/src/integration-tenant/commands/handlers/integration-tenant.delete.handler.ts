import { HttpException, HttpStatus } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { DeleteResult } from 'typeorm';
import { IntegrationEnum } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { EventBus } from '../../../event-bus/event-bus';
import { IntegrationDeleteEvent } from '../../../event-bus/events';
import { IntegrationTenantService } from '../../integration-tenant.service';
import { IntegrationTenantDeleteCommand } from '../integration-tenant.delete.command';

@CommandHandler(IntegrationTenantDeleteCommand)
export class IntegrationTenantDeleteHandler implements ICommandHandler<IntegrationTenantDeleteCommand> {
	constructor(
		private readonly _integrationTenantService: IntegrationTenantService,
		private readonly _eventBus: EventBus
	) {}

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
				where: { tenantId, organizationId },
				relations: { integration: true, settings: true }
			});

			// Check the provider type of the integration and perform actions accordingly
			switch (integration.integration.provider) {
				case IntegrationEnum.GITHUB:
					// Publish the integration delete event
					const ctx = RequestContext.currentRequestContext();
					const event = new IntegrationDeleteEvent(ctx, integration);
					await this._eventBus.publish(event);
					break;
				// Add cases for other integration providers if needed
				default:
					// Handle other integration providers if needed
					break;
			}

			// Delete the integration tenant
			return await this._integrationTenantService.delete(id, {
				where: { tenantId, organizationId }
			});
		} catch (error) {
			// Handle errors and return an appropriate error response
			console.log(`Failed to delete integration tenant: %s`, error.message);
			throw new HttpException(`Failed to delete integration tenant: ${error.message}`, HttpStatus.BAD_REQUEST);
		}
	}
}
