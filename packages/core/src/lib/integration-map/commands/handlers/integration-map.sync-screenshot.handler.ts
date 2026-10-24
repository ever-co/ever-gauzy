import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { IIntegrationMap, IntegrationEntity } from '@gauzy/contracts';
import { IntegrationMapSyncEntityCommand } from '../integration-map.sync-entity.command';
import { IntegrationMapSyncScreenshotCommand } from '../integration-map.sync-screenshot.command';
import { IntegrationMapService } from '../../integration-map.service';
import { RequestContext } from '../../../core/context';
import { ScreenshotCreateCommand, ScreenshotUpdateCommand } from '../../../time-tracking/screenshot/commands';
import { nullIfNotFound } from './null-if-not-found';

@CommandHandler(IntegrationMapSyncScreenshotCommand)
export class IntegrationMapSyncScreenshotHandler implements ICommandHandler<IntegrationMapSyncScreenshotCommand> {
	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _integrationMapService: IntegrationMapService
	) {}

	/**
	 * Handles the integration and mapping of third-party screenshots.
	 *
	 * @param {IntegrationMapSyncScreenshotCommand} command - The command containing the data required for screenshot integration and mapping.
	 * @returns {Promise<IIntegrationMap>} - The integration map of the screenshot.
	 * @throws {BadRequestException} - Throws an exception if screenshot integration or mapping fails.
	 */
	public async execute(command: IntegrationMapSyncScreenshotCommand): Promise<IIntegrationMap> {
		const { input } = command;
		const tenantId = RequestContext.currentTenantId();

		const { integrationId, sourceId, organizationId, entity } = input;
		const { time_slot, full_url, thumb_url, recorded_at, employeeId } = entity;

		// Only a missing map means the screenshot is new. Errors from the update below must reach the caller:
		// they used to fall into the "no map" branch and create a second screenshot and map for the same source id.
		const screenshotMap = await this._integrationMapService
			.findOneByWhereOptions({
				entity: IntegrationEntity.SCREENSHOT,
				sourceId,
				integrationId,
				organizationId,
				tenantId
			})
			.catch(nullIfNotFound);

		if (!screenshotMap) {
			// If no existing map is found, create a new screenshot and map it
			const gauzyScreenshot = await this._commandBus.execute(
				new ScreenshotCreateCommand({
					file: full_url,
					thumb: thumb_url,
					recordedAt: recorded_at,
					activityTimestamp: time_slot,
					employeeId,
					organizationId
				})
			);

			return await this._commandBus.execute(
				new IntegrationMapSyncEntityCommand({
					gauzyId: gauzyScreenshot.id,
					integrationId,
					sourceId,
					entity: IntegrationEntity.SCREENSHOT,
					organizationId
				})
			);
		}

		// Update the existing screenshot with the new data; its update errors reach the caller
		const updated = await this._commandBus
			.execute(
				new ScreenshotUpdateCommand({
					id: screenshotMap.gauzyId,
					recordedAt: recorded_at,
					activityTimestamp: time_slot,
					file: full_url,
					thumb: thumb_url,
					employeeId
				})
			)
			.catch(nullIfNotFound);
		if (updated) {
			return screenshotMap;
		}

		// The mapped screenshot was deleted here: create it again and point the EXISTING map at it
		const gauzyScreenshot = await this._commandBus.execute(
			new ScreenshotCreateCommand({
				file: full_url,
				thumb: thumb_url,
				recordedAt: recorded_at,
				activityTimestamp: time_slot,
				employeeId,
				organizationId
			})
		);
		return await this._commandBus.execute(
			new IntegrationMapSyncEntityCommand({
				id: screenshotMap.id,
				gauzyId: gauzyScreenshot.id,
				integrationId,
				sourceId,
				entity: IntegrationEntity.SCREENSHOT,
				organizationId
			})
		);
	}
}
