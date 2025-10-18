import { Injectable } from '@nestjs/common';
import { FindManyOptions } from 'typeorm';
import { TenantAwareCrudService } from '@gauzy/core';
import { PluginSetting } from '../entities/plugin-setting.entity';
import { TypeOrmPluginSettingRepository } from '../repositories/type-orm-plugin-setting.repository';
import { MikroOrmPluginSettingRepository } from '../repositories/mikro-orm-plugin-setting.repository';
import { IPluginSetting } from '../../shared/models/plugin-setting.model';

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
}
