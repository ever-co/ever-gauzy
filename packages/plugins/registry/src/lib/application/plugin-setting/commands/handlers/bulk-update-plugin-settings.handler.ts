import { BadRequestException, Logger } from '@nestjs/common';
import { CommandHandler, EventBus, ICommandHandler } from '@nestjs/cqrs';
import { DataSource } from 'typeorm';
import { PluginSettingService, PluginSettingsBulkUpdatedEvent } from '../../../../domain';
import { IPluginSetting } from '../../../../shared';
import { BulkUpdatePluginSettingsCommand } from '../bulk-update-plugin-settings.command';

@CommandHandler(BulkUpdatePluginSettingsCommand)
export class BulkUpdatePluginSettingsHandler implements ICommandHandler<BulkUpdatePluginSettingsCommand> {
	private readonly logger = new Logger(BulkUpdatePluginSettingsHandler.name);

	constructor(
		private readonly pluginSettingService: PluginSettingService,
		private readonly eventBus: EventBus,
		private readonly dataSource: DataSource
	) {}

	async execute(command: BulkUpdatePluginSettingsCommand): Promise<IPluginSetting[]> {
		const { bulkUpdateDto, tenantId, organizationId, userId } = command;

		try {
			const { pluginId, settings, pluginTenantId } = bulkUpdateDto;

			// Validate required fields
			if (!pluginId || !settings || settings.length === 0) {
				throw new BadRequestException('Plugin ID and settings array are required');
			}

			// Use transaction for bulk operations
			return await this.dataSource.transaction(async (manager) => {
				const updatedSettings: IPluginSetting[] = [];
				const changedSettings: Array<{ key: string; newValue: any; oldValue: any }> = [];

				for (const settingUpdate of settings) {
					const { key, value } = settingUpdate;

					if (!key) {
						throw new BadRequestException('Setting key is required');
					}

					// Find existing setting
					let existingSetting = await this.pluginSettingService.findByKey(pluginId, key, pluginTenantId);

					const previousValue = existingSetting?.value;

					if (existingSetting) {
						// Verify tenant access
						if (existingSetting.tenantId !== tenantId) {
							throw new BadRequestException(`Access denied to plugin setting: ${key}`);
						}

						// Update existing setting
						await this.pluginSettingService.update(existingSetting.id, {
							value,
							updatedBy: { id: userId },
							updatedAt: new Date()
						});
						existingSetting = await this.pluginSettingService.findOneByIdString(existingSetting.id);
						updatedSettings.push(existingSetting);
					} else {
						// Create new setting
						const newSetting = await this.pluginSettingService.create({
							pluginId,
							key,
							value,
							pluginTenantId,
							tenantId,
							organizationId
						});
						updatedSettings.push(newSetting);
					}

					changedSettings.push({
						key,
						newValue: value,
						oldValue: previousValue
					});
				}

				// Publish event
				this.eventBus.publish(
					new PluginSettingsBulkUpdatedEvent(
						pluginId,
						changedSettings,
						pluginTenantId,
						tenantId,
						organizationId,
						userId
					)
				);

				this.logger.log(`Plugin settings bulk updated successfully for plugin: ${pluginId}`);
				return updatedSettings;
			});
		} catch (error) {
			this.logger.error(`Failed to bulk update plugin settings: ${error.message}`, error.stack);
			if (error instanceof BadRequestException) {
				throw error;
			}
			throw new BadRequestException(`Failed to bulk update plugin settings: ${error.message}`);
		}
	}
}
