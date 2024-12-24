import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { IIntegrationMap, IntegrationEntity } from '@gauzy/contracts';
import { RequestContext } from './../../../core/context';
import { IntegrationMapSyncProjectCommand } from './../integration-map.sync-project.command';
import { IntegrationMapSyncEntityCommand } from './../integration-map.sync-entity.command';
import { IntegrationMapService } from '../../integration-map.service';
import {
	OrganizationProjectCreateCommand,
	OrganizationProjectUpdateCommand
} from '../../../organization-project/commands';

@CommandHandler(IntegrationMapSyncProjectCommand)
export class IntegrationMapSyncProjectHandler implements ICommandHandler<IntegrationMapSyncProjectCommand> {
	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _integrationMapService: IntegrationMapService
	) {}

	/**
	 * Third party organization project integration and mapping.
	 *
	 * @param {IntegrationMapSyncProjectCommand} command - The command containing input data for integrating and mapping the project.
	 * @returns {Promise<IIntegrationMap>} - Returns a promise that resolves with the mapped project integration data.
	 */
	public async execute(command: IntegrationMapSyncProjectCommand): Promise<IIntegrationMap> {
		const { input } = command;
		const { integrationId, sourceId, organizationId, entity } = input;
		const tenantId = RequestContext.currentTenantId();

		try {
			// Attempt to find an existing project map
			const projectMap = await this._integrationMapService.findOneByWhereOptions({
				entity: IntegrationEntity.PROJECT,
				sourceId,
				integrationId,
				organizationId,
				tenantId
			});

			// Update the project if it exists
			await this._commandBus.execute(new OrganizationProjectUpdateCommand(projectMap.gauzyId, entity));
			return projectMap;
		} catch (error) {
			// If project map is not found, create a new project and map it
			const project = await this._commandBus.execute(new OrganizationProjectCreateCommand(entity));

			return this._commandBus.execute(
				new IntegrationMapSyncEntityCommand({
					gauzyId: project.id,
					integrationId,
					sourceId,
					entity: IntegrationEntity.PROJECT,
					organizationId
				})
			);
		}
	}
}
