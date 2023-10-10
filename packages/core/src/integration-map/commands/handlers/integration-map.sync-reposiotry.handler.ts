import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IIntegrationMap, IntegrationEntity } from '@gauzy/contracts';
import { RequestContext } from 'core/context';
import { IntegrationMapSyncRepositoryCommand } from '../integration-map.sync-repository.command';
import { IntegrationMapService } from '../../integration-map.service';

@CommandHandler(IntegrationMapSyncRepositoryCommand)
export class IntegrationMapSyncRepositoryHandler implements ICommandHandler<IntegrationMapSyncRepositoryCommand> {

	constructor(
		private readonly _integrationMapService: IntegrationMapService
	) { }

	/**
	 * Execute the IntegrationMapSyncRepositoryCommand to integrate and map a third-party GitHub repository.
	 *
	 * @param command - The command containing integration and mapping data.
	 * @returns The integrated and mapped IntegrationMap or throws an error if unsuccessful.
	 */
	public async execute(command: IntegrationMapSyncRepositoryCommand): Promise<IIntegrationMap> {
		const { input } = command;
		const { repository, organizationId, gauzyId, integrationId } = input;
		const tenantId = RequestContext.currentTenantId() || input.tenantId;

		try {
			// Check if an integration map for the given repository and integration exists
			const integrationMap = await this._integrationMapService.findOneByWhereOptions({
				organizationId,
				tenantId,
				integrationId,
				entity: IntegrationEntity.PROJECT,
				gauzyId,
				isActive: true,
				isArchived: false
			});

			if (integrationMap) {
				// Update the existing integration map
				await this._integrationMapService.update(integrationMap.id, {
					sourceId: repository.id,
					isActive: true,
					isArchived: false
				});

				// Return the updated integration map
				return await this._integrationMapService.findOneByIdString(integrationMap.id);
			}
		} catch (error) {
			// Handle errors gracefully
			console.error('Error while syncing GitHub integration repository:', error.message);

			// Create a new integration map if it doesn't exist
			return await this._integrationMapService.create({
				entity: IntegrationEntity.PROJECT,
				sourceId: repository.id,
				gauzyId,
				integrationId,
				tenantId,
				organizationId,
				isActive: true,
				isArchived: false
			});
		}
	}
}
