import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { IntegrationEntity } from '@gauzy/contracts';
import { RequestContext } from './../../../core/context';
import { IntegrationMapSyncOrganizationCommand } from './../integration-map.sync-organization.command';
import { IntegrationMapSyncEntityCommand } from './../integration-map.sync-entity.command';
import { IntegrationMapService } from '../../integration-map.service';
import { OrganizationCreateCommand, OrganizationUpdateCommand } from './../../../organization/commands';

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

		try {
			const organizationMap = await this._integrationMapService.findOneByWhereOptions({
				entity: IntegrationEntity.ORGANIZATION,
				sourceId,
				integrationId,
				organizationId,
				tenantId
			});
			await this._commandBus.execute(
				new OrganizationUpdateCommand(organizationMap.gauzyId, entity)
			);
			return organizationMap;
		} catch (error) {
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
	}
}
