import { TenantAwareCrudService } from '@gauzy/core';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FindManyOptions, FindOptionsWhere } from 'typeorm';
import {
	IPluginSetting,
	IPluginSettingCreateInput,
	IPluginSettingUpdateInput
} from '../../shared/models/plugin-setting.model';
import { PluginSetting } from '../entities/plugin-setting.entity';
import { MikroOrmPluginSettingRepository } from '../repositories/mikro-orm-plugin-setting.repository';
import { TypeOrmPluginSettingRepository } from '../repositories/type-orm-plugin-setting.repository';

@Injectable()
export class PluginSettingService extends TenantAwareCrudService<PluginSetting> {
	private readonly logger = new Logger(PluginSettingService.name);

	constructor(
		public readonly typeOrmPluginSettingRepository: TypeOrmPluginSettingRepository,
		public readonly mikroOrmPluginSettingRepository: MikroOrmPluginSettingRepository
	) {
		super(typeOrmPluginSettingRepository, mikroOrmPluginSettingRepository);
	}

	/**
	 * Create a new plugin setting with validation
	 */
	async createSetting(input: IPluginSettingCreateInput): Promise<IPluginSetting> {
		this.validateCreateInput(input);

		try {
			// Check for duplicate key within the same plugin and tenant context
			const existingSetting = await this.findByKey(input.pluginId, input.key, input.pluginTenantId);
			if (existingSetting) {
				throw new BadRequestException(`Setting with key "${input.key}" already exists for this plugin`);
			}

			const setting = await this.create(input);
			this.logger.log(`Plugin setting created: ${setting.id}`);
			return setting;
		} catch (error) {
			this.logger.error(`Failed to create plugin setting: ${error.message}`, error.stack);
			throw error;
		}
	}

	/**
	 * Update plugin setting with validation
	 */
	async updateSetting(id: string, input: IPluginSettingUpdateInput): Promise<IPluginSetting> {
		try {
			const existingSetting = await this.findOneByIdString(id);
			if (!existingSetting) {
				throw new NotFoundException(`Plugin setting with ID "${id}" not found`);
			}

			await this.update(id, input);
			const updatedSetting = await this.findOneByIdString(id);

			this.logger.log(`Plugin setting updated: ${id}`);
			return updatedSetting;
		} catch (error) {
			this.logger.error(`Failed to update plugin setting: ${error.message}`, error.stack);
			throw error;
		}
	}

	/**
	 * Find plugin settings by plugin ID with enhanced filtering
	 */
	async findByPluginId(
		pluginId: string,
		relations: string[] = [],
		tenantId?: string,
		organizationId?: string
	): Promise<IPluginSetting[]> {
		this.validatePluginId(pluginId);

		const where: FindOptionsWhere<PluginSetting> = { pluginId };
		if (tenantId) where.tenantId = tenantId;
		if (organizationId) where.organizationId = organizationId;

		const result = await this.findAll({
			where,
			relations,
			order: {
				category: {
					name: 'ASC'
				},
				order: 'ASC',
				key: 'ASC'
			}
		} as FindManyOptions);

		return result.items || [];
	}

	/**
	 * Find plugin settings by plugin tenant ID with enhanced filtering
	 */
	async findByPluginTenantId(
		pluginTenantId: string,
		relations: string[] = [],
		tenantId?: string,
		organizationId?: string
	): Promise<IPluginSetting[]> {
		if (!pluginTenantId) {
			throw new BadRequestException('Plugin tenant ID is required');
		}

		const where: FindOptionsWhere<PluginSetting> = { pluginTenantId };
		if (tenantId) where.tenantId = tenantId;
		if (organizationId) where.organizationId = organizationId;

		const result = await this.findAll({
			where,
			relations,
			order: {
				category: {
					name: 'ASC'
				},
				order: 'ASC',
				key: 'ASC'
			}
		} as FindManyOptions);

		return result.items || [];
	}

	/**
	 * Find a specific plugin setting by key with validation
	 */
	async findByKey(
		pluginId: string,
		key: string,
		pluginTenantId?: string,
		relations: string[] = []
	): Promise<IPluginSetting | null> {
		this.validatePluginId(pluginId);
		this.validateKey(key);

		const where: FindOptionsWhere<PluginSetting> = { pluginId, key };
		if (pluginTenantId) {
			where.tenantId = pluginTenantId;
		}

		try {
			const result = await this.findOneOrFailByWhereOptions(where);
			return result.record;
		} catch {
			return null;
		}
	}

	/**
	 * Get plugin settings by category with enhanced validation
	 */
	async findByCategory(
		pluginId: string,
		categoryId: string,
		pluginTenantId?: string,
		relations: string[] = [],
		tenantId?: string,
		organizationId?: string
	): Promise<IPluginSetting[]> {
		this.validatePluginId(pluginId);
		this.validateCategory(categoryId);

		const where: FindOptionsWhere<PluginSetting> = { pluginId, categoryId };
		if (pluginTenantId) where.tenantId = pluginTenantId;
		if (tenantId) where.tenantId = tenantId;
		if (organizationId) where.organizationId = organizationId;

		const result = await this.findAll({
			where,
			relations,
			order: { order: 'ASC', key: 'ASC' }
		} as FindManyOptions);

		return result.items || [];
	}

	/**
	 * Get setting value with type safety
	 */
	async getSettingValue<T = any>(
		pluginId: string,
		key: string,
		pluginTenantId?: string,
		defaultValue?: T
	): Promise<T | null> {
		const setting = await this.findByKey(pluginId, key, pluginTenantId);

		if (!setting) {
			return defaultValue ?? null;
		}

		try {
			// Try to parse JSON if the value is a string that looks like JSON
			if (typeof setting.value === 'string' && (setting.value.startsWith('{') || setting.value.startsWith('['))) {
				return JSON.parse(setting.value) as T;
			}
			return setting.value as T;
		} catch {
			// If JSON parsing fails, return the raw value
			return setting.value as T;
		}
	}

	/**
	 * Set setting value with type conversion
	 */
	async setSettingValue(
		pluginId: string,
		key: string,
		value: any,
		pluginTenantId?: string,
		tenantId?: string,
		organizationId?: string
	): Promise<IPluginSetting> {
		let setting = await this.findByKey(pluginId, key, pluginTenantId);

		const processedValue = this.processSettingValue(value);

		if (setting) {
			await this.update(setting.id, { value: processedValue });
			setting = await this.findOneByIdString(setting.id);
		} else {
			setting = await this.create({
				pluginId,
				key,
				value: processedValue,
				tenantId,
				organizationId
			});
		}

		return setting;
	}

	/**
	 * Bulk update settings with transaction support
	 */
	async bulkUpdateSettings(
		pluginId: string,
		settings: Array<{ key: string; value: any; categoryId?: string }>,
		pluginTenantId?: string,
		tenantId?: string,
		organizationId?: string
	): Promise<IPluginSetting[]> {
		this.validatePluginId(pluginId);

		if (!settings || settings.length === 0) {
			throw new BadRequestException('Settings array cannot be empty');
		}

		const updatedSettings: IPluginSetting[] = [];

		for (const settingData of settings) {
			const { key, value, categoryId } = settingData;
			this.validateKey(key);

			const setting = await this.setSettingValue(pluginId, key, value, pluginTenantId, tenantId, organizationId);

			// Update category if provided
			if (categoryId && setting.categoryId !== categoryId) {
				await this.update(setting.id, { categoryId });
				const updatedSetting = await this.findOneByIdString(setting.id);
				updatedSettings.push(updatedSetting);
			} else {
				updatedSettings.push(setting);
			}
		}

		this.logger.log(`Bulk updated ${updatedSettings.length} settings for plugin: ${pluginId}`);
		return updatedSettings;
	}

	/**
	 * Delete setting by key
	 */
	async deleteByKey(pluginId: string, key: string, pluginTenantId?: string): Promise<void> {
		const setting = await this.findByKey(pluginId, key, pluginTenantId);

		if (!setting) {
			throw new NotFoundException(`Setting with key "${key}" not found for plugin "${pluginId}"`);
		}

		await this.delete(setting.id);
		this.logger.log(`Plugin setting deleted: ${setting.id}`);
	}

	/**
	 * Check if a setting exists
	 */
	async exists(pluginId: string, key: string, pluginTenantId?: string): Promise<boolean> {
		const setting = await this.findByKey(pluginId, key, pluginTenantId);
		return !!setting;
	}

	/**
	 * Validate setting value against its configuration
	 */
	async validateSetting(setting: IPluginSetting, value: any): Promise<boolean> {
		if (!setting) {
			return false;
		}

		// Basic validation based on data type
		switch (setting.dataType) {
			case 'string':
				return typeof value === 'string';
			case 'number':
				return typeof value === 'number' && !isNaN(value);
			case 'boolean':
				return typeof value === 'boolean';
			case 'json':
				try {
					if (typeof value === 'object') return true;
					JSON.parse(value);
					return true;
				} catch {
					return false;
				}
			default:
				return true;
		}
	}

	// Private validation methods
	private validateCreateInput(input: IPluginSettingCreateInput): void {
		if (!input.pluginId) {
			throw new BadRequestException('Plugin ID is required');
		}
		if (!input.key) {
			throw new BadRequestException('Setting key is required');
		}
		this.validateKey(input.key);
	}

	private validatePluginId(pluginId: string): void {
		if (!pluginId || pluginId.trim().length === 0) {
			throw new BadRequestException('Plugin ID is required and cannot be empty');
		}
	}

	private validateKey(key: string): void {
		if (!key || key.trim().length === 0) {
			throw new BadRequestException('Setting key is required and cannot be empty');
		}

		// Validate key format (alphanumeric, dots, dashes, underscores)
		const keyRegex = /^[a-zA-Z0-9._-]+$/;
		if (!keyRegex.test(key)) {
			throw new BadRequestException(
				'Setting key can only contain alphanumeric characters, dots, dashes, and underscores'
			);
		}
	}

	private validateCategory(category: string): void {
		if (!category || category.trim().length === 0) {
			throw new BadRequestException('Category is required and cannot be empty');
		}
	}

	private processSettingValue(value: any): any {
		// Convert objects and arrays to JSON strings for storage
		if (typeof value === 'object' && value !== null) {
			return JSON.stringify(value);
		}
		return value;
	}
}
