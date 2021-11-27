import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { IIntegrationMap, IntegrationEntity } from '@gauzy/contracts';
import { IntegrationMapSyncEntityCommand } from '../integration-map.sync-entity.command';
import { IntegrationMapSyncScreenshotCommand } from '../integration-map.sync-screenshot.command';
import { IntegrationMapService } from '../../integration-map.service';
import { RequestContext } from '../../../core/context';
import { ScreenshotCreateCommand, ScreenshotUpdateCommand } from './../../../time-tracking/screenshot/commands';

@CommandHandler(IntegrationMapSyncScreenshotCommand)
export class IntegrationMapSyncScreenshotHandler
	implements ICommandHandler<IntegrationMapSyncScreenshotCommand> {

	constructor(
		private readonly _commandBus: CommandBus,
		private readonly _integrationMapService: IntegrationMapService
	) {}

	/**
	 * Third party screenshot integrated and mapped
	 * 
	 * @param command 
	 * @returns 
	 */
	public async execute(
		command: IntegrationMapSyncScreenshotCommand
	): Promise<IIntegrationMap> {
		const { input } = command;
		const tenantId = RequestContext.currentTenantId();

		const { screenshot, integrationId, sourceId, organizationId, employee } = input;
		const { time_slot, full_url, thumb_url, recorded_at } = screenshot;

		try {
			const screenshotMap = await this._integrationMapService.findOneByOptions({
				where: {
					sourceId,
					entity: IntegrationEntity.SCREENSHOT,
					organizationId,
					tenantId
				}
			});
			await this._commandBus.execute(
				new ScreenshotUpdateCommand(
					Object.assign({}, {
						id: screenshotMap.gauzyId,
						recordedAt: recorded_at,
						activityTimestamp: time_slot,
						file: full_url,
						thumb: thumb_url,
						employeeId: employee.gauzyId
					})
				)
			);
			return screenshotMap;
		} catch (error) {
			const gauzyScreenshot = await this._commandBus.execute(
				new ScreenshotCreateCommand({
					file: full_url,
					thumb: thumb_url,
					recordedAt: recorded_at,
					activityTimestamp: time_slot,
					employeeId: employee.gauzyId,
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
	}
}
