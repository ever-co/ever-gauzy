import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { IntegrationEntity } from '@gauzy/contracts';
import { RequestContext } from './../../../core/context';
import { IntegrationMapSyncOrganizationCommand } from './../integration-map.sync-organization.command';
import { IntegrationMapSyncEntityCommand } from './../integration-map.sync-entity.command';
import { IntegrationMapService } from '../../integration-map.service';
import { OrganizationCreateCommand, OrganizationUpdateCommand } from './../../../organization/commands';
import { nullIfNotFound } from './null-if-not-found';

@CommandHandler(IntegrationMapSyncOrganizationCommand)
export class IntegrationMapSyncOrganizationHandler
	implements ICommandHandler<IntegrationMapSyncOrganizationCommand> {

	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _integrationMapService: IntegrationMapService
	) { }

	/**
	 * Third party organization integrated and mapped
	 *
	 * @param command
	 * @returns
	 */
	public async execute(
		command: IntegrationMapSyncOrganizationCommand
	) {
		const { input } = command;
		const { integrationId, sourceId, organizationId, entity } = input;
		const tenantId = RequestContext.currentTenantId();

		// Only a missing map means the organization is new. Errors from the update below must reach the caller:
		// they used to fall into the "no map" branch and create a second organization and map for the same source id.
		const organizationMap = await this._integrationMapService
			.findOneByWhereOptions({
				entity: IntegrationEntity.ORGANIZATION,
				sourceId,
				integrationId,
				organizationId,
				tenantId
			})
			.catch(nullIfNotFound);

		if (!organizationMap) {
			const organization = await this._commandBus.execute(
				new OrganizationCreateCommand(entity)
			);
			return await this._commandBus.execute(
				new IntegrationMapSyncEntityCommand({
					gauzyId: organization.id,
					integrationId,
					sourceId,
					entity: IntegrationEntity.ORGANIZATION,
					organizationId
				})
			);
		}

		// Update the mapped organization; its update errors reach the caller
		const updated = await this._commandBus
			.execute(new OrganizationUpdateCommand(organizationMap.gauzyId, entity))
			.catch(nullIfNotFound);
		if (updated) {
			return organizationMap;
		}

		// The mapped organization was deleted here: create it again and point the EXISTING map at it
		const organization = await this._commandBus.execute(new OrganizationCreateCommand(entity));
		return await this._commandBus.execute(
			new IntegrationMapSyncEntityCommand({
				id: organizationMap.id,
				gauzyId: organization.id,
				integrationId,
				sourceId,
				entity: IntegrationEntity.ORGANIZATION,
				organizationId
			})
		);
	}
}
