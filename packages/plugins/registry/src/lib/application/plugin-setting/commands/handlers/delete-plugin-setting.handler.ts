import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { PluginSettingDeletedEvent, PluginSettingService } from '../../../../domain';
import { DeletePluginSettingCommand } from '../delete-plugin-setting.command';

@CommandHandler(DeletePluginSettingCommand)
export class DeletePluginSettingHandler implements ICommandHandler<DeletePluginSettingCommand> {
	private readonly logger = new Logger(DeletePluginSettingHandler.name);

	constructor(private readonly pluginSettingService: PluginSettingService, private readonly eventBus: EventBus) {}

	async execute(command: DeletePluginSettingCommand): Promise<void> {
		const { id, tenantId, organizationId, userId } = command;

		try {
			// Find existing plugin setting
			const existingSetting = await this.pluginSettingService.findOneByIdString(id);
			if (!existingSetting) {
				throw new NotFoundException(`Plugin setting with ID "${id}" not found`);
			}

			// Verify tenant access
			if (existingSetting.tenantId !== tenantId) {
				throw new BadRequestException('Access denied to this plugin setting');
			}

			// Delete the plugin setting
			await this.pluginSettingService.delete(id);

			// Publish event
			this.eventBus.publish(
				new PluginSettingDeletedEvent(
					existingSetting.id,
					existingSetting.pluginId,
					existingSetting.key,
					existingSetting.value,
					tenantId,
					organizationId,
					userId
				)
			);

			this.logger.log(`Plugin setting deleted successfully: ${id}`);
		} catch (error) {
			this.logger.error(`Failed to delete plugin setting: ${error.message}`, error.stack);
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(`Failed to delete plugin setting: ${error.message}`);
		}
	}
}
