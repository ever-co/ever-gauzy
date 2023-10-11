import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { IntegrationEntity } from '@gauzy/contracts';
import { RequestContext } from './../../../core/context';
import { IntegrationMapSyncProjectCommand } from './../integration-map.sync-project.command';
import { IntegrationMapSyncEntityCommand } from './../integration-map.sync-entity.command';
import { IntegrationMapService } from '../../integration-map.service';
import { OrganizationProjectCreateCommand, OrganizationProjectUpdateCommand } from '../../../organization-project/commands';

@CommandHandler(IntegrationMapSyncProjectCommand)
export class IntegrationMapSyncProjectHandler
	implements ICommandHandler<IntegrationMapSyncProjectCommand> {

	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _integrationMapService: IntegrationMapService
	) { }

	/**
	 * Third party organization project integrated and mapped
	 *
	 * @param command
	 * @returns
	 */
	public async execute(
		command: IntegrationMapSyncProjectCommand
	) {
		const { input } = command;
		const { integrationId, sourceId, organizationId, entity } = input;
		const tenantId = RequestContext.currentTenantId();

		try {
			const projectMap = await this._integrationMapService.findOneByWhereOptions({
				entity: IntegrationEntity.PROJECT,
				sourceId,
				integrationId,
				organizationId,
				tenantId
			});
			await this._commandBus.execute(
				new OrganizationProjectUpdateCommand({
					...entity,
					id: projectMap.gauzyId
				})
			);
			return projectMap;
		} catch (error) {
			const project = await this._commandBus.execute(
				new OrganizationProjectCreateCommand(entity)
			);
			return await this._commandBus.execute(
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
