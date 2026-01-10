import { BadRequestException, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { PluginSettingService, PluginSettingValueSetEvent } from '../../../../domain';
import { IPluginSetting } from '../../../../shared';
import { SetPluginSettingValueCommand } from '../set-plugin-setting-value.command';

@CommandHandler(SetPluginSettingValueCommand)
export class SetPluginSettingValueHandler implements ICommandHandler<SetPluginSettingValueCommand> {
	private readonly logger = new Logger(SetPluginSettingValueHandler.name);

	constructor(private readonly pluginSettingService: PluginSettingService, private readonly eventBus: EventBus) {}

	async execute(command: SetPluginSettingValueCommand): Promise<IPluginSetting> {
		const { setValueDto, tenantId, organizationId, userId } = command;

		try {
			const { pluginId, key, value, pluginTenantId } = setValueDto;

			// Validate required fields
			if (!pluginId || !key) {
				throw new BadRequestException('Plugin ID and key are required');
			}

			// Find existing setting or create new one
			let pluginSetting = await this.pluginSettingService.findByKey(pluginId, key, pluginTenantId);

			const previousValue = pluginSetting?.value;

			if (pluginSetting) {
				// Verify tenant access
				if (pluginSetting.tenantId !== tenantId) {
					throw new BadRequestException('Access denied to this plugin setting');
				}

				// Update existing setting
				await this.pluginSettingService.update(pluginSetting.id, {
					value,
					updatedAt: new Date()
				});
				pluginSetting = await this.pluginSettingService.findOneByIdString(pluginSetting.id);
			} else {
				// Create new setting
				pluginSetting = await this.pluginSettingService.create({
					pluginId,
					key,
					value,
					pluginTenantId,
					tenantId,
					organizationId
				});
			}

			// Publish event
			this.eventBus.publish(
				new PluginSettingValueSetEvent(
					pluginSetting.id,
					pluginSetting.pluginId,
					pluginSetting.key,
					pluginSetting.value,
					previousValue,
					tenantId,
					organizationId,
					userId
				)
			);

			this.logger.log(`Plugin setting value set successfully: ${pluginSetting.id}`);
			return pluginSetting;
		} catch (error) {
			this.logger.error(`Failed to set plugin setting value: ${error.message}`, error.stack);
			if (error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(`Failed to set plugin setting value: ${error.message}`);
		}
	}
}
