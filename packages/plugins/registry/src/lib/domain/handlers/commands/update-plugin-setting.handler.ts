import { CommandHandler, ICommandHandler, EventBus } from '@nestjs/cqrs';
import { BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { UpdatePluginSettingCommand } from '../../commands/update-plugin-setting.command';
import { PluginSettingService } from '../../services/plugin-setting.service';
import { IPluginSetting } from '../../../shared/models/plugin-setting.model';
import { PluginSettingUpdatedEvent } from '../../events/plugin-setting-updated.event';

@CommandHandler(UpdatePluginSettingCommand)
export class UpdatePluginSettingHandler implements ICommandHandler<UpdatePluginSettingCommand> {
	private readonly logger = new Logger(UpdatePluginSettingHandler.name);

	constructor(private readonly pluginSettingService: PluginSettingService, private readonly eventBus: EventBus) {}

	async execute(command: UpdatePluginSettingCommand): Promise<IPluginSetting> {
		const { id, updateDto, tenantId, organizationId, userId } = command;

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

			// Add metadata to update DTO
			const settingUpdateData = {
				...updateDto,
				updatedBy: userId,
				updatedAt: new Date()
			};

			// Update the plugin setting
			await this.pluginSettingService.update(id, settingUpdateData);
			const updatedSetting = await this.pluginSettingService.findOneByIdString(id);

			// Publish event
			this.eventBus.publish(
				new PluginSettingUpdatedEvent(
					updatedSetting.id,
					updatedSetting.pluginId,
					updatedSetting.key,
					updatedSetting.value,
					existingSetting.value, // previous value
					tenantId,
					organizationId,
					userId
				)
			);

			this.logger.log(`Plugin setting updated successfully: ${updatedSetting.id}`);
			return updatedSetting;
		} catch (error) {
			this.logger.error(`Failed to update plugin setting: ${error.message}`, error.stack);
			if (error instanceof NotFoundException || error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(`Failed to update plugin setting: ${error.message}`);
		}
	}
}
