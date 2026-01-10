import { BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { PluginSettingService, PluginSettingUpdatedEvent } from '../../../../domain';
import { IPluginSetting } from '../../../../shared';
import { UpdatePluginSettingCommand } from '../update-plugin-setting.command';

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

			// Prepare update data with proper type conversion
			const settingUpdateData: any = {
				...updateDto,
				updatedAt: new Date()
			};

			// Convert validationRules object to JSON string if present
			if (updateDto.validationRules && typeof updateDto.validationRules === 'object') {
				settingUpdateData.validationRules = JSON.stringify(updateDto.validationRules);
			}

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
