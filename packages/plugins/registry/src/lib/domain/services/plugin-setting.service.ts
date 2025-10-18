import { Injectable } from '@nestjs/common';
import { FindManyOptions, FindOneOptions } from 'typeorm';
import { TenantAwareCrudService } from '@gauzy/core';
import { PluginSetting } from '../entities/plugin-setting.entity';
import { TypeOrmPluginSettingRepository } from '../repositories/type-orm-plugin-setting.repository';
import { MikroOrmPluginSettingRepository } from '../repositories/mikro-orm-plugin-setting.repository';
import {
	IPluginSetting,
	IPluginSettingCreateInput,
	IPluginSettingUpdateInput,
	IPluginSettingFindInput,
	PluginSettingDataType
} from '../../shared/models/plugin-setting.model';

@Injectable()
export class PluginSettingService extends TenantAwareCrudService<PluginSetting> {
	constructor(
		public readonly typeOrmPluginSettingRepository: TypeOrmPluginSettingRepository,
		public readonly mikroOrmPluginSettingRepository: MikroOrmPluginSettingRepository
	) {
		super(typeOrmPluginSettingRepository, mikroOrmPluginSettingRepository);
	}

	/**
	 * Find plugin settings by plugin ID
	 */
	async findByPluginId(pluginId: string, relations: string[] = []): Promise<IPluginSetting[]> {
		const result = await this.findAll({
			where: { pluginId },
			relations
		} as FindManyOptions);
		return result.items || [];
	}

	/**
	 * Find plugin settings by plugin tenant ID
	 */
	async findByPluginTenantId(pluginTenantId: string, relations: string[] = []): Promise<IPluginSetting[]> {
		const result = await this.findAll({
			where: { pluginTenantId },
			relations
		} as FindManyOptions);
		return result.items || [];
	}

	/**
	 * Find a specific plugin setting by key
	 */
	async findByKey(
		pluginId: string,
		key: string,
		pluginTenantId?: string,
		relations: string[] = []
	): Promise<IPluginSetting | null> {
		const where: any = { pluginId, key };
		if (pluginTenantId) {
			where.pluginTenantId = pluginTenantId;
		}

		try {
			const result = await this.findOneOrFailByWhereOptions(where);
			return result.record;
		} catch {
			return null;
		}
	}

	/**
	 * Get plugin setting value by key
	 */
	async getSettingValue(pluginId: string, key: string, pluginTenantId?: string): Promise<any> {
		const setting = await this.findByKey(pluginId, key, pluginTenantId);
		if (!setting) {
			return null;
		}
		return this.parseSettingValue(setting);
	}

	/**
	 * Set plugin setting value
	 */
	async setSettingValue(pluginId: string, key: string, value: any, pluginTenantId?: string): Promise<IPluginSetting> {
		const existing = await this.findByKey(pluginId, key, pluginTenantId);

		const settingValue = this.serializeSettingValue(value);

		if (existing) {
			const updated = await this.update(existing.id, {
				value: settingValue
			} as IPluginSettingUpdateInput);
			return updated as IPluginSetting;
		} else {
			return await this.create({
				pluginId,
				key,
				value: settingValue,
				tenantId: pluginTenantId,
				dataType: this.inferDataType(value),
				isRequired: false,
				isEncrypted: false
			} as IPluginSettingCreateInput);
		}
	}

	/**
	 * Get plugin settings by category
	 */
	async findByCategory(
		pluginId: string,
		category: string,
		pluginTenantId?: string,
		relations: string[] = []
	): Promise<IPluginSetting[]> {
		const where: any = { pluginId, category };
		if (pluginTenantId) {
			where.pluginTenantId = pluginTenantId;
		}

		const result = await this.findAll({
			where,
			relations,
			order: { order: 'ASC', key: 'ASC' }
		} as FindManyOptions);
		return result.items || [];
	}

	/**
	 * Bulk update plugin settings
	 */
	async bulkUpdateSettings(
		pluginId: string,
		settings: Array<{ key: string; value: any; pluginTenantId?: string }>
	): Promise<IPluginSetting[]> {
		const results: IPluginSetting[] = [];

		for (const setting of settings) {
			const result = await this.setSettingValue(pluginId, setting.key, setting.value, setting.pluginTenantId);
			results.push(result);
		}

		return results;
	}

	/**
	 * Validate setting value against data type and validation rules
	 */
	async validateSetting(setting: IPluginSetting, value: any): Promise<boolean> {
		// Basic data type validation
		if (!this.isValidDataType(value, setting.dataType)) {
			return false;
		}

		// Custom validation rules
		if (setting.validationRules) {
			try {
				const rules = JSON.parse(setting.validationRules);
				return this.validateAgainstRules(value, rules);
			} catch (error) {
				console.error('Invalid validation rules JSON:', error);
				return false;
			}
		}

		return true;
	}

	/**
	 * Parse setting value based on data type
	 */
	private parseSettingValue(setting: IPluginSetting): any {
		const { value, dataType } = setting;

		try {
			switch (dataType) {
				case PluginSettingDataType.BOOLEAN:
					return value === 'true' || value === true || value === 1 || value === '1';
				case PluginSettingDataType.NUMBER:
					return parseFloat(value);
				case PluginSettingDataType.JSON:
				case PluginSettingDataType.ARRAY:
					return JSON.parse(value);
				case PluginSettingDataType.DATE:
					return new Date(value);
				default:
					return value;
			}
		} catch (error) {
			console.error('Error parsing setting value:', error);
			return value;
		}
	}

	/**
	 * Serialize setting value to string
	 */
	private serializeSettingValue(value: any): string {
		if (typeof value === 'string') {
			return value;
		}
		if (typeof value === 'object') {
			return JSON.stringify(value);
		}
		return String(value);
	}

	/**
	 * Infer data type from value
	 */
	private inferDataType(value: any): PluginSettingDataType {
		if (typeof value === 'boolean') {
			return PluginSettingDataType.BOOLEAN;
		}
		if (typeof value === 'number') {
			return PluginSettingDataType.NUMBER;
		}
		if (Array.isArray(value)) {
			return PluginSettingDataType.ARRAY;
		}
		if (typeof value === 'object') {
			return PluginSettingDataType.JSON;
		}
		if (value instanceof Date) {
			return PluginSettingDataType.DATE;
		}
		return PluginSettingDataType.STRING;
	}

	/**
	 * Validate data type
	 */
	private isValidDataType(value: any, dataType: PluginSettingDataType): boolean {
		switch (dataType) {
			case PluginSettingDataType.BOOLEAN:
				return typeof value === 'boolean' || value === 'true' || value === 'false';
			case PluginSettingDataType.NUMBER:
				return !isNaN(Number(value));
			case PluginSettingDataType.ARRAY:
				return Array.isArray(value) || this.isValidJSON(value);
			case PluginSettingDataType.JSON:
				return typeof value === 'object' || this.isValidJSON(value);
			case PluginSettingDataType.DATE:
				return !isNaN(Date.parse(value));
			case PluginSettingDataType.EMAIL:
				return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
			case PluginSettingDataType.URL:
				try {
					new URL(value);
					return true;
				} catch {
					return false;
				}
			default:
				return true;
		}
	}

	/**
	 * Check if string is valid JSON
	 */
	private isValidJSON(str: string): boolean {
		try {
			JSON.parse(str);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Validate value against custom rules
	 */
	private validateAgainstRules(value: any, rules: any): boolean {
		// Implement custom validation logic based on rules
		// This is a basic implementation - can be extended

		if (rules.required && (!value || value === '')) {
			return false;
		}

		if (rules.minLength && String(value).length < rules.minLength) {
			return false;
		}

		if (rules.maxLength && String(value).length > rules.maxLength) {
			return false;
		}

		if (rules.min && Number(value) < rules.min) {
			return false;
		}

		if (rules.max && Number(value) > rules.max) {
			return false;
		}

		if (rules.pattern && !new RegExp(rules.pattern).test(String(value))) {
			return false;
		}

		return true;
	}
}
