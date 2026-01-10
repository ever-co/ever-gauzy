import { BadRequestException, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { PluginSettingCreatedEvent, PluginSettingService } from '../../../../domain';
import { IPluginSetting } from '../../../../shared';
import { CreatePluginSettingCommand } from '../create-plugin-setting.command';

@CommandHandler(CreatePluginSettingCommand)
export class CreatePluginSettingHandler implements ICommandHandler<CreatePluginSettingCommand> {
	private readonly logger = new Logger(CreatePluginSettingHandler.name);

	constructor(private readonly pluginSettingService: PluginSettingService, private readonly eventBus: EventBus) {}

	async execute(command: CreatePluginSettingCommand): Promise<IPluginSetting> {
		const { createDto, tenantId, organizationId, userId } = command;

		try {
			// Validate required fields
			if (!createDto.pluginId || !createDto.key) {
				throw new BadRequestException('Plugin ID and key are required');
			}

			// Add tenant context to the DTO
			const settingData = {
				...createDto,
				tenantId,
				organizationId,
				createdBy: userId,
				// Convert validationRules object to JSON string if present
				validationRules: createDto.validationRules ? JSON.stringify(createDto.validationRules) : undefined
			};

			// Create the plugin setting
			const pluginSetting = await this.pluginSettingService.create(settingData);

			// Publish event
			this.eventBus.publish(
				new PluginSettingCreatedEvent(
					pluginSetting.id,
					pluginSetting.pluginId,
					pluginSetting.key,
					pluginSetting.value,
					tenantId,
					organizationId,
					userId
				)
			);

			this.logger.log(`Plugin setting created successfully: ${pluginSetting.id}`);
			return pluginSetting;
		} catch (error) {
			this.logger.error(`Failed to create plugin setting: ${error.message}`, error.stack);
			throw new BadRequestException(`Failed to create plugin setting: ${error.message}`);
		}
	}
}
