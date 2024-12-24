import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { ITag, IntegrationEntity } from '@gauzy/contracts';
import { RequestContext } from '../../../core/context';
import { TagCreateCommand, TagUpdateCommand } from '../../../tags/commands';
import { TagService } from '../../../tags/tag.service';
import { IntegrationMapSyncEntityCommand } from './../integration-map.sync-entity.command';
import { IntegrationMapSyncLabelCommand } from './../integration-map.sync-label.command';
import { IntegrationMapService } from '../../integration-map.service';

@CommandHandler(IntegrationMapSyncLabelCommand)
export class IntegrationMapSyncLabelHandler implements ICommandHandler<IntegrationMapSyncLabelCommand> {
	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _integrationMapService: IntegrationMapService,
		private readonly _tagService: TagService
	) {}

	/**
	 * Execute the IntegrationMapSyncLabelCommand to sync GitHub labels and update tags.
	 *
	 * @param command - The IntegrationMapSyncLabelCommand containing the request data.
	 * @returns A promise that resolves to the updated integration map.
	 */
	public async execute(command: IntegrationMapSyncLabelCommand): Promise<ITag> {
		const { request } = command;
		const { sourceId, organizationId, integrationId, entity } = request;
		const { name, color, description, isSystem } = entity;
		const tenantId = RequestContext.currentTenantId() || request.tenantId;

		try {
			// Check if an integration map already exists for the issue
			const integrationMap = await this._integrationMapService.findOneByWhereOptions({
				entity: IntegrationEntity.LABEL,
				sourceId,
				integrationId,
				organizationId,
				tenantId
			});
			// Try to find the corresponding tag
			try {
				await this._tagService.findOneByIdString(integrationMap.gauzyId);
				// Update the corresponding task with the new input data
				return await this._commandBus.execute(new TagUpdateCommand(integrationMap.gauzyId, entity));
			} catch (error) {
				// Create a corresponding tag with the new input data
				return await this._commandBus.execute(
					new TagCreateCommand({
						id: integrationMap.gauzyId,
						name,
						color,
						description,
						isSystem,
						organizationId,
						tenantId
					})
				);
			}
		} catch (error) {
			const tag = await this._commandBus.execute(
				new TagCreateCommand({
					name,
					color,
					description,
					isSystem,
					organizationId,
					tenantId
				})
			);
			await this._commandBus.execute(
				new IntegrationMapSyncEntityCommand({
					gauzyId: tag.id,
					entity: IntegrationEntity.LABEL,
					integrationId,
					sourceId,
					organizationId,
					tenantId
				})
			);
			return tag;
		}
	}
}
